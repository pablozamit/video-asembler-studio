import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promisify } from 'util';
import fs from 'fs';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import path from 'path';
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

// Function to download files from Google Drive
async function downloadFileFromGoogleDrive(fileUrl, destinationPath) {
  try {
    let fileId = null;
    // Regex to extract file ID from various Google Drive URL formats
    const regexes = [
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
      /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
      /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/
    ];

    for (const regex of regexes) {
      const match = fileUrl.match(regex);
      if (match && match[1]) {
        fileId = match[1];
        break;
      }
    }

    if (!fileId) {
      throw new Error('Could not extract Google Drive file ID from URL: ' + fileUrl);
    }

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    // Ensure destination directory exists
    const dirname = path.dirname(destinationPath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }

    const writer = fs.createWriteStream(destinationPath);

    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(destinationPath));
      writer.on('error', (err) => {
        fs.unlink(destinationPath, () => reject(err)); // Attempt to delete partial file on error
      });
      response.data.on('error', (err) => { // Also handle errors from the response stream
        writer.close(); // Close the writer
        fs.unlink(destinationPath, () => reject(err)); // Attempt to delete partial file
      });
    });
  } catch (error) {
    console.error(`Error downloading from Google Drive URL ${fileUrl}:`, error.message);
    // If error is from axios, it might have more details
    if (error.response) {
        console.error('Axios response error:', error.response.status, error.response.data);
    }
    // Rethrow or return a specific error structure
    throw new Error(`Failed to download file from Google Drive: ${fileUrl}. Reason: ${error.message}`);
  }
}

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
app.post('/api/generate-video', async (req, res) => {
  const { urlVoz, urlMusica, urlImagen } = req.body;

  if (!urlVoz || !urlImagen) {
    return res.status(400).json({
      error: 'Missing required URLs: urlVoz and urlImagen are required.',
      received: req.body
    });
  }

  const downloadedFilePaths = [];
  try {
    // Define unique local file paths
    const voiceAudioName = `voice-${uuidv4()}.mp3`; // Assuming mp3 for now
    const bgImageName = `image-${uuidv4()}.jpg`; // Assuming jpg for now
    const localVoiceAudioPath = path.join(uploadsDir, voiceAudioName);
    const localBgImagePath = path.join(uploadsDir, bgImageName);
    let localBgMusicPath = null;

    // Download files
    try {
      console.log(`Downloading voice audio from: ${urlVoz} to ${localVoiceAudioPath}`);
      await downloadFileFromGoogleDrive(urlVoz, localVoiceAudioPath);
      downloadedFilePaths.push(localVoiceAudioPath);

      console.log(`Downloading background image from: ${urlImagen} to ${localBgImagePath}`);
      await downloadFileFromGoogleDrive(urlImagen, localBgImagePath);
      downloadedFilePaths.push(localBgImagePath);

      if (urlMusica) {
        const bgMusicName = `music-${uuidv4()}.mp3`; // Assuming mp3 for now
        localBgMusicPath = path.join(uploadsDir, bgMusicName);
        console.log(`Downloading background music from: ${urlMusica} to ${localBgMusicPath}`);
        await downloadFileFromGoogleDrive(urlMusica, localBgMusicPath);
        downloadedFilePaths.push(localBgMusicPath);
      }
    } catch (downloadError) {
      console.error('File download error:', downloadError);
      // Note: The 'finally' block below will handle cleanup.
      return res.status(500).json({
        error: 'Failed to download one or more files from Google Drive.',
        details: downloadError.message
      });
    }

    console.log('Iniciando proceso de generación de video con archivos descargados...');
    
    const outputFilename = `video-${uuidv4()}.mp4`;
    const outputPath = path.join(uploadsDir, outputFilename);

    const command = ffmpeg();

    // Input image - ensure it's treated as a loopable image
    command.input(localBgImagePath).loop();

    // Input voice audio
    command.input(localVoiceAudioPath);

    if (localBgMusicPath) {
        command.input(localBgMusicPath)
            .complexFilter([
                '[1:a]volume=1.5[voice];[2:a]volume=0.2[music];[voice][music]amix=inputs=2:duration=longest[audio]'
            ], '[audio]')
         .outputOptions(['-map', '[audio]']); // Map the mixed audio
    } else {
        // If no background music, map audio from the voice input (second input, index 1)
        command.outputOptions(['-map', '1:a']);
    }

    command
      .outputOptions([
          '-c:v', 'libx264',
          '-tune', 'stillimage', // Good for static images
          '-pix_fmt', 'yuv420p', // For compatibility
          '-c:a', 'aac',         // Audio codec
          '-b:a', '192k',        // Audio bitrate
          '-shortest'         // Finish encoding when the shortest input ends (audio)
      ])
      .save(outputPath)
      .on('end', () => {
          console.log('Video generation finished.');
          // Cleanup downloaded files
          const filesToClean = [localVoiceAudioPath, localBgImagePath];
          if (localBgMusicPath) {
              filesToClean.push(localBgMusicPath);
          }
          filesToClean.forEach(filePath => {
              if (filePath && fs.existsSync(filePath)) {
                  fs.unlink(filePath, err => {
                      if (err) console.error('Error cleaning up downloaded file:', filePath, err);
                      else console.log('Cleaned up downloaded file:', filePath);
                  });
              }
          });
          
          res.json({ 
              success: true,
              videoUrl: `/uploads/${outputFilename}`,
              downloadUrl: `/download/${outputFilename}`
          });
      })
      .on('error', (err) => {
          console.error('Error during FFmpeg processing:', err);
          // Attempt to clean up downloaded files even on error
          const filesToCleanOnError = [localVoiceAudioPath, localBgImagePath, localBgMusicPath].filter(p => p && fs.existsSync(p));
          filesToCleanOnError.forEach(filePath => {
               if (filePath) { // Check if path exists (for optional music file)
                  fs.unlink(filePath, unlinkErr => {
                      if (unlinkErr) console.error('Error cleaning up downloaded file on ffmpeg error:', filePath, unlinkErr);
                      else console.log('Cleaned up downloaded file on ffmpeg error:', filePath);
                  });
               }
          });
          res.status(500).json({ error: 'Error processing video', details: err.message });
      });

  } catch (error) {
    // This top-level catch handles errors not caught by specific download or ffmpeg handlers
    console.error('Error en la generación del video (general):', error);
    res.status(500).json({ 
      error: 'Error al generar el video',
      details: error.message || 'Error desconocido',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    // --- Start of finally block ---
    console.log('Performing cleanup of downloaded files:', downloadedFilePaths);
    for (const filePath of downloadedFilePaths) {
        if (filePath && fs.existsSync(filePath)) { // Ensure path is not null and file exists
            fs.unlink(filePath, err => {
                if (err) {
                    // Log error but don't let it crash the cleanup for other files
                    console.error('Error cleaning up file:', filePath, err);
                } else {
                    console.log('Successfully cleaned up file:', filePath);
                }
            });
        }
    }
    // --- End of finally block ---
  }
});

app.post('/api/merge-mp3s', async (req, res) => {
    const { mp3Urls } = req.body;

    if (!mp3Urls || !Array.isArray(mp3Urls) || mp3Urls.length < 2) {
        return res.status(400).json({
            error: "Invalid request: mp3Urls must be an array of at least two Google Drive URLs."
        });
    }

    // New: Iterate and validate each URL's basic format
    for (const url of mp3Urls) {
        if (typeof url !== 'string') { // Ensure it's a string before trying to parse
             return res.status(400).json({
                error: "Invalid URL type.",
                details: "All items in mp3Urls must be strings."
            });
        }
        try {
            const parsedUrl = new URL(url);
            // Optional: Check for http/https protocol if desired
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                throw new Error('URL must use http or https protocol.');
            }
            // Optional: Check for Google Drive host if being very specific
            // if (parsedUrl.hostname !== 'drive.google.com') {
            //     throw new Error('URL does not appear to be a Google Drive link.');
            // }
        } catch (e) {
            return res.status(400).json({
                error: "Invalid URL format provided.",
                details: `The URL '${url}' is not valid: ${e.message}`
            });
        }
    }

    const downloadedMp3Paths = [];
    let listFilePath = null; // Initialize here to be accessible in finally

    try { // Main try block
        for (const url of mp3Urls) {
            const uniqueName = `mp3-${uuidv4()}.mp3`;
            const localPath = path.join(uploadsDir, uniqueName);

            try {
                console.log(`Downloading MP3 from ${url} to ${localPath}`);
                await downloadFileFromGoogleDrive(url, localPath);
                downloadedMp3Paths.push(localPath);
                // downloadedFileObjects.push({ path: localPath, originalUrl: url });
                console.log(`Successfully downloaded ${url} to ${localPath}`);
            } catch (downloadError) {
                console.error(`Error downloading ${url}:`, downloadError.message);
                // Important: Cleanup files downloaded *so far in this request*
                for (const downloadedPath of downloadedMp3Paths) {
                    fs.unlink(downloadedPath, err => {
                        if (err) console.error('Error cleaning up partially downloaded file during error handling:', downloadedPath, err);
                        else console.log('Cleaned up partially downloaded file during error handling:', downloadedPath)
                    });
                }
                return res.status(500).json({
                    error: "Failed to download one or more MP3 files.",
                    details: `Error downloading from ${url}: ${downloadError.message}`
                });
            }
        }

        // If all downloads successful, proceed to merge
        if (downloadedMp3Paths.length < 2) {
            // This check might be redundant if the initial validation is robust,
            // but good as a safeguard before creating the list file.
            // Cleanup already downloaded files if this somehow happens (though the main error handler or finally block should also catch this)
            for (const p of downloadedMp3Paths) {
                if (fs.existsSync(p)) fs.unlinkSync(p); // Or async
            }
            return res.status(400).json({ error: "Not enough MP3 files to merge after download phase." });
        }

        const listFileName = `ffmpeg-list-${uuidv4()}.txt`;
        // listFilePath is already initialized outside the try block
        listFilePath = path.join(uploadsDir, listFileName);

        const fileListContent = downloadedMp3Paths
            .map(p => `file '${p.replace(/'/g, "'\\''")}'`) // Escapes single quotes in paths
            .join('\n');
        await fs.promises.writeFile(listFilePath, fileListContent);

        const mergedOutputName = `merged-audio-${uuidv4()}.mp3`;
        const outputPath = path.join(uploadsDir, mergedOutputName);

        // Return a promise from the ffmpeg operation to await its completion or error
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(listFilePath)
                .inputFormat('concat')
                .inputOptions(['-safe', '0']) // Necessary when using concat demuxer
                .outputOptions(['-c', 'copy']) // Copy codecs without re-encoding
                .save(outputPath)
                .on('end', () => {
                    console.log('FFmpeg MP3 merging finished successfully.');
                    if (!res.headersSent) {
                        res.json({
                            success: true,
                            mergedFileUrl: `/uploads/${mergedOutputName}`,
                            message: "MP3 files merged successfully."
                        });
                    }
                    resolve(); // Resolve the promise
                })
                .on('error', (err) => {
                    console.error('Error during FFmpeg MP3 merging:', err.message);
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: "Error merging MP3 files.",
                            details: err.message
                        });
                    }
                    reject(err); // Reject the promise
                });
        });

    } catch (error) { // Catches errors from download loop (if not caught internally and rethrown) or ffmpeg promise rejection
        console.error('Error in /api/merge-mp3s main try block:', error.message); // Log the actual error message
        if (!res.headersSent) { // Avoid sending response if FFmpeg error handler already did or download error already sent
            res.status(500).json({ error: "An unexpected server error occurred during MP3 merge process.", details: error.message });
        }
    } finally { // Main finally block
        console.log('Performing final cleanup for /api/merge-mp3s...');
        if (listFilePath) {
            try {
                if (fs.existsSync(listFilePath)) { // Check existence before unlinking
                    await fs.promises.unlink(listFilePath);
                    console.log('Cleaned up list file:', listFilePath);
                }
            } catch (err) {
                console.error('Error cleaning up list file:', listFilePath, err.message);
            }
        }
        for (const filePath of downloadedMp3Paths) {
            try {
                if (fs.existsSync(filePath)) { // Check existence
                    await fs.promises.unlink(filePath);
                    console.log('Cleaned up downloaded MP3:', filePath);
                }
            } catch (err) {
                console.error('Error cleaning up downloaded MP3:', filePath, err.message);
            }
        }
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