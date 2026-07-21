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

export const providerSettingsApi = {
  getImageProviderSettings: async (): Promise<ImageProviderSettings> =>
    toPublicSettings(await getSettings()),

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
