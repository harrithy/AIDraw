import { afterEach, describe, expect, it, vi } from "vitest";
import { createFileFromMediaUrl, getMediaProxyUrl, uploadMediaToHost } from "./imageHost";

describe("imageHost 媒体上传", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("把 MP4 远程结果转换为可上传的视频文件", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["video-data"], { type: "video/mp4" }))
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = await createFileFromMediaUrl("https://cdn.example.com/result.mp4", "job-1", "video");

    expect(file.name).toBe("aidraw-job-1.mp4");
    expect(file.type).toBe("video/mp4");
  });

  it("读取远程媒体时通过同源代理地址请求（绕过 CORS）", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["video-data"], { type: "video/mp4" }))
    });
    vi.stubGlobal("fetch", fetchMock);

    await createFileFromMediaUrl("https://cdn.example.com/result.mp4", "job-3", "video");

    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/api/media-proxy?url=${encodeURIComponent("https://cdn.example.com/result.mp4")}`,
      { cache: "no-store" }
    );
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

  it("getMediaProxyUrl：浏览器环境把 http(s) 地址转换为同源代理地址", () => {
    const proxied = getMediaProxyUrl("https://cdn.example.com/video.mp4");
    expect(proxied).toBe(`${window.location.origin}/api/media-proxy?url=${encodeURIComponent("https://cdn.example.com/video.mp4")}`);
  });

  it("getMediaProxyUrl：非 http(s) 地址原样返回", () => {
    expect(getMediaProxyUrl("data:video/mp4;base64,xxx")).toBe("data:video/mp4;base64,xxx");
    expect(getMediaProxyUrl("not-a-url")).toBe("not-a-url");
  });
});
