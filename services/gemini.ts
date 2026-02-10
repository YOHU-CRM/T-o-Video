
import { GoogleGenAI, VideoGenerationReferenceType } from "@google/genai";
import { Resolution, AspectRatio, VideoMode } from "../types";

export interface VeoRequest {
  mode: VideoMode;
  prompt: string;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  images?: string[]; 
  previousVideo?: any; 
  negativePrompt?: string;
  onProgress?: (msg: string) => void;
  customApiKey?: string;
}

const getRawBase64 = (base64String: string) => {
  if (!base64String) return "";
  const parts = base64String.split(',');
  return parts.length > 1 ? parts[1] : parts[0];
};

const fetchVideoAsBlobUrl = async (uri: string, apiKey: string): Promise<string> => {
  try {
    const response = await fetch(`${uri}&key=${apiKey}`);
    if (!response.ok) throw new Error("Network error.");
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("Fetch blob failed:", err);
    return `${uri}&key=${apiKey}`; 
  }
};

export const generateVeoVideo = async ({
  mode,
  prompt,
  resolution,
  aspectRatio,
  images = [],
  previousVideo,
  onProgress,
  customApiKey
}: VeoRequest): Promise<any> => {
  const apiKey = customApiKey || process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing.");
  
  const ai = new GoogleGenAI({ apiKey });
  const model = (mode === VideoMode.CONSISTENCY || previousVideo) 
    ? 'veo-3.1-generate-preview' 
    : 'veo-3.1-fast-generate-preview';
  
  onProgress?.("Khởi tạo Cinema Engine...");

  let apiAspectRatio: "16:9" | "9:16" = "16:9";
  if (aspectRatio === AspectRatio.PORTRAIT || aspectRatio === AspectRatio.SUPER_TALL) {
    apiAspectRatio = "9:16";
  }

  try {
    let operation;

    if (previousVideo) {
      onProgress?.("Đang nối cảnh liên tục (Match Cut)...");
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt,
        video: previousVideo,
        config: { numberOfVideos: 1, resolution, aspectRatio: apiAspectRatio }
      });
    } else if (mode === VideoMode.CONSISTENCY && images.length > 0) {
      const referenceImages = images.map(img => ({
        image: { imageBytes: getRawBase64(img), mimeType: 'image/png' },
        referenceType: VideoGenerationReferenceType.ASSET
      }));
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt,
        config: { numberOfVideos: 1, referenceImages, resolution, aspectRatio: apiAspectRatio }
      });
    } else if (mode === VideoMode.IMAGE_TO_VIDEO && images.length > 0) {
      operation = await ai.models.generateVideos({
        model, prompt,
        image: { imageBytes: getRawBase64(images[0]), mimeType: 'image/png' },
        config: { numberOfVideos: 1, resolution, aspectRatio: apiAspectRatio }
      });
    } else if (mode === VideoMode.INTERPOLATION && images.length >= 2) {
      operation = await ai.models.generateVideos({
        model, prompt,
        image: { imageBytes: getRawBase64(images[0]), mimeType: 'image/png' },
        config: { 
          numberOfVideos: 1, resolution, aspectRatio: apiAspectRatio,
          lastFrame: { imageBytes: getRawBase64(images[1]), mimeType: 'image/png' }
        }
      });
    } else {
      operation = await ai.models.generateVideos({
        model, prompt,
        config: { numberOfVideos: 1, resolution, aspectRatio: apiAspectRatio }
      });
    }

    while (!operation.done) {
      await new Promise(r => setTimeout(r, 8000));
      operation = await ai.operations.getVideosOperation({ operation });
      onProgress?.("AI đang render khung hình...");
    }

    const videoRef = operation.response?.generatedVideos?.[0]?.video;
    const blobUrl = await fetchVideoAsBlobUrl(videoRef.uri, apiKey);
    
    return { finalUrl: blobUrl, videoRef: videoRef };
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};
