import type { PendingUploadItem } from "../types";
import { uploadMediaToHost } from "./imageHost";
import { uploadRegistry } from "./uploadRegistry";

/**
 * 参考图后台上传的解析入口。
 * 调度器在提交任务前调用：等待任务登记的后台上传全部完成，
 * 并把占位地址（本地预览用的 blob: URL）按原位置回填成真实公网 URL。
 */

export const isRemoteReferenceUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * 若内存中丢失了 uploadKey（如误删输入项或热更新重置），但当前标签页内的 blob: 预览地址仍然存活，
 * 则尝试直接从 blob: 地址读取文件并重新上传到图床。
 */
const tryRecoverBlobUpload = async (
  placeholderUrl: string,
  uploadKey: string
): Promise<string | null> => {
  if (!placeholderUrl.startsWith("blob:") || typeof fetch !== "function") {
    return null;
  }
  try {
    const response = await fetch(placeholderUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob || blob.size === 0) return null;
    const ext = blob.type.split("/")[1]?.split(";")[0] || "png";
    const file = new File([blob], `reference.${ext}`, { type: blob.type || "image/png" });
    const uploadPromise = uploadMediaToHost(file);
    uploadRegistry.registerUpload(uploadKey, uploadPromise, () => uploadMediaToHost(file));
    return await uploadPromise;
  } catch {
    return null;
  }
};

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
 * 若参考图地址已全部是远程 URL（不再包含对应的占位地址），自动跳过残留的待上传项；
 * 任何一张仍需回填的本地参考图上传失败（或页面刷新导致上传记录与 blob 均丢失）都会抛出异常。
 */
export const resolvePendingReferenceUrls = async (
  inputImageUrls: string[],
  pendingUploads: PendingUploadItem[]
): Promise<string[]> => {
  const uploadMap = new Map<string, string>();
  const activeUrls = new Set(inputImageUrls);

  for (const item of pendingUploads) {
    if (activeUrls.size > 0 && !activeUrls.has(item.placeholderUrl)) {
      continue;
    }

    if (!uploadRegistry.hasUpload(item.uploadKey)) {
      if (isRemoteReferenceUrl(item.placeholderUrl)) {
        uploadMap.set(item.placeholderUrl, item.placeholderUrl);
        continue;
      }
      const recoveredUrl = await tryRecoverBlobUpload(item.placeholderUrl, item.uploadKey);
      if (recoveredUrl) {
        uploadMap.set(item.placeholderUrl, recoveredUrl);
        continue;
      }
    }

    const remoteUrl = await uploadRegistry.waitForUpload(item.uploadKey);
    uploadMap.set(item.placeholderUrl, remoteUrl);
  }
  return inputImageUrls.map((url) => uploadMap.get(url) || url);
};

/**
 * 兼容旧版仅登记 Key 的任务记录：上传结果按顺序整体替换参考图列表。
 * 若 fallbackUrls 已全部是远程公网 URL 且内存无对应上传记录，则直接使用已有的远程 URL。
 */
