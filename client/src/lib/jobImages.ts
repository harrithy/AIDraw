import type { DrawJob } from "../types";

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
