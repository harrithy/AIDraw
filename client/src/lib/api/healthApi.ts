import type { DrawJob, HealthPayload } from "../../types";
import { MAX_CONCURRENT_JOBS, processQueue } from "../jobQueue";
import { JOB_STORE, openDb } from "../storage/database";
import {
  DEFAULT_MODEL,
  getActiveApiKeyIndex,
  getDefaultBaseUrl,
  getSettings,
  maskSecret
} from "../storage/settings";

/**
 * 应用健康检查与状态聚合 API。
 * 同时返回当前系统状态、队列统计、及脱敏后的 API 配置信息，
 * 供前端轮询和 UI 展示使用。
 */
export const healthApi = {
  /**
   * 获取系统健康状态摘要。
   * 触发一次任务队列调度，收集队列统计、任务数量和当前 API 配置。
   * @returns 包含队列状态、任务数和脱敏设置的 HealthPayload
   */
  health: async (): Promise<HealthPayload> => {
    const db = await openDb();
    await processQueue();

    const jobs = await new Promise<DrawJob[]>((resolve, reject) => {
      const transaction = db.transaction(JOB_STORE, "readonly");
      const req = transaction.objectStore(JOB_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    const settings = await getSettings();

    return {
      ok: true,
      queue: {
        maxConcurrent: MAX_CONCURRENT_JOBS,
        running: jobs.filter((job) => job.status === "running").length,
        pending: jobs.filter((job) => job.status === "pending").length
      },
      imageProvider: {
        textToImage: settings.apiKey ? settings.providerId : "mock",
        imageToImage: settings.apiKey ? settings.providerId : "mock",
        hasApiKey: Boolean(settings.apiKey),
        baseUrl: settings.baseUrl || getDefaultBaseUrl(settings.providerId),
        model: settings.model || DEFAULT_MODEL,
        apiKeyMasked: maskSecret(settings.apiKey),
        savedApiKeysMasked: (settings.savedApiKeys || []).map(maskSecret),
        providerId: settings.providerId,
        savedApiKeyProviderIds: settings.savedApiKeyProviderIds || [],
        activeApiKeyIndex: getActiveApiKeyIndex(settings),
        usesSavedConfig: Boolean(settings.apiKey || settings.baseUrl || settings.model)
      }
    };
  }
};
