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

---

## API Usage

### `POST /api/generate-video`

This endpoint allows you to generate an MP4 video by combining a voice audio track, a background image, and an optional background music track. Files are sourced from publicly accessible Google Drive URLs.

**Request Body:** `application/json`

```json
{
  "urlVoz": "YOUR_GOOGLE_DRIVE_VOICE_AUDIO_URL",
  "urlImagen": "YOUR_GOOGLE_DRIVE_IMAGE_URL",
  "urlMusica": "YOUR_GOOGLE_DRIVE_MUSIC_AUDIO_URL" // Optional
}
```

**Parameters:**

*   `urlVoz` (string, required): A publicly accessible Google Drive URL for the voice audio file (e.g., MP3, WAV).
*   `urlImagen` (string, required): A publicly accessible Google Drive URL for the background image (e.g., JPG, PNG).
*   `urlMusica` (string, optional): A publicly accessible Google Drive URL for the background music file. If provided, it will be mixed with the voice audio. The background music volume is automatically lowered to ensure the voice is clear.

**Success Response:**

*   **Status Code:** `200 OK`
*   **Body:**
    ```json
    {
      "success": true,
      "videoUrl": "/uploads/video-GENERATED_UUID.mp4",
      "downloadUrl": "/download/GENERATED_UUID.mp4"
    }
    ```
    *   `videoUrl`: A URL path from which the generated video can be streamed or accessed if the server is configured to serve static files from the `uploads` directory.
    *   `downloadUrl`: (This might be a conceptual URL or may need a dedicated download endpoint if `/uploads` isn't directly browsable/servable for downloads). *Developer Note: The current `server.js` does not have an explicit `/download/:filename` route, so `videoUrl` is the primary way to access the file if static serving from `/uploads` is enabled.*

**Error Responses:**

*   **Status Code:** `400 Bad Request`
    *   If required fields (`urlVoz`, `urlImagen`) are missing.
    *   Example: `{"error": "Missing required URLs: urlVoz and urlImagen are required."}`
*   **Status Code:** `500 Internal Server Error`
    *   If there's an issue downloading files from the provided Google Drive URLs (e.g., URL is invalid, file not found, not publicly accessible).
    *   Example: `{"error": "Failed to download one or more files from Google Drive.", "details": "..."}`
    *   If FFmpeg encounters an error during video processing.
    *   Example: `{"error": "Error processing video", "details": "ffmpeg error message..."}`

**Notes:**

*   Ensure that the Google Drive links provided are set to "Anyone with the link can view" to allow the server to download them.
*   The server will temporarily download the files, process them, and then delete these temporary copies. The final generated video is stored in the `uploads` directory on the server.

---

### `POST /api/merge-mp3s`

This endpoint allows you to merge multiple MP3 audio files into a single MP3 file. Files are sourced from publicly accessible Google Drive URLs. The merging is done by concatenation without re-encoding, which is fast and preserves audio quality.

**Request Body:** `application/json`

```json
{
  "mp3Urls": [
    "YOUR_GOOGLE_DRIVE_MP3_URL_1",
    "YOUR_GOOGLE_DRIVE_MP3_URL_2",
    "YOUR_GOOGLE_DRIVE_MP3_URL_3"
  ]
}
```

**Parameters:**

*   `mp3Urls` (array of strings, required): An array of publicly accessible Google Drive URLs, each pointing to an MP3 file. You must provide at least two URLs. The order of URLs in the array determines the order of concatenation.

**Success Response:**

*   **Status Code:** `200 OK`
*   **Body:**
    ```json
    {
      "success": true,
      "mergedFileUrl": "/uploads/merged-audio-GENERATED_UUID.mp3",
      "message": "MP3 files merged successfully."
    }
    ```
    *   `mergedFileUrl`: A URL path from which the generated merged MP3 file can be accessed if the server is configured to serve static files from the `uploads` directory.

**Error Responses:**

*   **Status Code:** `400 Bad Request`
    *   If `mp3Urls` is missing, not an array, or contains fewer than two URLs.
        *   Example: `{"error": "Invalid request: mp3Urls must be an array of at least two Google Drive URLs."}`
    *   If any URL in `mp3Urls` is not a string or is malformed.
        *   Example: `{"error": "Invalid URL format provided.", "details": "The URL '...' is not valid: ..."}`
*   **Status Code:** `500 Internal Server Error`
    *   If there's an issue downloading one or more of the MP3 files (e.g., URL invalid, file not found, not publicly accessible).
        *   Example: `{"error": "Failed to download one or more MP3 files.", "details": "Error downloading from ...: ..."}`
    *   If FFmpeg encounters an error during the MP3 merging process.
        *   Example: `{"error": "Error merging MP3 files.", "details": "ffmpeg error message..."}`

**Notes:**

*   Ensure that the Google Drive links provided are set to "Anyone with the link can view" to allow the server to download them.
*   The server will temporarily download the individual MP3 files, create a temporary list file for FFmpeg, merge them, and then delete all temporary files. The final merged MP3 is stored in the `uploads` directory on the server.
*   The order of audio segments in the final merged MP3 will correspond to the order of their URLs in the `mp3Urls` array.

---
---

## Using with n8n

You can easily integrate this video generation API into your n8n workflows using the "HTTP Request" node.

**Workflow Example:**

A common workflow might involve:
1.  **Trigger Node:** (e.g., Webhook, Cron, Manual execution) to start the process.
2.  **Set Node (Optional):** To define the Google Drive URLs for your voice, image, and music files. Alternatively, these URLs could come from previous steps in your workflow (like a Google Sheet node, a form submission, etc.).
3.  **HTTP Request Node:** To call this API.
4.  **Handling Node (Optional):** To do something with the generated video URL (e.g., send an email, save to a database, pass to another service).

**HTTP Request Node Configuration:**

*   **Method:** `POST`
*   **URL:** `YOUR_SERVER_ADDRESS/api/generate-video` (e.g., `http://localhost:8080/api/generate-video` if running locally, or your production server URL)
*   **Authentication:** `None` (assuming no authentication is set up on the API endpoint itself)
*   **Send Body:** `true` (toggle on)
*   **Body Content Type:** `JSON`
*   **JSON Parameters:** `true` (toggle on) or use "Add Expression" for the body.

**Body / Parameters:**

Click on "Add Parameter" under JSON Parameters, or construct the JSON body using an expression.

*   **Key `urlVoz`**: Value should be an n8n expression pointing to your voice audio URL.
    *   Example: `{{ $json.voice_audio_url }}` or `{{ $('Set URLs').item.json.voice_url }}`
*   **Key `urlImagen`**: Value should be an n8n expression pointing to your background image URL.
    *   Example: `{{ $json.background_image_url }}`
*   **Key `urlMusica`** (Optional): Value should be an n8n expression pointing to your background music URL.
    *   Example: `{{ $json.background_music_url }}`

**Example JSON Body using "Expression" mode for the Body:**

```json
{
  "urlVoz": "{{ $('Set URLs').item.json.voice_url }}",
  "urlImagen": "{{ $('Set URLs').item.json.image_url }}",
  "urlMusica": "{{ $('Set URLs').item.json.music_url }}"
}
```
*(Adjust the expression `$('Set URLs').item.json.variable_name` based on the actual name of your node providing the URLs and how you're accessing the data.)*

**Options (under HTTP Request Node):**

*   **Response Format:** `JSON`
*   **Ignore Response Code:** You might want to keep this off initially to ensure you catch errors. The API returns `200 OK` on success.

**Accessing the Output:**

If the API call is successful, the HTTP Request node will output JSON containing `videoUrl` and `downloadUrl`. You can use these in subsequent nodes. For example, to get the video URL:

`{{ $('HTTP Request').item.json.videoUrl }}` (assuming your HTTP Request node is named "HTTP Request").

**Error Handling:**

*   If the API returns an error (e.g., 400 or 500), the HTTP Request node will fail by default (unless "Continue on Fail" is enabled in its settings). You can inspect the error details in the output of the failed node.
*   Consider adding error handling branches in your n8n workflow based on the success or failure of the HTTP Request node.

---
