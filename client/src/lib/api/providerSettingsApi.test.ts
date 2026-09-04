import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StoredSettings } from "../providers/types";
import { providerSettingsApi } from "./providerSettingsApi";

let currentStoredSettings: StoredSettings;

vi.mock("../storage/settings", async () => {
  const actual = await vi.importActual<typeof import("../storage/settings")>("../storage/settings");
  return {
    ...actual,
    getSettings: vi.fn(async () => JSON.parse(JSON.stringify(currentStoredSettings))),
    saveSettings: vi.fn(async (settings: StoredSettings) => {
      currentStoredSettings = JSON.parse(JSON.stringify(settings));
    })
  };
});

describe("providerSettingsApi", () => {
  beforeEach(() => {
    currentStoredSettings = {
      providerId: "duomi",
      baseUrl: "https://duomiapi.com",
      model: "gpt-image-2",
      apiKey: "",
      savedApiKeys: [],
      savedApiKeyProviderIds: []
    };
  });

  it("returns default settings when empty", async () => {
    const settings = await providerSettingsApi.getImageProviderSettings();
    expect(settings.providerId).toBe("duomi");
    expect(settings.baseUrl).toBe("https://duomiapi.com");
    expect(settings.model).toBe("gpt-image-2");
    expect(settings.hasApiKey).toBe(false);
    expect(settings.apiKeyMasked).toBe("");
    expect(settings.savedApiKeysMasked).toEqual([]);
    expect(settings.activeApiKeyIndex).toBe(-1);
  });

  it("imports a new API Key and sets it active for draw providers", async () => {
    const updated = await providerSettingsApi.updateImageProviderSettings({
      importApiKey: "sk-duomi-first-key-12345",
      providerId: "duomi"
    });

    expect(updated.hasApiKey).toBe(true);
    expect(updated.savedApiKeysMasked).toHaveLength(1);
    expect(updated.savedApiKeyProviderIds).toEqual(["duomi"]);
    expect(updated.activeApiKeyIndex).toBe(0);
  });

  it("imports a DeepSeek key to saved keys without setting it as active draw provider", async () => {
    const updated = await providerSettingsApi.updateImageProviderSettings({
      importApiKey: "sk-deepseek-polish-key-9999",
      providerId: "deepseek"
    });

    expect(updated.hasApiKey).toBe(false);
    expect(updated.savedApiKeysMasked).toHaveLength(1);
    expect(updated.savedApiKeyProviderIds).toEqual(["deepseek"]);
    expect(updated.activeApiKeyIndex).toBe(-1);
    expect(updated.providerId).toBe("duomi");
  });

  it("switches active API Key by index", async () => {
    // 预置两个 key
    currentStoredSettings.savedApiKeys = ["sk-key-alpha-123456", "sk-key-beta-654321"];
    currentStoredSettings.savedApiKeyProviderIds = ["duomi", "grsai"];
    currentStoredSettings.apiKey = "sk-key-alpha-123456";
    currentStoredSettings.providerId = "duomi";

    const switched = await providerSettingsApi.updateImageProviderSettings({
      setActiveApiKeyIndex: 1
    });

    expect(switched.providerId).toBe("grsai");
    expect(switched.activeApiKeyIndex).toBe(1);
    expect(switched.baseUrl).toBe("https://grsaiapi.com");
  });

  it("throws error when attempting to set DeepSeek key as active draw provider", async () => {
    currentStoredSettings.savedApiKeys = ["sk-deepseek-key-11111"];
    currentStoredSettings.savedApiKeyProviderIds = ["deepseek"];

    await expect(
      providerSettingsApi.updateImageProviderSettings({
        setActiveApiKeyIndex: 0
      })
    ).rejects.toThrow("DeepSeek Key 仅用于 AI 润写，不能作为绘图供应商使用");
  });

  it("clears active key without deleting it from saved keys when clearApiKey is true", async () => {
    currentStoredSettings.savedApiKeys = ["sk-key-alpha-123456"];
    currentStoredSettings.savedApiKeyProviderIds = ["duomi"];
    currentStoredSettings.apiKey = "sk-key-alpha-123456";
    currentStoredSettings.providerId = "duomi";

    const cleared = await providerSettingsApi.updateImageProviderSettings({
      clearApiKey: true
    });

    expect(cleared.hasApiKey).toBe(false);
    expect(cleared.apiKeyMasked).toBe("");
    expect(cleared.activeApiKeyIndex).toBe(-1);
    expect(cleared.savedApiKeysMasked).toHaveLength(1);
  });

  it("deletes an inactive key by index", async () => {
    currentStoredSettings.savedApiKeys = ["sk-active-123456", "sk-inactive-654321"];
    currentStoredSettings.savedApiKeyProviderIds = ["duomi", "duomi"];
    currentStoredSettings.apiKey = "sk-active-123456";
    currentStoredSettings.providerId = "duomi";

    const afterDelete = await providerSettingsApi.updateImageProviderSettings({
      deleteApiKeyIndex: 1
    });

    expect(afterDelete.savedApiKeysMasked).toHaveLength(1);
    expect(afterDelete.hasApiKey).toBe(true);
    expect(afterDelete.activeApiKeyIndex).toBe(0);
  });

  it("deletes the active key and automatically falls back to another key of the same provider", async () => {
    currentStoredSettings.savedApiKeys = ["sk-key-1-duomi-1111", "sk-key-2-duomi-2222"];
    currentStoredSettings.savedApiKeyProviderIds = ["duomi", "duomi"];
    currentStoredSettings.apiKey = "sk-key-1-duomi-1111";
    currentStoredSettings.providerId = "duomi";

    const afterDelete = await providerSettingsApi.updateImageProviderSettings({
      deleteApiKeyIndex: 0
    });

    expect(afterDelete.savedApiKeysMasked).toHaveLength(1);
    expect(afterDelete.hasApiKey).toBe(true);
    expect(afterDelete.activeApiKeyIndex).toBe(0);
    expect(afterDelete.providerId).toBe("duomi");
  });

  it("deletes active key and falls back to another draw provider when no key of same provider remains", async () => {
    currentStoredSettings.savedApiKeys = ["sk-duomi-only-1111", "sk-grsai-backup-2222"];
    currentStoredSettings.savedApiKeyProviderIds = ["duomi", "grsai"];
    currentStoredSettings.apiKey = "sk-duomi-only-1111";
    currentStoredSettings.providerId = "duomi";
    currentStoredSettings.baseUrl = "https://duomiapi.com";

    const afterDelete = await providerSettingsApi.updateImageProviderSettings({
      deleteApiKeyIndex: 0
    });

    expect(afterDelete.savedApiKeysMasked).toHaveLength(1);
    expect(afterDelete.hasApiKey).toBe(true);
    expect(afterDelete.providerId).toBe("grsai");
    expect(afterDelete.baseUrl).toBe("https://grsaiapi.com");
  });

  it("deletes the last active draw key and resets to unconfigured state", async () => {
    currentStoredSettings.savedApiKeys = ["sk-only-key-1111"];
    currentStoredSettings.savedApiKeyProviderIds = ["duomi"];
    currentStoredSettings.apiKey = "sk-only-key-1111";
    currentStoredSettings.providerId = "duomi";

    const afterDelete = await providerSettingsApi.updateImageProviderSettings({
      deleteApiKeyIndex: 0
    });

    expect(afterDelete.savedApiKeysMasked).toHaveLength(0);
    expect(afterDelete.hasApiKey).toBe(false);
    expect(afterDelete.activeApiKeyIndex).toBe(-1);
    expect(afterDelete.apiKeyMasked).toBe("");
  });

  it("deletes a saved DeepSeek key cleanly", async () => {
    currentStoredSettings.savedApiKeys = ["sk-draw-key-1111", "sk-deepseek-key-2222"];
    currentStoredSettings.savedApiKeyProviderIds = ["duomi", "deepseek"];
    currentStoredSettings.apiKey = "sk-draw-key-1111";
    currentStoredSettings.providerId = "duomi";

    const afterDelete = await providerSettingsApi.updateImageProviderSettings({
      deleteApiKeyIndex: 1
    });

    expect(afterDelete.savedApiKeysMasked).toHaveLength(1);
    expect(afterDelete.savedApiKeyProviderIds).toEqual(["duomi"]);
    expect(afterDelete.hasApiKey).toBe(true);
  });

  it("throws error when deleteApiKeyIndex is out of range", async () => {
    currentStoredSettings.savedApiKeys = ["sk-draw-key-1111"];
    currentStoredSettings.savedApiKeyProviderIds = ["duomi"];

    await expect(
      providerSettingsApi.updateImageProviderSettings({
        deleteApiKeyIndex: 5
      })
    ).rejects.toThrow("指定的 API Key 索引不存在");

    await expect(
      providerSettingsApi.updateImageProviderSettings({
        deleteApiKeyIndex: -1
      })
    ).rejects.toThrow("指定的 API Key 索引不存在");
  });
});
