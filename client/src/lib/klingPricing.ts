/**
 * Kling（可灵）视频生成价格工具。
 * 价格数据来自多米官网，按模型系列区分计费方式：
 * - kling-v1 / kling-v1-5 / kling-v1-6：按固定时长查表（5s / 10s），价格不受音画同步影响
 * - kling-v3：按秒计费（0.48~0.96 元/秒），开启音画同步后单价上浮
 */

/** 音画同步开关：on=开启（有声），off=关闭（无声） */
export type KlingSound = "on" | "off";

/** Kling 质量档位：std=标准，pro=专业 */
export type KlingQuality = "std" | "pro";

/** kling-v1 固定时长价格表：质量档位 → 时长（秒） → 单价（元） */
const KLING_V1_PRICES: Record<KlingQuality, Record<number, number>> = {
  std: { 5: 0.8, 10: 1.6 },
  pro: { 5: 2.8, 10: 5.6 }
};

/** kling-v1-5 / kling-v1-6 固定时长价格表 */
const KLING_V1_5_6_PRICES: Record<KlingQuality, Record<number, number>> = {
  std: { 5: 1.6, 10: 3.2 },
  pro: { 5: 2.8, 10: 5.6 }
};

/** kling-v3 按秒单价表（元/秒）：质量档位 → 音画同步 → 每秒单价 */
const KLING_V3_PER_SECOND_PRICES: Record<KlingQuality, Record<KlingSound, number>> = {
  std: { on: 0.72, off: 0.48 },
  pro: { on: 0.96, off: 0.64 }
};

/** 按固定时长查表计费的 Kling 模型 */
const FIXED_DURATION_MODELS: Record<string, Record<KlingQuality, Record<number, number>>> = {
  "kling-v1": KLING_V1_PRICES,
  "kling-v1-5": KLING_V1_5_6_PRICES,
  "kling-v1-6": KLING_V1_5_6_PRICES
};

/**
 * 计算 Kling 视频任务的预计价格。
 * - kling-v1 / kling-v1-5 / kling-v1-6：按固定时长查表，duration 非 5/10 时返回 null
 * - kling-v3：按「每秒单价 × duration」计算，结果保留两位小数
 * - 其他模型或查表缺失时返回 null
 * @param model - 模型名称（如 "kling-v3"）
 * @param mode - 质量档位（std / pro）
 * @param duration - 视频时长（秒）
 * @param sound - 音画同步开关
 * @returns 预计价格（元），无法计算时返回 null
 */
export const getKlingPrice = (
  model: string,
  mode: KlingQuality,
  duration: number,
  sound: KlingSound
): number | null => {
  const fixedPriceTable = FIXED_DURATION_MODELS[model];
  if (fixedPriceTable) {
    return fixedPriceTable[mode]?.[duration] ?? null;
  }
  if (model === "kling-v3") {
    if (!Number.isFinite(duration) || duration < 0) return null;
    const perSecondPrice = KLING_V3_PER_SECOND_PRICES[mode]?.[sound];
    if (typeof perSecondPrice !== "number") return null;
    return Math.round(perSecondPrice * duration * 100) / 100;
  }
  return null;
};

/**
 * 把价格格式化为带两位小数的展示文本。
 * @param price - 价格（元），null 表示未知
 * @returns 例如 "¥0.80"、"¥2.40"；无法计算或非法值时返回 "价格未知"
 */
export const formatKlingPrice = (price: number | null): string => {
  if (price === null || !Number.isFinite(price) || price < 0) return "价格未知";
  return `¥${price.toFixed(2)}`;
};
