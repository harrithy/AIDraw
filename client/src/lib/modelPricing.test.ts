import { describe, expect, it } from "vitest";
import { formatModelPrice, getModelPrice } from "./modelPricing";

describe("getModelPrice", () => {
  describe("图片模型（固定单价，按张计费）", () => {
    it("gpt-image-2 固定 0.06 元", () => {
      expect(getModelPrice("gpt-image-2", "std", 0, "off")).toBe(0.06);
    });

    it("nano-banana（gemini）系列单价", () => {
      expect(getModelPrice("gemini-2.5-flash-image", "std", 0, "off")).toBe(0.05);
      expect(getModelPrice("gemini-3-pro-image-preview", "std", 0, "off")).toBe(0.15);
      expect(getModelPrice("gemini-3.1-flash-image-preview", "std", 0, "off")).toBe(0.1);
    });
  });

  describe("GROK 视频（按秒计费）", () => {
    it("grok-video 0.04 元/秒", () => {
      expect(getModelPrice("grok-video", "std", 6, "off")).toBe(0.24);
      expect(getModelPrice("grok-video", "std", 10, "off")).toBe(0.4);
      expect(getModelPrice("grok-video", "std", 30, "off")).toBe(1.2);
    });

    it("grok-video-1.5 0.05 元/秒", () => {
      expect(getModelPrice("grok-video-1.5", "std", 6, "off")).toBe(0.3);
      expect(getModelPrice("grok-video-1.5", "std", 10, "off")).toBe(0.5);
      expect(getModelPrice("grok-video-1.5", "std", 15, "off")).toBe(0.75);
    });

    it("duration 非法时返回 null", () => {
      expect(getModelPrice("grok-video", "std", NaN, "off")).toBeNull();
      expect(getModelPrice("grok-video-1.5", "std", Infinity, "off")).toBeNull();
      expect(getModelPrice("grok-video", "std", -5, "off")).toBeNull();
    });
  });

  describe("Kling 视频（委托 klingPricing）", () => {
    it("转发 kling 价格", () => {
      expect(getModelPrice("kling-v1", "std", 5, "on")).toBe(0.8);
      expect(getModelPrice("kling-v3", "std", 5, "off")).toBe(2.4);
    });
  });

  describe("未知模型", () => {
    it("返回 null", () => {
      expect(getModelPrice("kling-v9", "std", 5, "off")).toBeNull();
      expect(getModelPrice("gpt-image-2-vip", "std", 0, "off")).toBeNull();
      expect(getModelPrice("nano-banana", "std", 0, "off")).toBeNull();
    });
  });
});

describe("formatModelPrice", () => {
  it("复用 kling 的价格格式化", () => {
    expect(formatModelPrice(null)).toBe("价格未知");
    expect(formatModelPrice(0.06)).toBe("¥0.06");
    expect(formatModelPrice(0.3)).toBe("¥0.30");
  });
});
