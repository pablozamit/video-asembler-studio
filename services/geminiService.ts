

// Fix: Changed GenerateImageResponse to GenerateImagesResponse
import { GoogleGenAI, GenerateImagesResponse } from "@google/genai";

// Ensure process.env.API_KEY is available.
// The App.tsx handles the warning if it's not set.
// Here, we assume it might be set by the time this function is called.
const getApiKey = (): string => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY environment variable is not set.");
    throw new Error("API Key is not configured. Please set the API_KEY environment variable.");
  }
  return apiKey;
};


export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Fix: Changed GenerateImageResponse to GenerateImagesResponse
    const response: GenerateImagesResponse = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002', // Correct model for image generation
      prompt: prompt,
      config: { numberOfImages: 1, outputMimeType: 'image/jpeg' }, // Ensure JPEG for broader compatibility or PNG
    });

    if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return base64ImageBytes; // This is already a base64 string
    } else {
      throw new Error("No image generated or image data is missing in the response.");
    }
  } catch (error) {
    console.error("Error generating image with Gemini API:", error);
    if (error instanceof Error) {
        // Check for specific Gemini API error messages if available
        if (error.message.includes("API key not valid")) {
            throw new Error("Invalid API Key. Please check your API_KEY environment variable.");
        }
        if (error.message.includes("quota")) {
            throw new Error("API quota exceeded. Please check your Google AI Studio project quotas.");
        }
    }
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`);
  }
};