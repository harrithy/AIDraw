import { afterEach, describe, expect, it, vi } from "vitest";
import { createFileFromMediaUrl, uploadMediaToHost } from "./imageHost";

describe("imageHost 媒体上传", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("把 MP4 远程结果转换为可上传的视频文件", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["video-data"], { type: "video/mp4" }))
      })
    );

    const file = await createFileFromMediaUrl("https://cdn.example.com/result.mp4", "job-1", "video");

    expect(file.name).toBe("aidraw-job-1.mp4");
    expect(file.type).toBe("video/mp4");
  });

  it("无文件后缀且返回二进制流时使用任务的预期媒体类型", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["video-data"], { type: "application/octet-stream" }))
      })
    );

    const file = await createFileFromMediaUrl("https://cdn.example.com/signed-result?token=1", "job-2", "video");

    expect(file.name).toBe("aidraw-job-2.mp4");
    expect(file.type).toBe("video/mp4");
  });

  it("通过原有图床代理上传视频文件", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ src: "/uploads/result.mp4" }])
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["video-data"], "result.mp4", { type: "video/mp4" });

    const url = await uploadMediaToHost(file);

    expect(url).toBe("https://image.harrio.xyz/uploads/result.mp4");
    expect(fetchMock).toHaveBeenCalledWith(
      "/image-upload/upload",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
  });
});
