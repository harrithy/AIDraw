import type { DrawFolder, DrawJob } from "../types";
import { getJobAssetKind, getJobOutputImages } from "./jobImages";

/** 当前保留的生成图片总数及各文件夹的图片数量。 */
export type GeneratedImageStats = {
  total: number;
  byFolderId: ReadonlyMap<string, number>;
};

/** 合并历史版本和当前资产，同一任务内相同的图片 URL 只统计一次。 */
const countJobImages = (job: DrawJob): number => {
  const imageUrls = new Set<string>();
  for (const url of getJobOutputImages(job)) {
    if (getJobAssetKind(job, url) === "image") imageUrls.add(url);
  }
  for (const asset of job.outputAssets ?? []) {
    const url = asset.url?.trim();
    if (asset.kind === "image" && url) imageUrls.add(url);
  }
  return imageUrls.size;
};

/** 只汇总现有文件夹；重绘进行中或失败时仍保留已生成的历史图片数量。 */
export const getGeneratedImageStats = (
  folders: readonly DrawFolder[],
  jobs: readonly DrawJob[]
): GeneratedImageStats => {
  const byFolderId = new Map(folders.map((folder) => [folder.id, 0]));
  let total = 0;
  for (const job of jobs) {
    const folderCount = byFolderId.get(job.folderId);
    if (folderCount === undefined) continue;
    const count = countJobImages(job);
    byFolderId.set(job.folderId, folderCount + count);
    total += count;
  }
  return { total, byFolderId };
};
