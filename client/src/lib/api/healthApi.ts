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

export const healthApi = {
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
