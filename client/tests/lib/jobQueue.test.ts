import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jobsApi } from "@/lib/api/jobsApi";
import { processQueue } from "@/lib/jobQueue";
import type { ImageModelProvider, ProviderTaskResult } from "@/lib/providers/types";
import type { DrawJob } from "@/types";

const previousImage = "https://example.com/previous.png";
const firstImage = "https://example.com/first.png";
const secondImage = "https://example.com/second.png";
const firstResult = { state: "succeeded", imageUrl: firstImage, text: "第一条结果", data: { id: "first" } } as const;
const secondResult = { state: "succeeded", imageUrl: secondImage, text: "第二条结果", data: { id: "second" } } as const;
const failedResult = { state: "error", errorMessage: "远程拒绝生成" } as const;
const createTask = vi.fn<ImageModelProvider["createTask"]>();
const queryTask = vi.fn<ImageModelProvider["queryTask"]>();
let storedJob: DrawJob;

// 只替换 IndexedDB 的读写请求，使用实际的队列领取、租约校验和任务 API。
function createJobTransaction() {
  let pendingRequests = 0;
  function request<T>(operation: () => T) {
    pendingRequests += 1;
    const response = { result: undefined as T | undefined, onsuccess: null as (() => void) | null };
    queueMicrotask(() => {
      response.result = operation();
      response.onsuccess?.();
      pendingRequests -= 1;
      if (pendingRequests === 0) transaction.oncomplete?.();
    });
    return response;
  }
  const transaction = {
    oncomplete: null as (() => void) | null,
    objectStore: () => ({
      get: () => request(() => structuredClone(storedJob)),
      getAll: () => request(() => [structuredClone(storedJob)]),
      put: (job: DrawJob) => request(() => { storedJob = structuredClone(job); })
    })
  };
  return transaction;
}

vi.mock("@/lib/storage/database", () => ({
  FOLDER_STORE: "folders",
  JOB_STORE: "jobs",
  openDb: async () => ({ transaction: createJobTransaction })
}));

vi.mock("@/lib/storage/settings", () => ({
  DEFAULT_MODEL: "gpt-image-2",
  getSettings: async () => ({ providerId: "duomi", apiKey: "", baseUrl: "", model: "gpt-image-2" })
}));

vi.mock("@/lib/storage/stateSync", () => ({ broadcastStateUpdate: vi.fn() }));

vi.mock("@/lib/providers/providerRegistry", () => ({
  getProviderForJob: () => ({ providerId: "mock", provider: { createTask, queryTask } }),
  getRequiredApiProvider: () => null,
  resolveProviderId: () => "mock"
}));

describe("多子任务队列", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T08:00:00Z"));
    createTask.mockReset().mockResolvedValue({ taskId: "first", taskIds: ["first", "second", "failed"] });
    queryTask.mockReset();
    storedJob = {
      id: "job-1",
      folderId: "folder-1",
      mode: "text-to-image",
      status: "pending",
      prompt: "多子任务",
      negativePrompt: "",
      width: 1024,
      height: 1024,
      count: 1,
      thinking: "high",
      model: "gpt-image-2",
      orderIndex: 0,
      posX: 0,
      posY: 0,
      outputImageUrl: previousImage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  afterEach(() => vi.useRealTimers());

  it("在其他查询仍未返回时保存结果，追踪中断后只补查缺失的子任务", async () => {
    const networkError = new Error("查询连接中断");
    let rejectFirstQuery: ((error: Error) => void) | undefined;
    const firstQuery = new Promise<ProviderTaskResult>((_resolve, reject) => { rejectFirstQuery = reject; });
    queryTask.mockImplementation(async (id) => {
      if (id === "second") return secondResult;
      if (id === "failed") return failedResult;
      if (queryTask.mock.calls.filter(([taskId]) => taskId === "first").length === 1) return firstQuery;
      throw networkError;
    });

    await processQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(storedJob).toMatchObject({
      status: "running",
      remoteTaskResults: { second: secondResult, failed: failedResult },
      outputImageUrls: [previousImage, secondImage],
      outputAssets: [{ kind: "image", url: secondImage }]
    });

    rejectFirstQuery?.(networkError);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(storedJob).toMatchObject({
      status: "failed",
      remoteStatus: "tracking_interrupted",
      outputImageUrl: secondImage,
      outputText: "第二条结果"
    });
    expect(queryTask.mock.calls.map(([id]) => id)).toEqual([
      "first", "second", "failed", "first", "first", "first", "first"
    ]);

    queryTask.mockClear().mockResolvedValue(firstResult);
    await jobsApi.retryJob(storedJob.id);
    await vi.advanceTimersByTimeAsync(0);
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(queryTask.mock.calls.map(([id]) => id)).toEqual(["first"]);
    expect(storedJob).toMatchObject({
      status: "completed",
      outputImageUrl: firstImage,
      outputImageUrls: [previousImage, firstImage],
      outputAssets: [{ kind: "image", url: firstImage }, { kind: "image", url: secondImage }],
      outputText: "第一条结果\n\n第二条结果",
      outputData: { results: [{ id: "first" }, { id: "second" }], partialErrors: ["远程拒绝生成"] }
    });
    expect(storedJob.remoteTaskResults).toBeUndefined();
  });

  it("接管租约过期的任务时从已保存的结果继续轮询", async () => {
    storedJob = {
      ...storedJob,
      status: "running",
      queueOwnerId: "closed-tab",
      leaseExpiresAt: new Date(Date.now() - 1000).toISOString(),
      remoteTaskIds: ["first", "second"],
      remoteTaskResults: { second: secondResult },
      outputImageUrl: secondImage,
      outputImageUrls: [previousImage, secondImage]
    };
    queryTask.mockResolvedValueOnce({ state: "running" }).mockResolvedValueOnce(firstResult);

    await processQueue();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(createTask).not.toHaveBeenCalled();
    expect(queryTask.mock.calls.map(([id]) => id)).toEqual(["first", "first"]);
    expect(storedJob).toMatchObject({ status: "completed", outputImageUrls: [previousImage, firstImage] });
    expect(storedJob.outputAssets?.map((asset) => asset.url)).toEqual([firstImage, secondImage]);
  });

  it("重新编辑后提交新一批任务时清除旧的续查记录", async () => {
    storedJob = {
      ...storedJob,
      status: "failed",
      remoteStatus: "tracking_interrupted",
      remoteTaskId: "first",
      remoteTaskIds: ["first", "second", "failed"],
      remoteTaskResults: { second: secondResult },
      outputImageUrl: secondImage,
      outputImageUrls: [previousImage, secondImage]
    };
    queryTask.mockResolvedValue(failedResult).mockResolvedValueOnce(firstResult);

    await jobsApi.regenerateJobWithEdits(storedJob.id, {
      prompt: "新的生成参数",
      model: "gpt-image-2",
      size: "auto",
      thinking: "high",
      inputImageUrls: []
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(queryTask.mock.calls.map(([id]) => id)).toEqual(["first", "second", "failed"]);
    expect(storedJob).toMatchObject({
      status: "completed",
      outputImageUrls: [previousImage, secondImage, firstImage],
      outputAssets: [{ kind: "image", url: firstImage }]
    });
  });
});