export const resolvePendingReferenceKeys = async (
  pendingUploadKeys: string[],
  fallbackUrls: string[]
): Promise<string[]> => {
  if (
    fallbackUrls.length > 0 &&
    fallbackUrls.every(isRemoteReferenceUrl) &&
    pendingUploadKeys.some((key) => !uploadRegistry.hasUpload(key))
  ) {
    return fallbackUrls;
  }
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

/**
 * 同步任务记录中的已上传结果并剔除不再被引用的残留待上传项。
 * 在任务重试、失败收敛或重新调度前调用，避免残留的旧 uploadKey 导致重复报错。
 */
export const syncJobReferenceUploads = (
  inputImageUrls: string[] | undefined,
  inputImageUrl: string | undefined,
  pendingUploads: PendingUploadItem[] | undefined,
  pendingUploadKeys: string[] | undefined,
  options?: { retryFailed?: boolean }
): {
  inputImageUrls: string[];
  inputImageUrl: string | undefined;
  pendingUploads: PendingUploadItem[] | undefined;
  pendingUploadKeys: string[] | undefined;
} => {
  const currentUrls = resolveJobInputImageUrls(inputImageUrls, inputImageUrl);
  if (!hasPendingReferenceUploads(pendingUploads, pendingUploadKeys)) {
    return {
      inputImageUrls: currentUrls,
      inputImageUrl: currentUrls[0],
      pendingUploads: undefined,
      pendingUploadKeys: undefined
    };
  }

  if (pendingUploads && pendingUploads.length > 0) {
    const resolvedMap = new Map<string, string>();
    const remainingUploads: PendingUploadItem[] = [];

    for (const item of pendingUploads) {
      if (options?.retryFailed) {
        uploadRegistry.retryFailedUpload(item.uploadKey);
      }
      const resolved = uploadRegistry.getResolvedUrl(item.uploadKey);
      if (resolved) {
        resolvedMap.set(item.placeholderUrl, resolved);
      } else {
        remainingUploads.push(item);
      }
    }

    const nextUrls = currentUrls.map((url) => resolvedMap.get(url) || url);
    const activeUrlSet = new Set(nextUrls);
    const activeRemaining = remainingUploads.filter(
      (item) => activeUrlSet.has(item.placeholderUrl) && !isRemoteReferenceUrl(item.placeholderUrl)
    );

    return {
      inputImageUrls: nextUrls,
      inputImageUrl: nextUrls[0],
      pendingUploads: activeRemaining.length > 0 ? activeRemaining : undefined,
      pendingUploadKeys:
        activeRemaining.length > 0 ? activeRemaining.map((item) => item.uploadKey) : undefined
    };
  }

  if (pendingUploadKeys && pendingUploadKeys.length > 0) {
    if (options?.retryFailed) {
      pendingUploadKeys.forEach((key) => uploadRegistry.retryFailedUpload(key));
    }
    if (currentUrls.length > 0 && currentUrls.every(isRemoteReferenceUrl)) {
      return {
        inputImageUrls: currentUrls,
        inputImageUrl: currentUrls[0],
        pendingUploads: undefined,
        pendingUploadKeys: undefined
      };
    }
    const allResolved = pendingUploadKeys.every((key) => Boolean(uploadRegistry.getResolvedUrl(key)));
    if (allResolved) {
      const nextUrls = pendingUploadKeys.map((key) => uploadRegistry.getResolvedUrl(key)!);
      return {
        inputImageUrls: nextUrls,
        inputImageUrl: nextUrls[0],
        pendingUploads: undefined,
        pendingUploadKeys: undefined
      };
    }
  }

  return {
    inputImageUrls: currentUrls,
    inputImageUrl: currentUrls[0],
    pendingUploads,
    pendingUploadKeys
  };
};

/**
 * 判断当前标签页是否具备解析该任务待上传参考图的能力（或该任务已无需等待上传）。
 * 用于避免多标签页场景下其它后台标签页抢占刚创建且仍在当前标签页上传中的任务。
 */
export const canResolvePendingReferenceUploadsLocally = (
  inputImageUrls: string[] | undefined,
  inputImageUrl: string | undefined,
  pendingUploads: PendingUploadItem[] | undefined,
  pendingUploadKeys: string[] | undefined
): boolean => {
  if (!hasPendingReferenceUploads(pendingUploads, pendingUploadKeys)) return true;
  const synced = syncJobReferenceUploads(inputImageUrls, inputImageUrl, pendingUploads, pendingUploadKeys);
  if (!hasPendingReferenceUploads(synced.pendingUploads, synced.pendingUploadKeys)) return true;
  const keys = synced.pendingUploads?.map((item) => item.uploadKey) ?? synced.pendingUploadKeys ?? [];
  return keys.every((key) => uploadRegistry.hasUpload(key));
};
