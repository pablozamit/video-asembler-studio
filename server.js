import express from 'express';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import serveStatic from 'serve-static';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Configurar CORS para permitir peticiones desde n8n
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configurar multer para manejar archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB límite por archivo
  }
});

// Endpoint para generar video
app.post('/api/generate-video', upload.fields([
  { name: 'bgMusic', maxCount: 1 },
  { name: 'voiceAudio', maxCount: 1 },
  { name: 'bgImage', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files) {
      return res.status(400).json({ 
        error: 'No se proporcionaron archivos',
        required: ['voiceAudio', 'bgImage'],
        optional: ['bgMusic']
      });
    }

    const { bgMusic, voiceAudio, bgImage } = req.files;
    
    if (!voiceAudio || !bgImage) {
      return res.status(400).json({ 
        error: 'Se requieren el audio de voz y la imagen de fondo',
        received: {
          voiceAudio: !!voiceAudio,
          bgImage: !!bgImage,
          bgMusic: !!bgMusic
        }
      });
    }

    // Obtener parámetros opcionales
    const outputFormat = req.body.format || 'mp4';
    const videoQuality = req.body.quality || 'medium'; // low, medium, high
    const audioVolume = req.body.audioVolume || '1.0'; // Volumen del audio (0.0 a 2.0)
    const musicVolumeRatio = req.body.musicVolumeRatio || '0.2'; // Ratio de volumen de la música respecto a la voz (0.0 a 1.0)

    const outputPath = path.join('uploads', `video-${Date.now()}.${outputFormat}`);
    
    // Configurar calidad de video según el parámetro
    const videoQualitySettings = {
      low: { bitrate: '1000k', preset: 'ultrafast' },
      medium: { bitrate: '2000k', preset: 'medium' },
      high: { bitrate: '4000k', preset: 'slow' }
    };

    const quality = videoQualitySettings[videoQuality] || videoQualitySettings.medium;
    
    // Configurar FFmpeg
    const command = ffmpeg()
      .input(bgImage[0].path)
      .input(voiceAudio[0].path)
      .inputOptions(['-loop 1'])
      .outputOptions(['-c:v', 'libx264'])
      .outputOptions(['-b:v', quality.bitrate])
      .outputOptions(['-preset', quality.preset])
      .outputOptions(['-c:a', 'aac'])
      .outputOptions(['-pix_fmt', 'yuv420p'])
      .outputOptions(['-shortest']); // Esto hará que el video dure lo mismo que el audio más largo

    // Si hay música de fondo, añadirla con el volumen especificado
    if (bgMusic) {
      command.input(bgMusic[0].path)
        .outputOptions([
          '-filter_complex',
          `[1:a]volume=${audioVolume}[voice];[2:a]volume=${audioVolume * musicVolumeRatio}[music];[voice][music]amix=inputs=2:duration=longest`
        ]);
    }

    command.save(outputPath)
      .on('start', (commandLine) => {
        console.log('Iniciando generación de video:', commandLine);
      })
      .on('progress', (progress) => {
        console.log('Progreso:', progress.percent, '%');
      })
      .on('end', () => {
        console.log('Video generado exitosamente');
        // Enviar el video generado
        res.download(outputPath, `video.${outputFormat}`, (err) => {
          if (err) {
            console.error('Error al enviar el archivo:', err);
          }
          // Limpiar archivos temporales
          try {
            fs.unlinkSync(outputPath);
            fs.unlinkSync(bgImage[0].path);
            fs.unlinkSync(voiceAudio[0].path);
            if (bgMusic) {
              fs.unlinkSync(bgMusic[0].path);
            }
          } catch (cleanupError) {
            console.error('Error al limpiar archivos temporales:', cleanupError);
          }
        });
      })
      .on('error', (err) => {
        console.error('Error al generar el video:', err);
        res.status(500).json({ 
          error: 'Error al generar el video',
          details: err.message
        });
      });

  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
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
  app.use(serveStatic(path.join(__dirname, 'dist')));
  
  // Para cualquier ruta no manejada, servir index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
  console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
}); 