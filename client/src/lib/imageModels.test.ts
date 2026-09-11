import { describe, expect, it } from "vitest";
import {
  GPT_IMAGE_FLARE_MODEL,
  GPT_IMAGE_MODEL,
  GPT_IMAGE_SUNBURST_MODEL,
  getImageModelGroups,
  isImageModelAvailableForProvider,
  isKlingVideoModel,
  isNanoBananaModel,
  isSupportedImageModel,
  isVideoModel
} from "./imageModels";

describe("isKlingVideoModel", () => {
  it.each(["kling-v1", "kling-v1-5", "kling-v1-6", "kling-v3"])("%s 应被识别为 Kling 模型", (model) => {
    expect(isKlingVideoModel(model)).toBe(true);
  });

  it.each(["grok-video", "grok-video-1.5", "gpt-image-2", "kling-v2", "gemini-3-pro-image-preview", ""])(
    "%s 不应被识别为 Kling 模型",
    (model) => {
      expect(isKlingVideoModel(model)).toBe(false);
    }
  );
});

describe("isVideoModel", () => {
  it("GROK 与 KLING 视频模型都应返回 true", () => {
    expect(isVideoModel("grok-video")).toBe(true);
    expect(isVideoModel("grok-video-1.5")).toBe(true);
    expect(isVideoModel("kling-v1")).toBe(true);
    expect(isVideoModel("kling-v3")).toBe(true);
  });

  it("图片模型不算是视频模型", () => {
    expect(isVideoModel("gpt-image-2")).toBe(false);
    expect(isVideoModel("gemini-3-pro-image-preview")).toBe(false);
  });
});

describe("getImageModelGroups", () => {
  it("duomi 模型组包含 KLING 视频分组且模型值正确", () => {
    const groups = getImageModelGroups("duomi");
    const klingGroup = groups.find((group) => group.label === "KLING 视频");
    expect(klingGroup).toBeDefined();
    expect(klingGroup?.options.map((option) => option.value)).toEqual([
      "kling-v3",
      "kling-v1-6",
      "kling-v1-5",
      "kling-v1"
    ]);
  });

  it("grsai 模型组不包含 KLING 视频分组", () => {
    const groups = getImageModelGroups("grsai");
    expect(groups.some((group) => group.label === "KLING 视频")).toBe(false);
  });
});

describe("isSupportedImageModel", () => {
  it("KLING 模型值均为受支持的模型", () => {
    for (const model of ["kling-v1", "kling-v1-5", "kling-v1-6", "kling-v3"]) {
      expect(isSupportedImageModel(model)).toBe(true);
    }
  });
});

describe("GPT Image 2.5 系列模型", () => {
  it("duomi 的 ChatGPT 分组同时提供 gpt-image-2 与 2.5 两个新模型", () => {
    const groups = getImageModelGroups("duomi");
    const groupLabels: string[] = groups.map((group) => group.label);
    expect(groupLabels).not.toContain("GPT Image 2.5");
    const chatGptGroup = groups.find((group) => group.label === "ChatGPT");
    expect(chatGptGroup?.options.map((option) => option.value)).toEqual([
      GPT_IMAGE_MODEL,
      GPT_IMAGE_FLARE_MODEL,
      GPT_IMAGE_SUNBURST_MODEL
    ]);
    // 选项标签保持纯模型 ID，不附加中文说明
    expect(chatGptGroup?.options.map((option) => option.label)).toEqual([
      GPT_IMAGE_MODEL,
      GPT_IMAGE_FLARE_MODEL,
      GPT_IMAGE_SUNBURST_MODEL
    ]);
  });

  it("两个新模型都是受支持且 duomi 可用的图片模型", () => {
    for (const model of [GPT_IMAGE_FLARE_MODEL, GPT_IMAGE_SUNBURST_MODEL]) {
      expect(isSupportedImageModel(model)).toBe(true);
      expect(isImageModelAvailableForProvider(model, "duomi")).toBe(true);
      // 不是视频、也不属于 NANO-BANANA，因此继续走 GPT Image 的 size 参数
      expect(isVideoModel(model)).toBe(false);
      expect(isNanoBananaModel(model)).toBe(false);
    }
  });

  it("grsai 模型池不包含 GPT Image 2.5 系列", () => {
    expect(isImageModelAvailableForProvider(GPT_IMAGE_FLARE_MODEL, "grsai")).toBe(false);
    expect(isImageModelAvailableForProvider(GPT_IMAGE_SUNBURST_MODEL, "grsai")).toBe(false);
    expect(isImageModelAvailableForProvider(GPT_IMAGE_MODEL, "grsai")).toBe(true);
  });
});