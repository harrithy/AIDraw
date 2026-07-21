import { GPT_IMAGE_MODEL } from "../imageModels";
import type { StoredSettings } from "../providers/types";
import { openDb, SETTINGS_STORE } from "./database";
import { broadcastStateUpdate } from "./stateSync";

export const DUOMI_BASE_URL = "https://duomiapi.com";
export const GRSAI_BASE_URL = "https://grsaiapi.com";
export const DEFAULT_MODEL = GPT_IMAGE_MODEL;

export const getDefaultBaseUrl = (providerId: StoredSettings["providerId"]) =>
  providerId === "grsai" ? GRSAI_BASE_URL : DUOMI_BASE_URL;

/** 读取并补齐旧版本可能缺失的多 Key 与平台字段。 */
export const getSettings = async (): Promise<StoredSettings> => {
  const db = await openDb();
  return new Promise<StoredSettings>((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, "readonly");
    const req = transaction.objectStore(SETTINGS_STORE).get("imageProvider");
    req.onsuccess = () => {
      const result = req.result as StoredSettings | undefined;
      if (!result) {
        resolve({
          baseUrl: DUOMI_BASE_URL,
          model: DEFAULT_MODEL,
          apiKey: "",
          savedApiKeys: [],
          providerId: "duomi",
          savedApiKeyProviderIds: []
        });
        return;
      }

      if (!result.savedApiKeys) result.savedApiKeys = result.apiKey ? [result.apiKey] : [];
      if (
        !result.savedApiKeyProviderIds ||
        result.savedApiKeyProviderIds.length !== result.savedApiKeys.length
      ) {
        result.savedApiKeyProviderIds = result.savedApiKeys.map(() => "duomi");
      }
      if (!result.providerId) result.providerId = "duomi";
      resolve(result);
    };
    req.onerror = () => reject(req.error);
  });
};

export const saveSettings = async (settings: StoredSettings) => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, "readwrite");
    const req = transaction.objectStore(SETTINGS_STORE).put(settings, "imageProvider");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  broadcastStateUpdate("");
};

export const maskSecret = (value: string) => {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export const getActiveApiKeyIndex = (settings: StoredSettings) =>
  settings.apiKey
    ? (settings.savedApiKeys || []).findIndex(
        (key, index) =>
          key === settings.apiKey && settings.savedApiKeyProviderIds?.[index] === settings.providerId
      )
    : -1;
