import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrawJob } from "../../types";
import { MockProvider } from "./MockProvider";
import type { StoredSettings } from "./types";

const makeSettings = (overrides: Partial<StoredSettings> = {}): StoredSettings => ({
  baseUrl: "https://duomiapi.com/",
  model: "kling-v3",
  apiKey: "mock-test-key",
  providerId: "duomi",
  ...overrides
});

const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-mock",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "pending",
  prompt: "一只猫在沙滩上跑步",
  negativePrompt: "",
  width: 1024,
  height: 576,
  count: 1,
  thinking: "medium",
  model: "kling-v3",
  orderIndex: 0,
  posX: 0,
  posY: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

const provider = new MockProvider();

afterEach(() => {
  vi.useRealTimers();
});

describe("MockProvider.queryTask", () => {
  it("Kling 视频模型返回演示 mp4", async () => {
    vi.useFakeTimers();

    const promise = provider.queryTask("mock-task-1", makeJob({ model: "kling-v3" }), makeSettings());
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result).toEqual({
      state: "succeeded",
      imageUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    });
  });

  it("gpt-image-2 图片模型仍返回 SVG 图片（回归）", async () => {
    vi.useFakeTimers();

    const promise = provider.queryTask("mock-task-2", makeJob({ model: "gpt-image-2" }), makeSettings());
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.state).toBe("succeeded");
    if (result.state === "succeeded") {
      expect(result.imageUrl).toMatch(/^data:image\/svg\+xml/);
    }
  });
});
