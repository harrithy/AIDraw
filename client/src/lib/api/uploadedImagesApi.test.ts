import { describe, expect, it, vi } from "vitest";
import type { UploadedImage } from "../../types";
import { uploadedImagesApi } from "./uploadedImagesApi";

const mockImages: UploadedImage[] = [
  {
    id: "img-1",
    folderId: "folder-a",
    url: "https://example.com/1.png",
    originalName: "image1.png",
    mimeType: "image/png",
    byteSize: 1024,
    createdAt: "2026-06-01T10:00:00.000Z"
  },
  {
    id: "img-2",
    folderId: "folder-b",
    url: "https://example.com/2.png",
    originalName: "image2.png",
    mimeType: "image/png",
    byteSize: 2048,
    createdAt: "2026-06-02T10:00:00.000Z"
  }
];

vi.mock("../storage/database", () => ({
  UPLOADED_IMAGE_STORE: "uploadedImages",
  FOLDER_STORE: "folders",
  openDb: vi.fn(async () => ({
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
        getAll: vi.fn(() => {
          const req: { result: UploadedImage[]; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
            result: [...mockImages],
            onsuccess: null,
            onerror: null
          };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        })
      }))
    }))
  }))
}));

describe("uploadedImagesApi", () => {
  it("listAllUploadedImages returns all images across folders sorted by createdAt desc", async () => {
    const results = await uploadedImagesApi.listAllUploadedImages();
    expect(results).toHaveLength(2);
    // Should be sorted createdAt descending: img-2 (June 2) before img-1 (June 1)
    expect(results[0].id).toBe("img-2");
    expect(results[1].id).toBe("img-1");
  });
});
