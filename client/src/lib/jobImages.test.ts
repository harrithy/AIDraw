import { describe, expect, it } from "vitest";
import { getJobAssetKind, getJobOutputImages, getJobVisualKind } from "./jobImages";

describe("任务结果资产类型", () => {
  it("实际资产声明优先于能力类型和 URL 后缀", () => {
    expect(
      getJobVisualKind(
        {
          model: "gpt-image-2",
          outputKind: "image",
          outputAssets: [{ kind: "video", url: "https://example.com/result.png" }]
        },
        "https://example.com/result.png"
      )
    ).toBe("video");
  });

  it("音频和文件不会被当作图片或视频", () => {
    expect(getJobVisualKind({ model: "gpt-image-2", outputKind: "audio" })).toBeUndefined();
    expect(getJobAssetKind({ model: "gpt-image-2", category: "music" })).toBe("audio");
    expect(
      getJobVisualKind(
        {
          model: "gpt-image-2",
          outputAssets: [{ kind: "file", url: "https://example.com/result.png" }]
        },
        "https://example.com/result.png"
      )
    ).toBeUndefined();
  });

  it("能力声明优先于误导性的 URL 后缀和旧模型名", () => {
    expect(
      getJobVisualKind(
        { model: "gpt-image-2", category: "video", outputKind: "video" },
        "https://example.com/download.jpg"
      )
    ).toBe("video");
  });

  it("旧任务仍可按 URL 后缀和模型判断", () => {
    expect(getJobVisualKind({ model: "unknown" }, "https://example.com/result.mp4?token=1")).toBe("video");
    expect(getJobVisualKind({ model: "gpt-image-2" }, "https://example.com/result.webp")).toBe("image");
  });

  it("图片历史列表会清理空值并避免重复最新结果", () => {
    expect(
      getJobOutputImages({
        outputImageUrls: [" https://example.com/old.png ", "https://example.com/new.png"],
        outputImageUrl: " https://example.com/new.png "
      })
    ).toEqual(["https://example.com/old.png", "https://example.com/new.png"]);
  });
});
