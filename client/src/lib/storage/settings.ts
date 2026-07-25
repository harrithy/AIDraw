import { GPT_IMAGE_MODEL } from "../imageModels";
import type { StoredSettings } from "../providers/types";
import { openDb, SETTINGS_STORE } from "./database";
import { broadcastStateUpdate } from "./stateSync";

/** 多米 API 的默认 Base URL */
export const DUOMI_BASE_URL = "https://duomiapi.com";
/** Grsai API 的默认 Base URL */
export const GRSAI_BASE_URL = "https://grsaiapi.com";
/** 新建任务时的默认模型 */
export const DEFAULT_MODEL = GPT_IMAGE_MODEL;

/**
 * 根据提供者 ID 返回对应的默认 Base URL。
 * Grsai 和 Duomi 使用不同的 API 域名。
 * @param providerId - 提供者标识（duomi / grsai）
 */
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

/**
 * 持久化保存 API 设置，完成后广播变更通知。
 * @param settings - 完整的设置对象
 */
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

/**
 * 对 API Key 进行脱敏处理，仅显示前 4 位和后 4 位。
 * 短 Key（≤8 字符）统一显示为 8 个星号。
 * @param value - 原始 API Key
 * @returns 脱敏后的 Key 字符串
 */
export const maskSecret = (value: string) => {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

/**
 * 在已保存的 API Key 列表中定位当前激活 Key 的索引。
 * 匹配条件：Key 值相同且所属平台一致。
 * @param settings - 当前设置对象
 * @returns 匹配的索引，未找到时返回 -1
 */
export const getActiveApiKeyIndex = (settings: StoredSettings) =>
  settings.apiKey
    ? (settings.savedApiKeys || []).findIndex(
        (key, index) =>
          key === settings.apiKey && settings.savedApiKeyProviderIds?.[index] === settings.providerId
      )
    : -1;
