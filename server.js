import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promisify } from 'util';
import fs from 'fs';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de rutas
const uploadsDir = join(__dirname, 'uploads');

// Asegurar que el directorio de uploads exista
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

const unlinkFile = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const app = express();
const port = process.env.PORT || 8080;

// Configuración de CORS
app.use(cors({
  origin: '*',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Middleware para parsear JSON
app.use(express.json({ limit: '50mb' }));

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

// Configurar almacenamiento en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  }
});

// Configuración detallada de multer
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      console.log('Destino del archivo:', uploadsDir);
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = file.originalname.split('.').pop();
      const filename = `${file.fieldname}-${uniqueSuffix}.${ext}`;
      console.log('Guardando archivo:', filename);
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: parseInt(MAX_FILE_SIZE, 10),
    files: 3 // Máximo 3 archivos
  },
  fileFilter: (req, file, cb) => {
    console.log('Procesando archivo:', file.originalname, 'Tipo MIME:', file.mimetype);
    if (ALLOWED_FILE_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      console.error('Tipo de archivo no permitido:', file.mimetype);
      cb(new Error(`Tipo de archivo no soportado: ${file.mimetype}`), false);
    }
  }
}).any(); // Aceptar cualquier campo de archivo

// Middleware para manejar errores de multer
upload.any = function() {
  const mw = function (req, res, next) {
    return upload(req, res, function (err) {
      if (err) {
        console.error('Error en multer:', err);
        return res.status(400).json({ 
          error: 'Error al procesar archivos',
          details: err.message 
        });
      }
      next();
    });
  };
  return mw;
};

// Ruta de verificación de estado
app.get('/status', (req, res) => {
  res.json({ 
    status: 'online',
    version: '1.0.0',
    endpoints: {
      generateVideo: 'POST /api/generate-video'
    }
  });
});

// Ruta para generar el video
app.post('/api/generate-video', (req, res) => {
  // Middleware de multer
  upload(req, res, async (err) => {
    // Manejar errores de multer
    if (err) {
      console.error('Error en multer:', err);
      return res.status(400).json({ 
        error: 'Error al procesar archivos',
        details: err.message 
      });
    }

    // Validar que se hayan enviado archivos
    if (!req.files || !req.files.length) {
      return res.status(400).json({ 
        error: 'No se recibieron archivos',
        required: ['bgImage', 'voiceAudio'],
        optional: ['bgMusic']
      });
    }
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
      
      // Generar nombres de archivo únicos
      const outputFilename = `video-${uuidv4()}.mp4`;
      const outputPath = join(uploadsDir, outputFilename);
      
      // Crear comando FFmpeg
      const command = ffmpeg()
        .input(join(uploadsDir, bgImage.filename))
        .input(join(uploadsDir, voiceAudio.filename));

      if (bgMusic) {
        command.input(join(uploadsDir, bgMusic.filename))
          .complexFilter([
            '[1:a]volume=1.5[voice];[2:a]volume=0.3[music];[voice][music]amix=inputs=2:duration=longest[audio]'
          ], '[audio]');
      } else {
        command.inputOptions(['-map', '1:a']);
      }

      command
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-preset fast',
          '-shortest'
        ])
        .save(outputPath)
        .on('end', () => {
          // Limpiar archivos temporales
          const cleanupFiles = [
            join(uploadsDir, bgImage.filename),
            join(uploadsDir, voiceAudio.filename)
          ];
          
          if (bgMusic) {
            cleanupFiles.push(join(uploadsDir, bgMusic.filename));
          }
          
          // No eliminamos el archivo de salida, lo serviremos
          cleanupFiles.forEach(file => {
            fs.unlink(file, err => {
              if (err) console.error('Error al eliminar archivo temporal:', err);
            });
          });
          
          // Devolver la URL del video generado
          res.json({ 
            success: true,
            videoUrl: `/uploads/${outputFilename}`,
            downloadUrl: `/download/${outputFilename}`
          });
        })
        .on('error', (err) => {
          console.error('Error al procesar el video:', err);
          res.status(500).json({ error: 'Error al procesar el video: ' + err.message });
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
    console.error('Error al generar el video:', error);
    res.status(500).json({ 
      error: 'Error al generar el video',
      details: error.message || 'Error desconocido',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
  }); // Cierre del middleware de multer
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