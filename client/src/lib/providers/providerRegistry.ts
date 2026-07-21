import type { ApiProviderId, DrawJob, ImageProviderId } from "../../types";
import { isNanoBananaModel } from "../imageModels";
import { DuomiProvider } from "./DuomiProvider";
import { GrsaiProvider } from "./GrsaiProvider";
import { MockProvider } from "./MockProvider";
import { NanoBananaProvider } from "./NanoBananaProvider";
import type { ImageModelProvider, StoredSettings } from "./types";

const providers: Record<ImageProviderId, ImageModelProvider> = {
  duomi: new DuomiProvider(),
  grsai: new GrsaiProvider(),
  "nano-banana": new NanoBananaProvider(),
  mock: new MockProvider()
};

const isProviderId = (value: unknown): value is ImageProviderId =>
  value === "duomi" || value === "nano-banana" || value === "grsai" || value === "mock";

/** 根据历史任务、当前平台和模型确定实际执行任务的 Provider。 */
export const resolveProviderId = (job: DrawJob, settings: StoredSettings): ImageProviderId => {
  if (isProviderId(job.provider)) return job.provider;
  if (job.remoteTaskId) return isNanoBananaModel(job.model) ? "nano-banana" : "duomi";
  if (!settings.apiKey) return "mock";
  if (settings.providerId === "grsai") return "grsai";
  return isNanoBananaModel(job.model) ? "nano-banana" : "duomi";
};

export const getProvider = (providerId: ImageProviderId) => providers[providerId];

/** Provider 使用哪一类用户 API Key；Mock 不需要 Key。 */
export const getRequiredApiProvider = (providerId: ImageProviderId): ApiProviderId | null => {
  if (providerId === "mock") return null;
  return providerId === "grsai" ? "grsai" : "duomi";
};
