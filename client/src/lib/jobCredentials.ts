import type { ApiProviderId, DrawJob } from "../types";
import type { StoredSettings } from "./providers/types";
import { getDefaultBaseUrl } from "./storage/settings";

type CredentialSnapshot = Pick<
  DrawJob,
  "credentialId" | "credentialProviderId" | "providerBaseUrl"
>;

type SavedCredential = {
  id: string;
  apiKey: string;
  providerId: ApiProviderId;
};

/**
 * 为本地 API Key 生成稳定标识。标识只用于匹配，不可还原 Key，也不会离开浏览器。
 */
export const createCredentialId = (providerId: ApiProviderId, apiKey: string) => {
  const value = `${providerId}\u0000${apiKey}`;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }

  return `cred-${providerId}-${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
};

const listSavedCredentials = (settings: StoredSettings): SavedCredential[] => {
  const savedKeys = settings.savedApiKeys || [];
  const savedProviderIds = settings.savedApiKeyProviderIds || [];
  const credentials = savedKeys
    .map((apiKey, index) => ({
      apiKey,
      providerId: savedProviderIds[index] || "duomi"
    }))
    .filter((item) => Boolean(item.apiKey))
    .map((item) => ({
      ...item,
      id: createCredentialId(item.providerId, item.apiKey)
    }));

  if (
    settings.apiKey &&
    !credentials.some(
      (item) => item.apiKey === settings.apiKey && item.providerId === settings.providerId
    )
  ) {
    credentials.push({
      id: createCredentialId(settings.providerId, settings.apiKey),
      apiKey: settings.apiKey,
      providerId: settings.providerId
    });
  }

  return credentials;
};

/** 记录新任务使用的凭据和 Base URL，但不把 API Key 明文写进任务。 */
export const createJobCredentialSnapshot = (settings: StoredSettings): CredentialSnapshot => {
  if (!settings.apiKey) return {};
  return {
    credentialId: createCredentialId(settings.providerId, settings.apiKey),
    credentialProviderId: settings.providerId,
    providerBaseUrl: settings.baseUrl || getDefaultBaseUrl(settings.providerId)
  };
};

/**
 * 按任务创建时的凭据标识还原 Provider 设置。
 * 旧任务没有凭据标识时仍兼容当前激活 Key。
 */
export const resolveJobSettings = (
  job: DrawJob,
  currentSettings: StoredSettings,
  requiredProviderId: ApiProviderId | null
): StoredSettings => {
  if (!requiredProviderId) return currentSettings;

  if (!job.credentialId) {
    if (!currentSettings.apiKey || currentSettings.providerId !== requiredProviderId) {
      throw new Error(
        `该任务需要 ${requiredProviderId === "grsai" ? "Grsai" : "多米API"} 的 API Key，请配置后再继续`
      );
    }
    return currentSettings;
  }

  const credentialProviderId = job.credentialProviderId || requiredProviderId;
  if (credentialProviderId !== requiredProviderId) {
    throw new Error("任务绑定的 API Key 与任务平台不匹配");
  }

  const credential = listSavedCredentials(currentSettings).find(
    (item) => item.id === job.credentialId && item.providerId === credentialProviderId
  );
  if (!credential) {
    throw new Error("该任务创建时使用的 API Key 已被删除，请恢复该 Key 后再继续追踪");
  }

  return {
    ...currentSettings,
    apiKey: credential.apiKey,
    providerId: credential.providerId,
    baseUrl: job.providerBaseUrl || getDefaultBaseUrl(credential.providerId)
  };
};
