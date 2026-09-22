import { beforeEach, describe, expect, it } from "vitest";
import {
  hasPendingReferenceUploads,
  resolveJobInputImageUrls,
  resolvePendingReferenceKeys,
  resolvePendingReferenceUrls
} from "./pendingReferenceUploads";
import { uploadRegistry } from "./uploadRegistry";

describe("pendingReferenceUploads", () => {
  beforeEach(() => {
    uploadRegistry.clearAll();
  });

  it("backfills pending uploads in place while preserving remote urls and order", async () => {
    const remoteUrl1 = "https://example.com/already-uploaded-1.png";
    const blobUrl2 = "blob:http://localhost:5173/mock-uuid-2";
    const remoteUrl2 = "https://example.com/uploaded-2.png";
    const blobUrl3 = "blob:http://localhost:5173/mock-uuid-3";
    const remoteUrl3 = "https://example.com/uploaded-3.png";

    uploadRegistry.registerUpload("key-img-2", Promise.resolve(remoteUrl2));
    uploadRegistry.registerUpload("key-img-3", Promise.resolve(remoteUrl3));

    const resolved = await resolvePendingReferenceUrls([remoteUrl1, blobUrl2, blobUrl3], [
      { placeholderUrl: blobUrl2, uploadKey: "key-img-2" },
      { placeholderUrl: blobUrl3, uploadKey: "key-img-3" }
    ]);

    expect(resolved).toEqual([remoteUrl1, remoteUrl2, remoteUrl3]);
  });

  it("keeps urls untouched when the placeholder no longer matches", async () => {
    const unknownPlaceholder = "blob:http://localhost:5173/never-registered";
    uploadRegistry.registerUpload("key-1", Promise.resolve("https://example.com/1.png"));

    const resolved = await resolvePendingReferenceUrls([unknownPlaceholder], [
      { placeholderUrl: unknownPlaceholder, uploadKey: "key-1" }
    ]);

    expect(resolved).toEqual(["https://example.com/1.png"]);
  });

  it("rejects when a pending upload failed so the queue can mark the job failed", async () => {
    uploadRegistry.registerUpload("key-fail", Promise.reject(new Error("网络超时")));

    await expect(
      resolvePendingReferenceUrls(["blob:http://localhost:5173/fail"], [
        { placeholderUrl: "blob:http://localhost:5173/fail", uploadKey: "key-fail" }
      ])
    ).rejects.toThrow("网络超时");
  });

  it("replaces the whole list for legacy key-only jobs", async () => {
    uploadRegistry.registerUpload("legacy-1", Promise.resolve("https://example.com/a.png"));
    uploadRegistry.registerUpload("legacy-2", Promise.resolve("https://example.com/b.png"));

    const resolved = await resolvePendingReferenceKeys(
      ["legacy-1", "legacy-2"],
      ["blob:http://localhost:5173/legacy-a", "blob:http://localhost:5173/legacy-b"]
    );

    expect(resolved).toEqual(["https://example.com/a.png", "https://example.com/b.png"]);
  });

  it("detects pending uploads from either field and reads reference urls from both shapes", () => {
    expect(hasPendingReferenceUploads(undefined, undefined)).toBe(false);
    expect(hasPendingReferenceUploads([], [])).toBe(false);
    expect(hasPendingReferenceUploads([{ placeholderUrl: "blob:x", uploadKey: "k" }], undefined)).toBe(true);
    expect(hasPendingReferenceUploads(undefined, ["k"])).toBe(true);

    expect(resolveJobInputImageUrls(["https://example.com/1.png"], "https://example.com/0.png")).toEqual([
      "https://example.com/1.png"
    ]);
    expect(resolveJobInputImageUrls(undefined, "https://example.com/0.png")).toEqual([
      "https://example.com/0.png"
    ]);
    expect(resolveJobInputImageUrls(undefined, undefined)).toEqual([]);
  });
});
