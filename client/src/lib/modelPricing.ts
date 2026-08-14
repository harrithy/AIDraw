/**
 * 多米API 模型价格统一工具。
 * 价格数据来自多米API官方文档，按模型类型区分计费方式：
 * - Kling 视频：委托给 klingPricing（按固定时长查表或按秒计费）
 * - GROK 视频：按秒计费（720p），grok-video=0.04 元/秒、grok-video-1.5=0.05 元/秒
 * - 图片模型（gpt-image-2 / nano-banana 系列）：固定单价，按张计费
 */
import {
  formatKlingPrice,
  getKlingPrice,
  type KlingQuality,
  type KlingSound
} from "./klingPricing";

/** 图片模型固定单价（元/张），数据来自多米API官网 */
const FIXED_IMAGE_PRICES: Record<string, number> = {
  "gpt-image-2": 0.06,
  "gemini-2.5-flash-image": 0.05,
  "gemini-3-pro-image-preview": 0.15,
  "gemini-3.1-flash-image-preview": 0.1
};

/** GROK 视频模型每秒单价（元/秒），仅支持 720p 清晰度 */
const GROK_PER_SECOND_PRICES: Record<string, number> = {
  "grok-video": 0.04,
  "grok-video-1.5": 0.05
};

/**
 * 计算指定模型的预计价格。
 * - Kling 视频：委托 getKlingPrice，按模型系列查表或按秒计算
 * - GROK 视频：按「每秒单价 × duration」计算，结果保留两位小数
 * - 图片模型：直接返回固定单价，不受 mode / duration / sound 影响
 * - 其他模型返回 null
 * @param model - 模型名称（如 "gpt-image-2"、"grok-video-1.5"）
 * @param mode - 质量档位（std / pro），仅 Kling / GROK 视频使用
 * @param duration - 视频时长（秒），仅视频模型使用
 * @param sound - 音画同步开关，仅 Kling 视频使用
 * @returns 预计价格（元），无法计算时返回 null
 */
export const getModelPrice = (
  model: string,
  mode: KlingQuality,
  duration: number,
  sound: KlingSound
): number | null => {
  const klingPrice = getKlingPrice(model, mode, duration, sound);
  if (klingPrice !== null) return klingPrice;

  const grokPerSecond = GROK_PER_SECOND_PRICES[model];
  if (typeof grokPerSecond === "number") {
    if (!Number.isFinite(duration) || duration < 0) return null;
    return Math.round(grokPerSecond * duration * 100) / 100;
  }

  const fixedPrice = FIXED_IMAGE_PRICES[model];
  if (typeof fixedPrice === "number") return fixedPrice;

  return null;
};

/** 把价格格式化为带两位小数的展示文本，无法计算或非法值时返回 "价格未知" */
export const formatModelPrice = formatKlingPrice;
