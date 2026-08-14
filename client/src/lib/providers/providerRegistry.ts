import type { ApiProviderId, DrawJob, ImageProviderId } from "../../types";
import { isKlingVideoModel, isNanoBananaModel } from "../imageModels";
import { DuomiProvider } from "./DuomiProvider";
import { DuomiCapabilityProvider } from "./DuomiCapabilityProvider";
import { GrsaiProvider } from "./GrsaiProvider";
import { KlingProvider } from "./KlingProvider";
import { MockProvider } from "./MockProvider";
import { NanoBananaProvider } from "./NanoBananaProvider";
import type { ImageModelProvider, StoredSettings } from "./types";

const providers: Record<ImageProviderId, ImageModelProvider> = {
  duomi: new DuomiProvider(),
  grsai: new GrsaiProvider(),
  "nano-banana": new NanoBananaProvider(),
  kling: new KlingProvider(),
  mock: new MockProvider()
};

const duomiCapabilityProvider = new DuomiCapabilityProvider();

const isProviderId = (value: unknown): value is ImageProviderId =>
  value === "duomi" || value === "nano-banana" || value === "grsai" || value === "mock" || value === "kling";

/** 根据历史任务、当前平台和模型确定实际执行任务的 Provider。 */
export const resolveProviderId = (job: DrawJob, settings: StoredSettings): ImageProviderId => {
  if (isProviderId(job.provider)) return job.provider;
  if (job.remoteTaskId) {
    if (isKlingVideoModel(job.model)) return "kling";
    return isNanoBananaModel(job.model) ? "nano-banana" : "duomi";
  }
  if (!settings.apiKey) return "mock";
  if (isKlingVideoModel(job.model)) return "kling";
  if (settings.providerId === "grsai") return "grsai";
  return isNanoBananaModel(job.model) ? "nano-banana" : "duomi";
};

/**
 * 根据 Provider ID 获取对应的 Provider 实例。
 * @param providerId - 提供者标识（duomi / nano-banana / grsai / kling / mock）
 * @returns Provider 单例实例
 */
export const getProvider = (providerId: ImageProviderId) => providers[providerId];

/** 注册表能力全部使用多米通用执行器；旧模型继续走原 Provider。 */
export const getProviderForJob = (job: DrawJob, settings: StoredSettings) => {
  if (job.capabilityId) return { providerId: "duomi" as const, provider: duomiCapabilityProvider };
  const providerId = resolveProviderId(job, settings);
  return { providerId, provider: providers[providerId] };
};

/**
 * 返回 Provider 所需的 API Key 类型。
 * Mock Provider 不需要 Key 返回 null；Grsai 使用 grsai Key；Kling 复用多米 Key，其余使用 duomi Key。
 * @param providerId - 提供者标识
 * @returns API Key 提供者类型，Mock 时返回 null
 */
export const getRequiredApiProvider = (providerId: ImageProviderId): ApiProviderId | null => {
  if (providerId === "mock") return null;
  return providerId === "grsai" ? "grsai" : "duomi";
};
