import type { DrawJob, GeneratedAssetKind } from "../types";
import { isVideoModel } from "./imageModels";

/** 只取任务中和图片 URL 相关的字段 */
type JobImageFields = Pick<DrawJob, "outputImageUrl" | "outputImageUrls">;

/**
 * 获取任务的所有输出图片 URL 列表
 * 支持两种数据来源：
 * 1. `outputImageUrls` 数组 — 多次重绘的历史版本
 * 2. `outputImageUrl` 单值 — 最新/唯一的结果
 * 去重逻辑：如果数组末尾和单值 URL 相同，则只返回数组，避免重复
 * @param job - 带有图片 URL 字段的任务对象
 * @returns 去重后的图片 URL 列表
 */
export const getJobOutputImages = (job: JobImageFields) => {
  const outputImageUrls = (job.outputImageUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const currentImageUrl = job.outputImageUrl?.trim();

  // 如果 `outputImageUrl` 已经存在于数组末尾，不再重复添加
  if (!currentImageUrl || outputImageUrls[outputImageUrls.length - 1] === currentImageUrl) {
    return outputImageUrls;
  }

  return [...outputImageUrls, currentImageUrl];
};

type JobAssetFields = Pick<
  DrawJob,
  "outputAssets" | "outputKind" | "category" | "model"
>;

const visualOutputKinds = new Set<GeneratedAssetKind>(["image", "video"]);

/** 按实际资产、能力声明、URL 和旧模型依次判断结果资产类型。 */
export const getJobAssetKind = (
  job: JobAssetFields,
  mediaUrl?: string
): GeneratedAssetKind => {
  const normalizedUrl = mediaUrl?.trim();
  const declaredKind = normalizedUrl
    ? job.outputAssets?.find((asset) => asset.url?.trim() === normalizedUrl)?.kind
    : undefined;
  if (declaredKind) return declaredKind;

  if (
    job.outputKind === "image" ||
    job.outputKind === "video" ||
    job.outputKind === "audio" ||
    job.outputKind === "file"
  ) {
    return job.outputKind;
  }
  if (job.outputKind === "text" || job.outputKind === "data") return "file";
  if (job.category === "video") return "video";
  if (job.category === "image") return "image";
  if (job.category === "music") return "audio";
  if (/\.(?:mp4|webm|mov|m4v|m3u8)(?:[?#]|$)/i.test(normalizedUrl ?? "")) return "video";
  if (/\.(?:mp3|wav|m4a|aac|ogg|flac)(?:[?#]|$)/i.test(normalizedUrl ?? "")) return "audio";
  if (/\.(?:png|jpe?g|webp|gif|svg|avif)(?:[?#]|$)/i.test(normalizedUrl ?? "")) return "image";
  return isVideoModel(job.model) ? "video" : "image";
};

/** 仅在结果是可视媒体时返回图片或视频类型。 */
export const getJobVisualKind = (
  job: JobAssetFields,
  mediaUrl?: string
): "image" | "video" | undefined => {
  const assetKind = getJobAssetKind(job, mediaUrl);
  return visualOutputKinds.has(assetKind) ? assetKind as "image" | "video" : undefined;
};
