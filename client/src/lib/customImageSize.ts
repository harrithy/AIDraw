const CUSTOM_SIZE_STEP = 16;
const MIN_IMAGE_SIDE = 16;
const MAX_IMAGE_SIDE = 3840;
const MIN_IMAGE_PIXELS = 655360;
const MAX_IMAGE_PIXELS = 8294400;

/**
 * 返回距离当前尺寸最近且能被 16 整除的值。
 * 当上下两个候选值距离相同时，优先选择更大的值。
 */
const getNearestValidSide = (value: number) => Math.round(value / CUSTOM_SIZE_STEP) * CUSTOM_SIZE_STEP;

export type CustomSizeSuggestion = {
  width?: number;
  height?: number;
};

/** 返回需要修正的宽高及各自距离最近的合法值。 */
export const getCustomSizeSuggestion = (width: number, height: number): CustomSizeSuggestion | null => {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < MIN_IMAGE_SIDE || height < MIN_IMAGE_SIDE || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) {
    return null;
  }

  const suggestion: CustomSizeSuggestion = {};
  if (width % CUSTOM_SIZE_STEP !== 0) suggestion.width = getNearestValidSide(width);
  if (height % CUSTOM_SIZE_STEP !== 0) suggestion.height = getNearestValidSide(height);
  return suggestion.width === undefined && suggestion.height === undefined ? null : suggestion;
};

export const getCustomSizeError = (width: number, height: number, maxAspectRatio?: number) => {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return "自定义尺寸需要填写整数宽高";
  if (width < MIN_IMAGE_SIDE || height < MIN_IMAGE_SIDE || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) {
    return `自定义尺寸每条边需在 ${MIN_IMAGE_SIDE} 到 ${MAX_IMAGE_SIDE} 之间`;
  }

  const suggestion = getCustomSizeSuggestion(width, height);
  if (suggestion) {
    const invalidSideLabels: string[] = [];
    const nearestSides: string[] = [];
    if (suggestion.width !== undefined) {
      invalidSideLabels.push("宽");
      nearestSides.push(`宽 ${suggestion.width}`);
    }
    if (suggestion.height !== undefined) {
      invalidSideLabels.push("高");
      nearestSides.push(`高 ${suggestion.height}`);
    }
    return `自定义尺寸的${invalidSideLabels.join("和")}必须能被 ${CUSTOM_SIZE_STEP} 整除，最近可用值：${nearestSides.join("，")}`;
  }

  if (maxAspectRatio && Math.max(width, height) / Math.min(width, height) > maxAspectRatio) {
    return `自定义尺寸的长边与短边之比不能超过 ${maxAspectRatio}:1`;
  }

  const pixels = width * height;
  if (pixels < MIN_IMAGE_PIXELS || pixels > MAX_IMAGE_PIXELS) {
    return `自定义尺寸像素预算需在 ${MIN_IMAGE_PIXELS.toLocaleString("en-US")} 到 ${MAX_IMAGE_PIXELS.toLocaleString("en-US")} 之间`;
  }
  return "";
};
