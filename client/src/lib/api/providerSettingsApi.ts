import type { ImageProviderSettings, UpdateImageProviderSettingsPayload } from "../../types";
import {
  DEFAULT_MODEL,
  getActiveApiKeyIndex,
  getDefaultBaseUrl,
  getSettings,
  maskSecret,
  saveSettings
} from "../storage/settings";

const toPublicSettings = (settings: Awaited<ReturnType<typeof getSettings>>): ImageProviderSettings => ({
  baseUrl: settings.baseUrl || getDefaultBaseUrl(settings.providerId),
  model: settings.model || DEFAULT_MODEL,
  hasApiKey: Boolean(settings.apiKey),
  apiKeyMasked: maskSecret(settings.apiKey),
  savedApiKeysMasked: (settings.savedApiKeys || []).map(maskSecret),
  providerId: settings.providerId,
  savedApiKeyProviderIds: settings.savedApiKeyProviderIds || [],
  activeApiKeyIndex: getActiveApiKeyIndex(settings)
});

/**
 * API 提供者设置 API，封装配置的读写和脱敏处理。
 * 完整 Key 仅存于浏览器本地，对外暴露时统一脱敏为 XXXX...XXXX 格式。
 */
export const providerSettingsApi = {
  /**
   * 获取当前 API 设置（返回脱敏版本）。
   * @returns 脱敏后的 ImageProviderSettings
   */
  getImageProviderSettings: async (): Promise<ImageProviderSettings> =>
    toPublicSettings(await getSettings()),

  /**
   * 更新 API 设置：Base URL、模型、API Key、多 Key 管理等。
   * 支持切换提供者（duomi/grsai）并自动关联对应 Key。
   * @param payload - 部分更新的设置字段
   * @returns 更新后脱敏的 ImageProviderSettings
   */
  updateImageProviderSettings: async (
    payload: UpdateImageProviderSettingsPayload
  ): Promise<ImageProviderSettings> => {
    const settings = await getSettings();

    if (payload.baseUrl !== undefined) {
      const baseUrl = payload.baseUrl.trim() || getDefaultBaseUrl(payload.providerId || settings.providerId);
      try {
        const parsed = new URL(baseUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        throw new Error("Base URL is invalid");
      }
      settings.baseUrl = baseUrl || getDefaultBaseUrl(payload.providerId || settings.providerId);
    }

    if (payload.model !== undefined) settings.model = payload.model.trim() || DEFAULT_MODEL;

    if (payload.clearApiKey) settings.apiKey = "";
    else if (payload.apiKey?.trim()) settings.apiKey = payload.apiKey.trim();

    const savedApiKeys = settings.savedApiKeys ?? (settings.savedApiKeys = settings.apiKey ? [settings.apiKey] : []);
    const savedProviderIds =
      settings.savedApiKeyProviderIds && settings.savedApiKeyProviderIds.length === savedApiKeys.length
        ? settings.savedApiKeyProviderIds
        : (settings.savedApiKeyProviderIds = savedApiKeys.map(() => "duomi"));

    if (payload.importApiKey?.trim()) {
      const newKey = payload.importApiKey.trim();
      const providerId = payload.providerId || "duomi";
      const existingIndex = savedApiKeys.findIndex(
        (key, index) => key === newKey && savedProviderIds[index] === providerId
      );
      if (existingIndex < 0) {
        savedApiKeys.push(newKey);
        savedProviderIds.push(providerId);
      }
      settings.apiKey = newKey;
      settings.providerId = providerId;
      settings.baseUrl = getDefaultBaseUrl(providerId);
    }

    if (
      typeof payload.setActiveApiKeyIndex === "number" &&
      payload.setActiveApiKeyIndex >= 0 &&
      payload.setActiveApiKeyIndex < savedApiKeys.length
    ) {
      settings.apiKey = savedApiKeys[payload.setActiveApiKeyIndex];
      settings.providerId = savedProviderIds[payload.setActiveApiKeyIndex] || "duomi";
      settings.baseUrl = getDefaultBaseUrl(settings.providerId);
    }

    await saveSettings(settings);
    return toPublicSettings(settings);
  }
};
