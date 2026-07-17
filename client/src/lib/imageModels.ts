export const GPT_IMAGE_MODEL = "gpt-image-2";
export const NANO_BANANA_MODEL = "gemini-3-pro-image-preview";
export const MAX_NANO_BANANA_REFERENCE_IMAGES = 10;

export const chatGptModelOptions = [
  { label: GPT_IMAGE_MODEL, value: GPT_IMAGE_MODEL }
] as const;

export const nanoBananaModelOptions = [
  { label: "gemini-3-pro-image-preview", value: "gemini-3-pro-image-preview" },
  { label: "gemini-2.5-flash-image", value: "gemini-2.5-flash-image" },
  { label: "gemini-3.1-flash-image-preview", value: "gemini-3.1-flash-image-preview" }
] as const;

export const imageModelGroups = [
  { label: "ChatGPT", options: chatGptModelOptions },
  { label: "NANO-BANANA", options: nanoBananaModelOptions }
] as const;

export type SupportedImageModel =
  | (typeof chatGptModelOptions)[number]["value"]
  | (typeof nanoBananaModelOptions)[number]["value"];

const supportedImageModels = new Set<string>(
  imageModelGroups.flatMap((group) => group.options.map((option) => option.value))
);

/** 校验本地草稿或历史任务中的模型值，避免无效值导致下拉框显示为空。 */
export const isSupportedImageModel = (model: unknown): model is SupportedImageModel =>
  typeof model === "string" && supportedImageModels.has(model);

const nanoBananaModels = new Set<string>([
  ...nanoBananaModelOptions.map((option) => option.value),
  // 兼容上一版可能已经保存到 IndexedDB 的说明别名。
  "nano-banana-pro",
  "nano-banana",
  "nano-banana-2"
]);
const nanoBananaImageSizeModels = new Set<string>([
  "gemini-3-pro-image-preview",
  "nano-banana-pro",
  "gemini-3.1-flash-image-preview",
  "nano-banana-2"
]);

export const isNanoBananaModel = (model: string) => nanoBananaModels.has(model);

export const supportsNanoBananaImageSize = (model: string) => nanoBananaImageSizeModels.has(model);
