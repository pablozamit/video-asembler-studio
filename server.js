import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promisify } from 'util';
import fs from 'fs';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = promisify(cloudinary.uploader.upload);
const unlinkFile = promisify(fs.unlink);

const app = express();
const port = process.env.PORT || 8080;

// Configurar CORS para permitir peticiones desde cualquier origen
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configuración de límites y tipos de archivo permitidos
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || 10 * 1024 * 1024; // 10MB por defecto
const ALLOWED_FILE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/jpg': 'jpg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/mp3': 'mp3'
};

// Validar tipos de archivo
const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no soportado: ${file.mimetype}`), false);
  }
};

// Configurar multer para manejar archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(MAX_FILE_SIZE, 10),
    files: 3 // Máximo 3 archivos
  },
  fileFilter
}).any(); // Aceptar cualquier campo de archivo

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API de Video Assembler Studio funcionando');
});

// Ruta para generar el video
app.post('/api/generate-video', upload, async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ 
        error: 'Se requieren al menos el audio de voz y la imagen de fondo',
        received: req.files ? req.files.map(f => f.fieldname) : 'ninguno',
        required: ['voiceAudio', 'bgImage'],
        optional: ['bgMusic']
      });
    }

    // Mapear archivos recibidos y validar
    const files = {};
    req.files.forEach(file => {
      if (!ALLOWED_FILE_TYPES[file.mimetype]) {
        throw new Error(`Tipo de archivo no permitido: ${file.originalname} (${file.mimetype})`);
      }
      files[file.fieldname.trim()] = file;
    });

    // Obtener archivos con manejo de espacios en blanco
    const bgMusic = files['bgMusic'] || files['bgMusic '];
    const voiceAudio = files['voiceAudio'] || files['voiceAudio '];
    const bgImage = files['bgImage'] || files['bgImage '];
    
    if (!voiceAudio || !bgImage) {
      return res.status(400).json({ 
        error: 'Se requieren el audio de voz y la imagen de fondo',
        received: Object.keys(files),
        required: ['voiceAudio', 'bgImage']
      });
    }

    console.log('Iniciando proceso de generación de video...');
    console.log(`Tamaño máximo de archivo: ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    
    // Crear directorio temporal seguro
    const tempDir = join(__dirname, 'temp');
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true, mode: 0o755 });
      }
    } catch (error) {
      console.error('Error al crear directorio temporal:', error);
      throw new Error('No se pudo crear el directorio temporal');
    }

    // Función segura para crear archivos temporales
    const createTempFile = async (buffer, originalName, fileType) => {
      const ext = ALLOWED_FILE_TYPES[fileType] || 'bin';
      const tempPath = join(tempDir, `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`);
      
      try {
        await fs.promises.writeFile(tempPath, buffer);
        console.log(`Archivo temporal creado: ${tempPath} (${(buffer.length / (1024 * 1024)).toFixed(2)}MB)`);
        return tempPath;
      } catch (error) {
        console.error('Error al crear archivo temporal:', error);
        throw new Error('Error al procesar el archivo');
      }
    };

    try {
      // Crear archivos temporales con sus tipos MIME
      const bgImagePath = await createTempFile(bgImage.buffer, bgImage.originalname, bgImage.mimetype);
      const voiceAudioPath = await createTempFile(voiceAudio.buffer, voiceAudio.originalname, voiceAudio.mimetype);
      
      // Subir archivos a Cloudinary
      const [imageResult, voiceResult] = await Promise.all([
        uploadToCloudinary(bgImagePath, {
          resource_type: 'image',
          folder: 'video-assembler',
          public_id: `bg-${Date.now()}`
        }),
        uploadToCloudinary(voiceAudioPath, {
          resource_type: 'video',
          folder: 'video-assembler/audio',
          public_id: `voice-${Date.now()}`
        })
      ]);

      // Configuración para la transformación de video
      const transformation = [
        { width: 1280, height: 720, crop: 'fill' },
        { overlay: `video:${voiceResult.public_id}` },
        { flags: 'splice', audio_codec: 'aac' }
      ];

      // Si hay música de fondo, procesarla
      if (bgMusic) {
        const bgMusicPath = await createTempFile(bgMusic.buffer, bgMusic.originalname, bgMusic.mimetype);
        const musicResult = await uploadToCloudinary(bgMusicPath, {
          resource_type: 'video',
          folder: 'video-assembler/audio',
          public_id: `music-${Date.now()}`
        });

        transformation.push(
          { overlay: `video:${musicResult.public_id}` },
          { flags: 'splice', audio_codec: 'aac' }
        );
      }

      // Generar el video con Cloudinary
      const videoUrl = cloudinary.url(`${imageResult.public_id}.mp4`, {
        resource_type: 'video',
        transformation: transformation,
        format: 'mp4'
      });

      console.log('Video generado exitosamente:', videoUrl);
      
      // Responder con la URL del video generado
      res.json({ 
        success: true,
        videoUrl: videoUrl,
        message: 'Video generado exitosamente',
        downloadUrl: videoUrl
      });
    } finally {
      // Limpiar archivos temporales
      const files = await fs.promises.readdir(tempDir);
      await Promise.all(
        files.map(file => 
          fs.promises.unlink(join(tempDir, file)).catch(console.error)
        )
      );
    }
  } catch (error) {
    console.error('Error en la generación de video:', error);
    res.status(500).json({ 
      error: 'Error al generar el video',
      details: error.message
    });
  }
});

// Endpoint de estado
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    endpoints: {
      generateVideo: '/api/generate-video',
      status: '/api/status'
    }
  });
});

// Servir archivos estáticos del frontend
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
  
  // Para cualquier ruta no manejada, servir index.html
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
  console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
}); 