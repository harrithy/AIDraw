import type { DrawFolder, DrawJob, UploadedImage } from "../../types";

/** 返回当前时间的 ISO 字符串，统一所有本地持久化时间格式。 */
export const nowIso = () => new Date().toISOString();

/** 创建浏览器端实体 ID，并兼容不支持 randomUUID 的浏览器。 */
export const createId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const sortFolders = (folders: DrawFolder[]) =>
  [...folders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const sortJobs = (jobs: DrawJob[]) =>
  [...jobs].sort(
    (a, b) => a.orderIndex - b.orderIndex || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

export const sortUploadedImages = (images: UploadedImage[]) =>
  [...images].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
