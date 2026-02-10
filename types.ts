
export enum VideoMode {
  TEXT_TO_VIDEO = 'TEXT_TO_VIDEO',
  IMAGE_TO_VIDEO = 'IMAGE_TO_VIDEO',
  INTERPOLATION = 'INTERPOLATION',
  CONSISTENCY = 'CONSISTENCY'
}

export enum Resolution {
  R720P = '720p',
  R1080P = '1080p'
}

export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
  SQUARE = '1:1',
  SUPER_TALL = '1:2'
}

export interface GenerationHistory {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  mode: VideoMode;
  progress?: number;
  status?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  duration: string;
  concurrentLimit: number;
  promptLimit: number;
  subtitle: string;
  stitchTime: string;
  videoLimitText: string;
}

export interface UserProfile {
  email: string;
  accountType: string;
  expiryDate: string;
  usedCount: number;
  limitText: string;
  licenseInfo: string;
  machineId: string;
}
