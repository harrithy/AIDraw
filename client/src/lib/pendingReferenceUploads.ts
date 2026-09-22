import type { PendingUploadItem } from "../types";
import { uploadRegistry } from "./uploadRegistry";

/**
 * 参考图后台上传的解析入口。
 * 调度器在提交任务前调用：等待任务登记的后台上传全部完成，
 * 并把占位地址（本地预览用的 blob: URL）按原位置回填成真实公网 URL。
 */

/** 从任务记录中解析出参考图 URL 列表：优先多图数组，其次单图字段。 */
export const resolveJobInputImageUrls = (
  inputImageUrls: string[] | undefined,
  inputImageUrl: string | undefined
): string[] => {
  if (inputImageUrls && inputImageUrls.length > 0) return [...inputImageUrls];
  return inputImageUrl ? [inputImageUrl] : [];
};

/**
 * 按占位地址回填后台上传的真实公网 URL，保持参考图原有顺序与数量。
 * 任何一张上传失败（或页面刷新导致上传记录丢失）都会抛出异常，由调用方标记任务失败。
 */
export const resolvePendingReferenceUrls = async (
  inputImageUrls: string[],
  pendingUploads: PendingUploadItem[]
): Promise<string[]> => {
  const uploadMap = new Map<string, string>();
  for (const item of pendingUploads) {
    const remoteUrl = await uploadRegistry.waitForUpload(item.uploadKey);
    uploadMap.set(item.placeholderUrl, remoteUrl);
  }
  return inputImageUrls.map((url) => uploadMap.get(url) || url);
};

/**
 * 兼容旧版仅登记 Key 的任务记录：上传结果按顺序整体替换参考图列表。
 */
export const resolvePendingReferenceKeys = async (
  pendingUploadKeys: string[],
  fallbackUrls: string[]
): Promise<string[]> => {
  const resolvedUrls = await uploadRegistry.waitForAll(pendingUploadKeys);
  return resolvedUrls.length > 0 ? resolvedUrls : fallbackUrls;
};

/** 任务是否仍在等待参考图后台上传完成。 */
export const hasPendingReferenceUploads = (
  pendingUploads: PendingUploadItem[] | undefined,
  pendingUploadKeys: string[] | undefined
): boolean =>
  Boolean(
    (pendingUploads && pendingUploads.length > 0) || (pendingUploadKeys && pendingUploadKeys.length > 0)
  );
