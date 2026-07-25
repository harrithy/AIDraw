import type { DrawFolder, DrawJob, UploadedImage } from "../../types";

/** 返回当前时间的 ISO 字符串，统一所有本地持久化时间格式。 */
export const nowIso = () => new Date().toISOString();

/** 创建浏览器端实体 ID，并兼容不支持 randomUUID 的浏览器。 */
export const createId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * 按创建时间倒序排列文件夹（最新的在前）。
 * 返回新数组，不修改原数组。
 * @param folders - 文件夹数组
 * @returns 排序后的新数组
 */
export const sortFolders = (folders: DrawFolder[]) =>
  [...folders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

/**
 * 按 orderIndex 升序排列任务，orderIndex 相同时按创建时间升序。
 * orderIndex 由用户在画布上拖拽排序决定，保证手动排序稳定。
 * 返回新数组，不修改原数组。
 * @param jobs - 任务数组
 * @returns 排序后的新数组
 */
export const sortJobs = (jobs: DrawJob[]) =>
  [...jobs].sort(
    (a, b) => a.orderIndex - b.orderIndex || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

/**
 * 按创建时间倒序排列已上传图片（最新上传的在前）。
 * 返回新数组，不修改原数组。
 * @param images - 已上传图片数组
 * @returns 排序后的新数组
 */
export const sortUploadedImages = (images: UploadedImage[]) =>
  [...images].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
