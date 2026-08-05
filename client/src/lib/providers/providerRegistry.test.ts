import { describe, expect, it } from "vitest";
import type { DrawJob } from "../../types";
import { KlingProvider } from "./KlingProvider";
import { getProvider, getRequiredApiProvider, resolveProviderId } from "./providerRegistry";
import type { StoredSettings } from "./types";

const makeSettings = (overrides: Partial<StoredSettings> = {}): StoredSettings => ({
  baseUrl: "https://duomiapi.com",
  model: "gpt-image-2",
  apiKey: "dm-test-key",
  providerId: "duomi",
  ...overrides
});

const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "pending",
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

describe("resolveProviderId", () => {
  it("Kling 模型且有 apiKey 时解析为 kling", () => {
    expect(resolveProviderId(makeJob({ model: "kling-v3" }), makeSettings())).toBe("kling");
    expect(resolveProviderId(makeJob({ model: "kling-v1-6" }), makeSettings())).toBe("kling");
  });

  it("Kling 模型但无 apiKey 时回退为 mock", () => {
    expect(resolveProviderId(makeJob({ model: "kling-v3" }), makeSettings({ apiKey: "" }))).toBe("mock");
  });

  it("GROK 视频模型解析为 duomi（与现有行为一致）", () => {
    expect(resolveProviderId(makeJob({ model: "grok-video" }), makeSettings())).toBe("duomi");
    expect(resolveProviderId(makeJob({ model: "grok-video-1.5" }), makeSettings())).toBe("duomi");
  });

  it("NANO-BANANA 模型解析为 nano-banana", () => {
    expect(resolveProviderId(makeJob({ model: "gemini-3-pro-image-preview" }), makeSettings())).toBe(
      "nano-banana"
    );
  });

  it("providerId=grsai 时普通图片模型解析为 grsai", () => {
    expect(
      resolveProviderId(makeJob({ model: "gpt-image-2" }), makeSettings({ providerId: "grsai" }))
    ).toBe("grsai");
  });

  it("providerId=grsai 且模型为 Kling 时仍优先解析为 kling（Kling 判断先于 grsai）", () => {
    expect(
      resolveProviderId(makeJob({ model: "kling-v3" }), makeSettings({ providerId: "grsai" }))
    ).toBe("kling");
    expect(
      resolveProviderId(makeJob({ model: "kling-v1-6" }), makeSettings({ providerId: "grsai" }))
    ).toBe("kling");
  });

  it("providerId=grsai 且无 apiKey 时 Kling 模型仍回退为 mock", () => {
    expect(
      resolveProviderId(makeJob({ model: "kling-v3" }), makeSettings({ providerId: "grsai", apiKey: "" }))
    ).toBe("mock");
  });

  it("grok 视频模型 + providerId=grsai 时保持原有行为（解析为 grsai）", () => {
    expect(
      resolveProviderId(makeJob({ model: "grok-video" }), makeSettings({ providerId: "grsai" }))
    ).toBe("grsai");
  });

  it("job.provider 显式指定时优先返回该值", () => {
    expect(resolveProviderId(makeJob({ model: "kling-v3", provider: "mock" }), makeSettings())).toBe(
      "mock"
    );
    expect(
      resolveProviderId(makeJob({ model: "gpt-image-2", provider: "grsai" }), makeSettings())
    ).toBe("grsai");
  });

  it("远程任务恢复时按模型判定 Kling 提供者", () => {
    expect(
      resolveProviderId(makeJob({ model: "kling-v1", remoteTaskId: "rmt-1" }), makeSettings())
    ).toBe("kling");
  });
});

describe("getRequiredApiProvider", () => {
  it("kling 复用多米 Key，返回 duomi", () => {
    expect(getRequiredApiProvider("kling")).toBe("duomi");
  });

  it("grsai 返回 grsai", () => {
    expect(getRequiredApiProvider("grsai")).toBe("grsai");
  });

  it("mock 不需要 Key，返回 null", () => {
    expect(getRequiredApiProvider("mock")).toBeNull();
  });

  it("duomi 与 nano-banana 均返回 duomi", () => {
    expect(getRequiredApiProvider("duomi")).toBe("duomi");
    expect(getRequiredApiProvider("nano-banana")).toBe("duomi");
  });
});

describe("getProvider", () => {
  it("kling 注册的 Provider 为 KlingProvider 实例", () => {
    expect(getProvider("kling")).toBeInstanceOf(KlingProvider);
  });
});