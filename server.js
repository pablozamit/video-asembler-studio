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

// Configurar CORS para permitir peticiones desde cualquier origen
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configurar multer para manejar archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo por archivo
    files: 3 // Máximo 3 archivos
  }
}).any(); // Aceptar cualquier campo de archivo

// Crear directorio temporal si no existe
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Middleware para manejar archivos subidos
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

    // Mapear archivos recibidos
    const files = {};
    req.files.forEach(file => {
      files[file.fieldname] = file;
    });

    const { bgMusic, voiceAudio, bgImage } = files;
    
    if (!voiceAudio || !bgImage) {
      return res.status(400).json({ 
        error: 'Se requieren el audio de voz y la imagen de fondo',
        received: Object.keys(files),
        required: ['voiceAudio', 'bgImage']
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