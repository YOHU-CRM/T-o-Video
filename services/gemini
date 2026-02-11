import { GoogleGenerativeAI } from "@google/generative-ai";

interface VeoRequest {
  mode: string;
  prompt: string;
  resolution: string;
  aspectRatio: string;
  images?: string[];
  previousVideo?: any;
  negativePrompt?: string;
  onProgress?: (msg: string) => void;
  userPackage: "free" | "pro1" | "pro9";  // Thêm cái này để biết gói
}
const KEY_PRO1 = import.meta.env.VITE_GOOGLE_KEY_PRO1 || "";
const KEY_PRO9 = import.meta.env.VITE_GOOGLE_KEY_PRO9 || "";

let concurrentQueue = 0;

const getMaxConcurrent = (pkg: string) => {
  if (pkg === "pro9") return 5;
  if (pkg === "pro1") return 3;
  return 1; // free
};

const getModelName = (pkg: string, mode: string, previousVideo: any) => {
  if (pkg === "pro9") return "veo-3.1-generate-preview"; // full chất lượng cao
  return "veo-3.1-fast-generate-preview"; // nhanh hơn cho pro1 và free
};

const getRawBase64 = (base64String: string) => {
  if (!base64String) return "";
  const parts = base64String.split(',');
  return parts.length > 1 ? parts[1] : parts[0];
};

const fetchVideoAsBlobUrl = async (uri: string, apiKey: string): Promise<string> => {
  try {
    const response = await fetch(`${uri}&key=${apiKey}`);
    if (!response.ok) throw new Error("Lỗi mạng");
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
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
  userPackage = "free",
  customKey // chỉ dùng cho free
}: VeoRequest & { customKey?: string }): Promise<any> => {

  let apiKey = customKey;
  if (userPackage === "pro1") apiKey = KEY_PRO1;
  if (userPackage === "pro9") apiKey = KEY_PRO9;

  if (!apiKey) throw new Error("Chưa có key");

  const maxConcurrent = getMaxConcurrent(userPackage);
  if (concurrentQueue >= maxConcurrent) throw new Error(`Gói này chỉ chạy tối đa ${maxConcurrent} video cùng lúc`);

  concurrentQueue++;

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = getModelName(userPackage, mode, previousVideo);

  onProgress?.("Đang khởi động...");

  let apiAspectRatio: "16:9" | "9:16" = "16:9";
  if (aspectRatio === "PORTRAIT" || aspectRatio === "SUPER_TALL") apiAspectRatio = "9:16";

  // Giới hạn nét cho free
  const finalResolution = userPackage === "free" ? "720" : resolution;

  try {
    let operation;

    // Copy gần như nguyên logic từ file cũ của bạn (các if else mode)
    // Chỉ thay model và resolution
    if (previousVideo) {
      operation = await genAI.getGenerativeModel({ model: "veo-3.1-generate-preview" }).generateVideos({ /* config giống cũ */ });
      // Bạn copy paste phần gọi API từ file cũ vào đây, thay model và resolution
    } else {
      // Copy hết các case từ file cũ (IMAGE_TO_VIDEO, INTERPOLATION, CONSISTENCY, text-to-video)
      // Chỉ thay resolution = finalResolution, model = modelName
    }

    // Polling chạy ở browser (thoải mái vài phút)
    while (!operation.done) {
      await new Promise(r => setTimeout(r, 8000));
      operation = await genAI.getOperation({ name: operation.name }); // hoặc cách lấy operation đúng SDK
      onProgress?.("Đang render khung hình...");
    }

    const videoRef = operation.response?.generatedVideos?.[0]?.video;
    const blobUrl = await fetchVideoAsBlobUrl(videoRef.uri, apiKey);

    concurrentQueue--;
    return { finalUrl: blobUrl, videoRef };
  } catch (error) {
    concurrentQueue--;
    throw error;
  }
};
