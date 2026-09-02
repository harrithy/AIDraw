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

    if (
      payload.providerId &&
      payload.providerId !== settings.providerId &&
      payload.providerId !== "deepseek" &&
      payload.baseUrl === undefined
    ) {
      settings.baseUrl = getDefaultBaseUrl(payload.providerId);
    }

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
    else if (payload.apiKey?.trim()) {
      settings.apiKey = payload.apiKey.trim();
      if (payload.providerId) settings.providerId = payload.providerId;
    }

    const savedApiKeys = settings.savedApiKeys ?? (settings.savedApiKeys = settings.apiKey ? [settings.apiKey] : []);
    const savedProviderIds =
      settings.savedApiKeyProviderIds && settings.savedApiKeyProviderIds.length === savedApiKeys.length
        ? settings.savedApiKeyProviderIds
        : (settings.savedApiKeyProviderIds = savedApiKeys.map(() => "duomi"));

    // 直接保存的 Key 也进入凭据列表，确保已经排队或运行中的任务可继续找到它。
    if (settings.apiKey) {
      const existingIndex = savedApiKeys.findIndex(
        (key, index) => key === settings.apiKey && savedProviderIds[index] === settings.providerId
      );
      if (existingIndex < 0) {
        savedApiKeys.push(settings.apiKey);
        savedProviderIds.push(settings.providerId);
      }
    }

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
      // DeepSeek Key 仅用于 AI 润写，保存到凭据列表即可，不作为绘图平台激活。
      if (providerId === "deepseek") {
        await saveSettings(settings);
        return toPublicSettings(settings);
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
      const nextProviderId = savedProviderIds[payload.setActiveApiKeyIndex] || "duomi";
      if (nextProviderId === "deepseek") {
        throw new Error("DeepSeek Key 仅用于 AI 润写，不能作为绘图供应商使用");
      }
      settings.apiKey = savedApiKeys[payload.setActiveApiKeyIndex];
      settings.providerId = nextProviderId;
      settings.baseUrl = getDefaultBaseUrl(nextProviderId);
    }

    await saveSettings(settings);
    return toPublicSettings(settings);
  }
};
