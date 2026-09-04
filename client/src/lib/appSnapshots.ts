import type { DrawJob, ImageProviderSettings, QueueStats } from "../types";

/** 获取任务最近一次生成结果的时间，用于判断哪个结果盒子最新。 */
export const getLatestOutputTime = (job: DrawJob): number => {
  const timestamp = Date.parse(job.completedAt ?? job.updatedAt ?? job.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

/** 轮询结果没有实际变化时复用原数组，避免无意义的全画布渲染。 */
export const areJobSnapshotsEqual = (current: DrawJob[], next: DrawJob[]): boolean =>
  current.length === next.length &&
  current.every(
    (job, index) =>
      job.id === next[index]?.id &&
      job.updatedAt === next[index]?.updatedAt &&
      job.posX === next[index]?.posX &&
      job.posY === next[index]?.posY &&
      job.hasCustomPosition === next[index]?.hasCustomPosition
  );

/** 队列状态相等比对，避免轮询重复触发 App 重渲染 */
export const isSameQueue = (a: QueueStats, b: QueueStats): boolean =>
  a.running === b.running &&
  a.pending === b.pending &&
  a.maxConcurrent === b.maxConcurrent;

/** API 设置状态相等比对，避免轮询重复触发 App 重渲染 */
export const isSameProviderSettings = (
  a: ImageProviderSettings,
  b: ImageProviderSettings
): boolean =>
  a.providerId === b.providerId &&
  a.baseUrl === b.baseUrl &&
  a.model === b.model &&
  a.hasApiKey === b.hasApiKey &&
  a.apiKeyMasked === b.apiKeyMasked &&
  a.activeApiKeyIndex === b.activeApiKeyIndex &&
  a.savedApiKeysMasked.length === b.savedApiKeysMasked.length &&
  a.savedApiKeysMasked.every((v, i) => v === b.savedApiKeysMasked[i]) &&
  a.savedApiKeyProviderIds.length === b.savedApiKeyProviderIds.length &&
  a.savedApiKeyProviderIds.every((v, i) => v === b.savedApiKeyProviderIds[i]);
