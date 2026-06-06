export type DrawMode = "text-to-image" | "image-to-image";

export type DrawJobStatus = "pending" | "running" | "completed" | "failed";

export type DrawFolder = {
  id: string;
  name: string;
  canvasZoom: number;
  canvasPanX: number;
  canvasPanY: number;
  createdAt: string;
  updatedAt: string;
};

export type DrawJob = {
  id: string;
  folderId: string;
  mode: DrawMode;
  status: DrawJobStatus;
  prompt: string;
  negativePrompt: string;
  inputImageUrl?: string;
  outputImageUrl?: string;
  width: number;
  height: number;
  count: number;
  strength?: number;
  thinking: "high" | "medium" | "low" | "standard";
  model: string;
  orderIndex: number;
  /** 🐱 画布自由拖拽：卡片在画布坐标系中的 X 坐标 */
  posX: number;
  /** 🐱 画布自由拖拽：卡片在画布坐标系中的 Y 坐标 */
  posY: number;
  /** 是否已经由用户手动拖动过位置 */
  hasCustomPosition?: boolean;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type QueueStats = {
  maxConcurrent: number;
  running: number;
  pending: number;
};

export type ImageProviderStatus = {
  textToImage: "nowcoding" | "mock";
  imageToImage: "mock";
  hasNowcodingKey: boolean;
  nowcodingBaseUrl: string;
  nowcodingModel: string;
  apiKeyMasked: string;
  usesSavedConfig: boolean;
};

export type HealthPayload = {
  ok: boolean;
  queue: QueueStats;
  imageProvider: ImageProviderStatus;
};

export type CreateJobPayload = {
  mode: DrawMode;
  prompt: string;
  inputImageUrl?: string;
  width: number;
  height: number;
  count: number;
  strength?: number;
  thinking?: "high" | "medium" | "low" | "standard";
  model?: string;
};

export type ImageProviderSettings = {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
};

export type UpdateImageProviderSettingsPayload = {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  clearApiKey?: boolean;
};
