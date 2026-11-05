import { describe, expect, it, beforeEach } from "vitest";
import { uploadRegistry } from "./uploadRegistry";

describe("uploadRegistry", () => {
  beforeEach(() => {
    uploadRegistry.clearAll();
  });

  it("registers an upload and resolves successfully", async () => {
    let resolveFn: (url: string) => void = () => {};
    const promise = new Promise<string>((resolve) => {
      resolveFn = resolve;
    });

    uploadRegistry.registerUpload("key-1", promise);
    expect(uploadRegistry.hasUpload("key-1")).toBe(true);
    expect(uploadRegistry.isUploadPending("key-1")).toBe(true);
    expect(uploadRegistry.getResolvedUrl("key-1")).toBeUndefined();

    resolveFn("https://example.com/image.png");
    const result = await uploadRegistry.waitForUpload("key-1");
    expect(result).toBe("https://example.com/image.png");
    expect(uploadRegistry.isUploadPending("key-1")).toBe(false);
    expect(uploadRegistry.getResolvedUrl("key-1")).toBe("https://example.com/image.png");
  });

  it("handles rejected upload promise", async () => {
    let rejectFn: (err: Error) => void = () => {};
    const promise = new Promise<string>((_, reject) => {
      rejectFn = reject;
    });

    uploadRegistry.registerUpload("key-fail", promise);
    rejectFn(new Error("网络超时"));

    await expect(uploadRegistry.waitForUpload("key-fail")).rejects.toThrow("网络超时");
    expect(uploadRegistry.isUploadPending("key-fail")).toBe(false);
  });

  it("throws for unknown or expired upload keys", async () => {
    await expect(uploadRegistry.waitForUpload("non-existent")).rejects.toThrow(
      "找不到该参考图的上传任务"
    );
  });

  it("waits for multiple uploads concurrently", async () => {
    uploadRegistry.registerUpload("img-1", Promise.resolve("https://example.com/1.png"));
    uploadRegistry.registerUpload("img-2", Promise.resolve("https://example.com/2.png"));

    const urls = await uploadRegistry.waitForAll(["img-1", "img-2"]);
    expect(urls).toEqual(["https://example.com/1.png", "https://example.com/2.png"]);
  });

  it("retries a rejected upload when retryFactory is provided", async () => {
    uploadRegistry.registerUpload(
      "key-retry",
      Promise.reject(new Error("首次上传失败")),
      () => Promise.resolve("https://example.com/retried.png")
    );

    await expect(uploadRegistry.waitForUpload("key-retry")).rejects.toThrow("首次上传失败");
    expect(uploadRegistry.retryFailedUpload("key-retry")).toBe(true);
    await expect(uploadRegistry.waitForUpload("key-retry")).resolves.toBe("https://example.com/retried.png");
  });
});
