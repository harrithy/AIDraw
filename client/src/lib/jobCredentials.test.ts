import { describe, expect, it } from "vitest";
import type { DrawJob } from "../types";
import type { StoredSettings } from "./providers/types";
import {
  createCredentialId,
  createJobCredentialSnapshot,
  resolveJobSettings
} from "./jobCredentials";

const makeSettings = (overrides: Partial<StoredSettings> = {}): StoredSettings => ({
  baseUrl: "https://duomi.example.com",
  model: "gpt-image-2",
  apiKey: "duomi-active-key",
  savedApiKeys: ["duomi-old-key", "grsai-key", "duomi-active-key"],
  providerId: "duomi",
  savedApiKeyProviderIds: ["duomi", "grsai", "duomi"],
  ...overrides
});

const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "running",
  prompt: "prompt",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  count: 1,
  thinking: "medium",
  model: "gpt-image-2",
  orderIndex: 0,
  posX: 0,
  posY: 0,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  ...overrides
});

describe("jobCredentials", () => {
  it("同一平台和 Key 生成稳定标识，不在标识中泄露原 Key", () => {
    const first = createCredentialId("duomi", "a-very-secret-key");
    const second = createCredentialId("duomi", "a-very-secret-key");

    expect(first).toBe(second);
    expect(first).not.toContain("a-very-secret-key");
    expect(createCredentialId("grsai", "a-very-secret-key")).not.toBe(first);
  });

  it("新任务只保存凭据标识、平台和 Base URL，不保存 Key 明文", () => {
    const snapshot = createJobCredentialSnapshot(makeSettings());

    expect(snapshot).toEqual({
      credentialId: createCredentialId("duomi", "duomi-active-key"),
      credentialProviderId: "duomi",
      providerBaseUrl: "https://duomi.example.com"
    });
    expect(JSON.stringify(snapshot)).not.toContain("duomi-active-key");
  });

  it("切换激活 Key 后仍按任务绑定标识解析原 Key", () => {
    const originalId = createCredentialId("duomi", "duomi-old-key");
    const settings = makeSettings({ apiKey: "duomi-active-key" });
    const resolved = resolveJobSettings(
      makeJob({
        credentialId: originalId,
        credentialProviderId: "duomi",
        providerBaseUrl: "https://original.example.com"
      }),
      settings,
      "duomi"
    );

    expect(resolved.apiKey).toBe("duomi-old-key");
    expect(resolved.baseUrl).toBe("https://original.example.com");
    expect(resolved.providerId).toBe("duomi");
  });

  it("绑定 Key 被删除后阻止用其他 Key 误查任务", () => {
    expect(() =>
      resolveJobSettings(
        makeJob({
          credentialId: createCredentialId("duomi", "deleted-key"),
          credentialProviderId: "duomi"
        }),
        makeSettings(),
        "duomi"
      )
    ).toThrow("API Key 已被删除");
  });

  it("旧任务没有凭据标识时兼容当前同平台 Key", () => {
    expect(resolveJobSettings(makeJob(), makeSettings(), "duomi").apiKey).toBe("duomi-active-key");
  });
});
