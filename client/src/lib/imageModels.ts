import type { ApiProviderId } from "../types";

export const GPT_IMAGE_MODEL = "gpt-image-2";
export const NANO_BANANA_MODEL = "gemini-3-pro-image-preview";
export const GROK_VIDEO_MODEL_1_5 = "grok-video-1.5";
export const GROK_VIDEO_MODEL_BASE = "grok-video";
export const GROK_VIDEO_MODEL = GROK_VIDEO_MODEL_1_5;
export const MAX_NANO_BANANA_REFERENCE_IMAGES = 10;

const duomiGptModelOptions = [
  { label: GPT_IMAGE_MODEL, value: GPT_IMAGE_MODEL }
] as const;

const duomiGrokModelOptions = [
  { label: "grok-video-1.5 (最新版)", value: GROK_VIDEO_MODEL_1_5 },
  { label: "grok-video", value: GROK_VIDEO_MODEL_BASE }
] as const;

const duomiKlingModelOptions = [
  { label: "kling-v3 (最新版)", value: "kling-v3" },
  { label: "kling-v1-6", value: "kling-v1-6" },
  { label: "kling-v1-5", value: "kling-v1-5" },
  { label: "kling-v1", value: "kling-v1" }
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
  { label: "gemini-3.1-flash-image-preview", value: "gemini-3.1-flash-image-preview" },
  { label: "gemini-3.1-flash-lite-image-preview", value: "gemini-3.1-flash-lite-image-preview" }
] as const;

const duomiImageModelGroups = [
  { label: "ChatGPT", options: duomiGptModelOptions },
  { label: "NANO-BANANA", options: duomiNanoBananaModelOptions },
  { label: "GROK 视频", options: duomiGrokModelOptions },
  { label: "KLING 视频", options: duomiKlingModelOptions }
] as const;

const grsaiImageModelGroups = [
  { label: "GPT Image", options: grsaiGptModelOptions },
  { label: "Nano Banana", options: grsaiNanoBananaModelOptions }
] as const;

/**
 * 根据 API 提供者返回对应的模型分组列表，供下拉选择器渲染。
 * Grsai 有独立的模型池（含 gpt-image-2-vip 和多款 nano-banana 变体），
 * 其余提供者统一使用 Duomi 的模型分组。
 * @param providerId - API 提供者标识（duomi / grsai）
 * @returns 模型分组数组，每组包含 label 和 options
 */
export const getImageModelGroups = (providerId: ApiProviderId) =>
  providerId === "grsai" ? grsaiImageModelGroups : duomiImageModelGroups;

/**
 * 项目中所有被认可的模型值联合类型，从各组模型选项中自动推导。
 * 用于类型收窄：确保 model 字段只能是下拉框中实际存在的选项之一。
 */
export type SupportedImageModel =
  | (typeof duomiGptModelOptions)[number]["value"]
  | (typeof duomiGrokModelOptions)[number]["value"]
  | (typeof duomiKlingModelOptions)[number]["value"]
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

/**
 * 校验模型值在指定提供者的模型列表中是否存在。
 * 与 isSupportedImageModel 不同，此函数按提供者分组校验，
 * 避免 Grsai 专属模型被错误地识别为 Duomi 可用。
 * @param model - 待校验的模型值
 * @param providerId - 目标 API 提供者
 */
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

/**
 * 判断模型是否属于 NANO-BANANA 系列（基于 Gemini 的图片生成模型）。
 * NANO-BANANA 使用独立的任务创建/轮询端点，与 GPT Image 接口路径不同。
 * @param model - 模型名称
 */
export const isNanoBananaModel = (model: string) => nanoBananaModels.has(model);

/**
 * 判断模型是否支持 NANO-BANANA 特有的输出分辨率字段（1K/2K/4K）。
 * 仅 NANO-BANANA 系列模型有此概念，GPT Image 模型使用传统的 size 参数。
 * @param model - 模型名称
 */
export const supportsNanoBananaImageSize = (model: string) => nanoBananaImageSizeModels.has(model);

/**
 * 判断是否为 Grsai 平台的 GPT Image VIP 模型。
 * VIP 模型支持更高的并发和更大的像素预算。
 * @param model - 模型名称
 */
export const isGptImageVipModel = (model: string) => model === "gpt-image-2-vip";

/**
 * 判断 NANO-BANANA 模型是否支持扩展宽高比（1:4、4:1、1:8、8:1 等极端比例）。
 * nano-banana-2 及其衍生变体（如 -2-cl、-2-2k-cl）支持这些极端比例，
 * 而初代 nano-banana 和 nano-banana-pro 不支持。
 * @param model - 模型名称
 */
export const supportsExtendedNanoAspectRatios = (model: string) =>
  /^nano-banana-2(?:-|$)/.test(model);

/**
 * 判断模型是否为 GROK 视频生成模型
 * @param model - 模型名称
 */
export const isGrokVideoModel = (model: string) =>
  model === GROK_VIDEO_MODEL_1_5 || model === GROK_VIDEO_MODEL_BASE;

/**
 * 判断模型是否为 KLING（可灵）视频生成模型
 * @param model - 模型名称
 */
export const isKlingVideoModel = (model: string) =>
  model === "kling-v1" || model === "kling-v1-5" || model === "kling-v1-6" || model === "kling-v3";

/**
 * 判断模型是否属于视频生成模型
 * @param model - 模型名称
 */
export const isVideoModel = (model: string) => isGrokVideoModel(model) || isKlingVideoModel(model);

