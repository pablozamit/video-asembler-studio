import React, { useState, useEffect, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { AudioPlayer } from './components/AudioPlayer';
import { ImagePreview } from './components/ImagePreview';
import { Spinner } from './components/Spinner';
import { generateImageFromPrompt } from './services/geminiService';
import { UploadIcon, ImageIcon, MusicNoteIcon, MicrophoneIcon, VideoCameraIcon, SparklesIcon, XCircleIcon } from './components/icons';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable is not set. Gemini API calls will fail.");
}

const App: React.FC = () => {
  const [bgMusic, setBgMusic] = useState<File | null>(null);
  const [voiceAudio, setVoiceAudio] = useState<File | null>(null);
  const [bgImage, setBgImage] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('A futuristic cityscape at sunset, cinematic lighting');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadingMessage, setInitialLoadingMessage] = useState<string | null>(null);
  const [voiceAudioDuration, setVoiceAudioDuration] = useState<number | null>(null);

  const bgMusicUrl = bgMusic ? URL.createObjectURL(bgMusic) : null;
  const voiceAudioUrl = voiceAudio ? URL.createObjectURL(voiceAudio) : null;
  const finalBgImageUrl = generatedImageUrl || (bgImage ? URL.createObjectURL(bgImage) : null);

  const fetchFileFromUrl = useCallback(async (url: string, defaultFileName: string, expectedTypePrefix: string): Promise<File | null> => {
    setInitialLoadingMessage(`Loading ${defaultFileName} from URL...`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}. URL: ${url}`);
      }
      const blob = await response.blob();
      if (!blob.type.startsWith(expectedTypePrefix)) {
        console.warn(`Fetched file from ${url} has unexpected MIME type: ${blob.type}. Expected ${expectedTypePrefix}*`);
        // Allow proceeding but log warning
      }
      
      let filename = defaultFileName;
      try {
          const urlPath = new URL(url).pathname;
          const parts = urlPath.split('/');
          const potentialFilename = parts[parts.length -1];
          if (potentialFilename && potentialFilename.includes('.')) { // Basic check for a filename with extension
              filename = decodeURIComponent(potentialFilename);
          }
      } catch (e) { 
          console.warn(`Could not parse filename from URL ${url}, using default: ${defaultFileName}`);
      }

      return new File([blob], filename, { type: blob.type });
    } catch (err) {
      console.error(`Error fetching file from URL ${url}:`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(prevError => `${prevError ? prevError + '\n' : ''}Failed to load file from ${url}. ${errorMessage}. Ensure the file is accessible and CORS policy is correctly configured on the server hosting the file.`);
      return null;
    } finally {
      setInitialLoadingMessage(null);
    }
  }, [setError]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bgMusicFileUrl = params.get('bgMusicUrl');
    const voiceAudioFileUrl = params.get('voiceAudioUrl');
    const bgImageFileUrl = params.get('bgImageUrl');
    let filesToLoad = 0;
    if (bgMusicFileUrl) filesToLoad++;
    if (voiceAudioFileUrl) filesToLoad++;
    if (bgImageFileUrl) filesToLoad++;

    if (filesToLoad === 0) return;

    const loadInitialFiles = async () => {
      if (bgMusicFileUrl) {
        const file = await fetchFileFromUrl(bgMusicFileUrl, 'background-music.mp3', 'audio/');
        if (file) setBgMusic(file);
      }
      if (voiceAudioFileUrl) {
        const file = await fetchFileFromUrl(voiceAudioFileUrl, 'voice-audio.mp3', 'audio/');
        if (file) setVoiceAudio(file);
      }
      if (bgImageFileUrl) {
        const file = await fetchFileFromUrl(bgImageFileUrl, 'background-image', 'image/'); // filename extension will be from blob
        if (file) {
          setBgImage(file);
          setGeneratedImageUrl(null); 
        }
      }
    };
    
    loadInitialFiles();
  }, [fetchFileFromUrl]);


  useEffect(() => {
    if (voiceAudio) {
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(voiceAudio);
      audio.src = objectUrl;
      audio.onloadedmetadata = () => {
        setVoiceAudioDuration(audio.duration);
        URL.revokeObjectURL(objectUrl);
      };
      audio.onerror = () => {
        setError("Failed to load voice audio metadata.");
        URL.revokeObjectURL(objectUrl);
      }
      return () => {
        if (audio.src.startsWith('blob:')) {
           URL.revokeObjectURL(audio.src);
        }
      };
    } else {
      setVoiceAudioDuration(null);
    }
  }, [voiceAudio]);

  useEffect(() => {
    let currentBgMusicUrl = bgMusicUrl;
    let currentVoiceAudioUrl = voiceAudioUrl;
    let currentFinalBgImageUrl = finalBgImageUrl;

    return () => {
      if (currentBgMusicUrl && currentBgMusicUrl.startsWith('blob:')) URL.revokeObjectURL(currentBgMusicUrl);
      if (currentVoiceAudioUrl && currentVoiceAudioUrl.startsWith('blob:')) URL.revokeObjectURL(currentVoiceAudioUrl);
      if (bgImage && currentFinalBgImageUrl && currentFinalBgImageUrl.startsWith('blob:')) {
         URL.revokeObjectURL(currentFinalBgImageUrl);
      }
    };
  }, [bgMusicUrl, voiceAudioUrl, bgImage, finalBgImageUrl]);


  const handleImageGenerate = useCallback(async () => {
    if (!imagePrompt.trim()) {
      setError("Please enter a prompt for image generation.");
      return;
    }
    if (!process.env.API_KEY) {
      setError("API Key is not configured. Cannot generate image.");
      return;
    }
    setIsLoadingImage(true);
    setError(null);
    setBgImage(null); 
    setGeneratedImageUrl(null);

    try {
      const base64ImageData = await generateImageFromPrompt(imagePrompt);
      setGeneratedImageUrl(`data:image/jpeg;base64,${base64ImageData}`);
    } catch (err) {
      console.error("Image generation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to generate image. Check console for details.");
    } finally {
      setIsLoadingImage(false);
    }
  }, [imagePrompt]);

  const handleCreateVideo = useCallback(async () => {
    if (!voiceAudio) {
      setError("Voice audio is required to determine video duration.");
      return;
    }
    if (!finalBgImageUrl) {
      setError("A background image (uploaded or generated) is required.");
      return;
    }

    setIsLoadingVideo(true);
    setError(null);

    try {
      const formData = new FormData();
      
      // Convertir la imagen generada a File si es necesario
      if (generatedImageUrl) {
        const response = await fetch(generatedImageUrl);
        const blob = await response.blob();
        const imageFile = new File([blob], 'generated-image.jpg', { type: 'image/jpeg' });
        formData.append('bgImage', imageFile);
      } else if (bgImage) {
        formData.append('bgImage', bgImage);
      }

      if (voiceAudio) {
        formData.append('voiceAudio', voiceAudio);
      }

      if (bgMusic) {
        formData.append('bgMusic', bgMusic);
      }

      const response = await fetch('http://localhost:3001/api/generate-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error al generar el video: ${response.statusText}`);
      }

      // Descargar el video generado
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'video.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      console.error("Error al generar el video:", err);
      setError(err instanceof Error ? err.message : "Error al generar el video");
    } finally {
      setIsLoadingVideo(false);
    }
  }, [voiceAudio, finalBgImageUrl, bgMusic, generatedImageUrl, bgImage]);
  
  const clearFile = (setter: React.Dispatch<React.SetStateAction<File | null>>, type: 'bgMusic' | 'voiceAudio' | 'bgImage') => {
    setter(null);
    if (type === 'bgImage') setGeneratedImageUrl(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-4xl bg-slate-800/70 shadow-2xl rounded-xl p-6 sm:p-10 backdrop-blur-md">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-sky-400 flex items-center justify-center space-x-3">
            <VideoCameraIcon className="w-10 h-10" />
            <span>Video Assembler Studio</span>
          </h1>
          <p className="text-slate-400 mt-3 text-sm sm:text-base">
            Upload your assets, generate an AI background, or provide URLs to conceptualize your video.
          </p>
        </header>

        {initialLoadingMessage && (
           <div className="bg-blue-500/30 border border-blue-700 text-blue-200 px-4 py-3 rounded-lg relative mb-6 text-sm flex items-center" role="status">
            <Spinner className="w-5 h-5 mr-2 text-blue-400" />
            <span>{initialLoadingMessage}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 text-sm flex items-start whitespace-pre-wrap" role="alert">
            <XCircleIcon className="w-5 h-5 mr-2 mt-0.5 text-red-400 flex-shrink-0" />
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-1 right-1 p-2 text-red-300 hover:text-red-100">
              <XCircleIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <Section title="Background Music (Optional)" icon={<MusicNoteIcon className="w-6 h-6 text-sky-400" />}>
              <FileUpload
                id="bg-music-upload"
                label="Upload MP3 Audio"
                accept=".mp3"
                file={bgMusic}
                onChange={setBgMusic}
                onClear={() => clearFile(setBgMusic, 'bgMusic')}
              />
              {bgMusicUrl && <AudioPlayer src={bgMusicUrl} />}
            </Section>

            <Section title="Voice Audio (Required)" icon={<MicrophoneIcon className="w-6 h-6 text-sky-400" />}>
              <FileUpload
                id="voice-audio-upload"
                label="Upload MP3 Audio"
                accept=".mp3"
                file={voiceAudio}
                onChange={setVoiceAudio}
                onClear={() => clearFile(setVoiceAudio, 'voiceAudio')}
              />
              {voiceAudioUrl && <AudioPlayer src={voiceAudioUrl} />}
              {voiceAudioDuration !== null && (
                <p className="text-xs text-slate-400 mt-2">
                  Duration: {voiceAudioDuration.toFixed(2)} seconds. This will be the target video length.
                </p>
              )}
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="Background Image (Required)" icon={<ImageIcon className="w-6 h-6 text-sky-400" />}>
              <FileUpload
                id="bg-image-upload"
                label="Upload Image (JPG, PNG)"
                accept="image/jpeg,image/png,image/webp,image/gif"
                file={bgImage}
                onChange={(file) => { setBgImage(file); if(file) setGeneratedImageUrl(null); }}
                onClear={() => clearFile(setBgImage, 'bgImage')}
              />
              
              <div className="text-center my-3 text-sm text-slate-500">OR</div>

              <div className="space-y-3">
                <label htmlFor="image-prompt" className="block text-sm font-medium text-slate-300">
                  Generate with AI:
                </label>
                <textarea
                  id="image-prompt"
                  rows={3}
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 placeholder-slate-400 text-sm"
                  placeholder="e.g., A serene beach at sunset with palm trees"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  aria-label="AI Image Generation Prompt"
                />
                <button
                  onClick={handleImageGenerate}
                  disabled={isLoadingImage || !process.env.API_KEY}
                  className={`w-full flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${!process.env.API_KEY ? 'bg-slate-500 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500'} disabled:opacity-70 transition-colors`}
                >
                  {isLoadingImage ? <Spinner className="w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                  Generate Image
                </button>
                {!process.env.API_KEY && <p className="text-xs text-amber-400 mt-1">API Key not set. Generation disabled.</p>}
              </div>
            </Section>
            
            {finalBgImageUrl && (
                <ImagePreview src={finalBgImageUrl} alt="Background" />
            )}
          </div>
        </div>
        
        <div className="mt-10 text-center">
          <button
            onClick={handleCreateVideo}
            disabled={isLoadingVideo || !voiceAudio || !finalBgImageUrl}
            className="px-8 py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 text-lg flex items-center justify-center mx-auto"
          >
            {isLoadingVideo ? <Spinner className="w-6 h-6 mr-3" /> : <VideoCameraIcon className="w-6 h-6 mr-3" />}
            Assemble Video (Simulate)
          </button>
          {(!voiceAudio || !finalBgImageUrl) && <p className="text-xs text-slate-400 mt-2">Please provide voice audio and a background image.</p>}
        </div>

        <footer className="mt-12 text-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} Video Assembler Studio. All rights reserved (simulation).</p>
          <p className="mt-1">Note: This application simulates video assembly. Actual MP4 generation is a complex backend process.</p>
          <div className="mt-2 bg-slate-700/50 p-3 rounded-md">
            <h3 className="font-semibold text-slate-300 mb-1">Using with Automation Platforms (n8n, Make.com):</h3>
            <p className="text-left">This application is frontend-only. To provide files programmatically:</p>
            <ol className="list-decimal list-inside text-left text-slate-400 text-xs mt-1 space-y-0.5">
              <li>Upload your files to a publicly accessible URL. Ensure the server hosting files has CORS (Cross-Origin Resource Sharing) headers correctly configured (e.g., <code className="bg-slate-600 px-1 rounded text-sky-300">Access-Control-Allow-Origin: *</code>).</li>
              <li>Construct this application's URL with query parameters:
                <br />
                <code className="bg-slate-600 px-1 rounded text-sky-300 break-all select-all">
                  ?bgMusicUrl=YOUR_MUSIC_URL&amp;voiceAudioUrl=YOUR_VOICE_URL&amp;bgImageUrl=YOUR_IMAGE_URL
                </code>
              </li>
              <li>Opening this constructed URL will make the app attempt to load the files.</li>
            </ol>
             <p className="text-left mt-1">All parameters are optional. Example URL for voice audio and image only: <code className="bg-slate-600 px-1 rounded text-sky-300 break-all select-all">?voiceAudioUrl=...&amp;bgImageUrl=...</code></p>
          </div>
        </footer>
      </div>
    </div>
  );
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, children }) => (
  <div className="p-5 bg-slate-800/80 rounded-lg shadow-md">
    <h2 className="text-lg font-semibold text-sky-300 mb-4 flex items-center">
      {icon}
      <span className="ml-2">{title}</span>
    </h2>
    {children}
  </div>
);

export default App;
