# Video Assembler Studio

Una aplicación web para generar videos MP4 combinando imágenes de fondo, audio de voz y música de fondo opcional.

## Requisitos

- Node.js 18 o superior
- FFmpeg instalado en el sistema

### Instalar FFmpeg

#### Windows
1. Descarga FFmpeg desde https://ffmpeg.org/download.html
2. Extrae los archivos
3. Añade la carpeta bin al PATH del sistema

#### Linux
```bash
sudo apt update
sudo apt install ffmpeg
```

#### macOS
```bash
brew install ffmpeg
```

## Instalación

1. Clona el repositorio
2. Instala las dependencias:
```bash
npm install
```

## Uso

1. Inicia el servidor backend:
```bash
npm run server
```

2. En otra terminal, inicia el frontend:
```bash
npm run dev
```

3. Abre http://localhost:5173 en tu navegador

## API

### Generar Video
```
POST http://localhost:3001/api/generate-video
```

#### Parámetros (multipart/form-data)
- `bgMusic`: Archivo de música de fondo (opcional, MP3)
- `voiceAudio`: Archivo de audio de voz (requerido, MP3)
- `bgImage`: Archivo de imagen de fondo (requerido, JPG/PNG)

#### Respuesta
- Archivo MP4 generado

## Integración con n8n

Para integrar con n8n, puedes usar el nodo "HTTP Request" con la siguiente configuración:

1. Método: POST
2. URL: http://localhost:3001/api/generate-video
3. Headers: 
   - Content-Type: multipart/form-data
4. Body:
   - bgMusic: [Archivo MP3]
   - voiceAudio: [Archivo MP3]
   - bgImage: [Archivo JPG/PNG]

El nodo devolverá el archivo MP4 generado que puedes guardar o procesar según tus necesidades.
