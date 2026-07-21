import type { DrawSize, NanoImageSize } from "../../types";

const DEFAULT_SIZE: DrawSize = "auto";
const DEFAULT_NANO_IMAGE_SIZE: NanoImageSize = "4K";
const MIN_IMAGE_SIDE = 16;
const MAX_IMAGE_SIDE = 3840;
const MIN_IMAGE_PIXELS = 655360;
const MAX_IMAGE_PIXELS = 8294400;

const presetSizeOptions = new Set<string>([
  "auto",
  "1024x1024",
  "1792x1024",
  "1024x1792",
  "1:1",
  "3:2",
  "2:3",
  "16:9",
  "9:16",
  "1:2",
  "2:1",
  "4:3",
  "3:4",
  "5:4",
  "4:5",
  "21:9",
  "9:21",
  "1:4",
  "4:1",
  "1:8",
  "8:1"
]);

const isValidCustomSize = (width: number, height: number, maxAspectRatio?: number) => {
  const pixels = width * height;
  const sideRatio = Math.max(width, height) / Math.min(width, height);
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= MIN_IMAGE_SIDE &&
    height >= MIN_IMAGE_SIDE &&
    width <= MAX_IMAGE_SIDE &&
    height <= MAX_IMAGE_SIDE &&
    width % 16 === 0 &&
    height % 16 === 0 &&
    (!maxAspectRatio || sideRatio <= maxAspectRatio) &&
    pixels >= MIN_IMAGE_PIXELS &&
    pixels <= MAX_IMAGE_PIXELS
  );
};

export const normalizeSize = (value: unknown, maxAspectRatio?: number): DrawSize => {
  const size = String(value ?? "").trim() as DrawSize;
  if (presetSizeOptions.has(size)) return size;

  const customSize = /^(\d+)x(\d+)$/.exec(size);
  if (!customSize) return DEFAULT_SIZE;

  const width = Number(customSize[1]);
  const height = Number(customSize[2]);
  return isValidCustomSize(width, height, maxAspectRatio) ? `${width}x${height}` : DEFAULT_SIZE;
};

export const normalizeNanoImageSize = (value: unknown): NanoImageSize => {
  if (value === "1K" || value === "2K" || value === "4K") return value;
  return DEFAULT_NANO_IMAGE_SIZE;
};

const isRemoteImageUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/** 多米平台不接受 data URL，因此在任务入库前提前给出明确错误。 */
export const assertRemoteImageUrls = (imageUrls: string[]) => {
  if (imageUrls.some((imageUrl) => !isRemoteImageUrl(imageUrl))) {
    throw new Error("参考图只支持公网 http(s) 图片 URL，不能直接发送本地图片或 data URL");
  }
};
