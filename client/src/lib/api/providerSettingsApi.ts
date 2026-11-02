import type { ImageProviderSettings, UpdateImageProviderSettingsPayload } from "../../types";
import { validateCustomProviderConfig } from "../customProviders";
import {
  DEFAULT_MODEL,
  DUOMI_BASE_URL,
  getActiveApiKeyIndex,
  getDefaultBaseUrl,
  getSettings,
  maskSecret,
  saveSettings
} from "../storage/settings";

export const toPublicSettings = (settings: Awaited<ReturnType<typeof getSettings>>): ImageProviderSettings => {
  const active = settings.customProviders?.find((item) => item.config.id === settings.activeCustomProviderId);
  return {
    baseUrl: active?.config.baseUrl ?? (settings.baseUrl || getDefaultBaseUrl(settings.providerId)),
    model: active?.config.models[0] ?? (settings.model || DEFAULT_MODEL),
    hasApiKey: active ? !active.config.authHeader || Boolean(active.apiKey) : Boolean(settings.apiKey),
    apiKeyMasked: maskSecret(active ? active.apiKey : settings.apiKey),
    savedApiKeysMasked: (settings.savedApiKeys || []).map(maskSecret),
    providerId: settings.providerId,
    savedApiKeyProviderIds: settings.savedApiKeyProviderIds || [],
    activeApiKeyIndex: active ? -1 : getActiveApiKeyIndex(settings),
    customProviders: (settings.customProviders ?? []).map((item) => ({
      config: item.config,
      hasApiKey: Boolean(item.apiKey),
      apiKeyMasked: maskSecret(item.apiKey)
    })),
    activeCustomProviderId: active?.config.id
  };
};

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

    if (payload.saveCustomProvider) {
      const config = validateCustomProviderConfig(payload.saveCustomProvider.config);
      const profiles = settings.customProviders ?? [];
      const previous = profiles.find((item) => item.config.id === config.id);
      if (!previous && profiles.length >= 30) throw new Error("最多保存 30 个自定义中转");
      const apiKey = payload.saveCustomProvider.apiKey?.trim() || previous?.apiKey || "";
      if (config.authHeader && !apiKey) throw new Error("请填写中转 API Key");
      const previousApiKeys = [...new Set([...(previous?.previousApiKeys ?? []), ...(previous?.apiKey && previous.apiKey !== apiKey ? [previous.apiKey] : [])])];
      settings.customProviders = [...profiles.filter((item) => item.config.id !== config.id), { config, apiKey, previousApiKeys }];
      settings.activeCustomProviderId = config.id;
      await saveSettings(settings);
      return toPublicSettings(settings);
    }
    if (payload.activateCustomProviderId !== undefined) {
      if (payload.activateCustomProviderId && !settings.customProviders?.some((item) => item.config.id === payload.activateCustomProviderId)) {
        throw new Error("自定义中转不存在");
      }
      settings.activeCustomProviderId = payload.activateCustomProviderId || undefined;
      await saveSettings(settings);
      return toPublicSettings(settings);
    }
    if (payload.deleteCustomProviderId) {
      settings.customProviders = settings.customProviders?.filter((item) => item.config.id !== payload.deleteCustomProviderId);
      if (settings.activeCustomProviderId === payload.deleteCustomProviderId) settings.activeCustomProviderId = undefined;
      await saveSettings(settings);
      return toPublicSettings(settings);
    }
    // 切回内置绘图凭据时结束自定义中转激活；单独添加润写 Key 不影响绘图。
    if ((payload.importApiKey && payload.providerId !== "deepseek") || payload.setActiveApiKeyIndex !== undefined || payload.clearApiKey || payload.apiKey) {
      settings.activeCustomProviderId = undefined;
    }

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

    if (typeof payload.deleteApiKeyIndex === "number") {
      if (payload.deleteApiKeyIndex < 0 || payload.deleteApiKeyIndex >= savedApiKeys.length) {
        throw new Error("指定的 API Key 索引不存在");
      }
      const deletedKey = savedApiKeys[payload.deleteApiKeyIndex];
      const deletedProviderId = savedProviderIds[payload.deleteApiKeyIndex] || "duomi";
      savedApiKeys.splice(payload.deleteApiKeyIndex, 1);
      savedProviderIds.splice(payload.deleteApiKeyIndex, 1);

      // 若被删除的 Key 正是当前激活的 Key
      if (settings.apiKey === deletedKey && settings.providerId === deletedProviderId) {
        // 优先寻找同平台的下一个可用 Key
        const sameProviderIndex = savedProviderIds.findIndex((pId) => pId === deletedProviderId);
        if (sameProviderIndex >= 0) {
          settings.apiKey = savedApiKeys[sameProviderIndex];
          settings.providerId = deletedProviderId;
          settings.baseUrl = getDefaultBaseUrl(deletedProviderId);
        } else {
          // 若同平台无可用 Key，回退到其它可用的非 DeepSeek 绘图 Key
          const fallbackIndex = savedProviderIds.findIndex((pId) => pId !== "deepseek");
          if (fallbackIndex >= 0) {
            const fallbackProviderId = savedProviderIds[fallbackIndex] || "duomi";
            settings.apiKey = savedApiKeys[fallbackIndex];
            settings.providerId = fallbackProviderId;
            settings.baseUrl = getDefaultBaseUrl(fallbackProviderId);
          } else {
            // 无任何可用绘图 Key，重置为空
            settings.apiKey = "";
            settings.providerId = "duomi";
            settings.baseUrl = DUOMI_BASE_URL;
          }
        }
      }
    }

    await saveSettings(settings);
    return toPublicSettings(settings);
  }
};
