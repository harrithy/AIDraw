import type { ApiProviderId } from "../types";

export const GPT_IMAGE_MODEL = "gpt-image-2";
export const NANO_BANANA_MODEL = "gemini-3-pro-image-preview";
export const MAX_NANO_BANANA_REFERENCE_IMAGES = 10;

const duomiGptModelOptions = [
  { label: GPT_IMAGE_MODEL, value: GPT_IMAGE_MODEL }
] as const;

const grsaiGptModelOptions = [
  { label: GPT_IMAGE_MODEL, value: GPT_IMAGE_MODEL },
  { label: "gpt-image-2-vip", value: "gpt-image-2-vip" }
] as const;

const grsaiNanoBananaModelOptions = [
  { label: "nano-banana", value: "nano-banana" },
  { label: "nano-banana-fast", value: "nano-banana-fast" },
  { label: "nano-banana-2", value: "nano-banana-2" },
  { label: "nano-banana-2-cl", value: "nano-banana-2-cl" },
  { label: "nano-banana-2-2k-cl", value: "nano-banana-2-2k-cl" },
  { label: "nano-banana-2-4k-cl", value: "nano-banana-2-4k-cl" },
  { label: "nano-banana-pro", value: "nano-banana-pro" },
  { label: "nano-banana-pro-vt", value: "nano-banana-pro-vt" },
  { label: "nano-banana-pro-cl", value: "nano-banana-pro-cl" },
  { label: "nano-banana-pro-vip", value: "nano-banana-pro-vip" },
  { label: "nano-banana-pro-4k-vip", value: "nano-banana-pro-4k-vip" }
] as const;

const duomiNanoBananaModelOptions = [
  { label: "gemini-3-pro-image-preview", value: "gemini-3-pro-image-preview" },
  { label: "gemini-2.5-flash-image", value: "gemini-2.5-flash-image" },
  { label: "gemini-3.1-flash-image-preview", value: "gemini-3.1-flash-image-preview" }
] as const;

const duomiImageModelGroups = [
  { label: "ChatGPT", options: duomiGptModelOptions },
  { label: "NANO-BANANA", options: duomiNanoBananaModelOptions }
] as const;

const grsaiImageModelGroups = [
  { label: "GPT Image", options: grsaiGptModelOptions },
  { label: "Nano Banana", options: grsaiNanoBananaModelOptions }
] as const;

export const getImageModelGroups = (providerId: ApiProviderId) =>
  providerId === "grsai" ? grsaiImageModelGroups : duomiImageModelGroups;

export type SupportedImageModel =
  | (typeof duomiGptModelOptions)[number]["value"]
  | (typeof grsaiGptModelOptions)[number]["value"]
  | (typeof duomiNanoBananaModelOptions)[number]["value"]
  | (typeof grsaiNanoBananaModelOptions)[number]["value"];

const supportedImageModels = new Set<string>(
  [...duomiImageModelGroups, ...grsaiImageModelGroups].flatMap((group) =>
    group.options.map((option) => option.value)
  )
);

/** 校验本地草稿或历史任务中的模型值，避免无效值导致下拉框显示为空。 */
export const isSupportedImageModel = (model: unknown): model is SupportedImageModel =>
  typeof model === "string" && supportedImageModels.has(model);

export const isImageModelAvailableForProvider = (
  model: unknown,
  providerId: ApiProviderId
): model is SupportedImageModel =>
  typeof model === "string" &&
  getImageModelGroups(providerId).some((group) => group.options.some((option) => option.value === model));

const nanoBananaModels = new Set<string>([
  ...duomiNanoBananaModelOptions.map((option) => option.value),
  ...grsaiNanoBananaModelOptions.map((option) => option.value)
]);
const nanoBananaImageSizeModels = new Set<string>([
  ...duomiNanoBananaModelOptions.map((option) => option.value),
  ...grsaiNanoBananaModelOptions.map((option) => option.value)
]);

export const isNanoBananaModel = (model: string) => nanoBananaModels.has(model);

export const supportsNanoBananaImageSize = (model: string) => nanoBananaImageSizeModels.has(model);

export const isGptImageVipModel = (model: string) => model === "gpt-image-2-vip";

export const supportsExtendedNanoAspectRatios = (model: string) =>
  /^nano-banana-2(?:-|$)/.test(model);
