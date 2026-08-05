import { describe, expect, it } from "vitest";
import { formatKlingPrice, getKlingPrice } from "./klingPricing";

describe("getKlingPrice", () => {
  describe("kling-v1（固定时长查表，不受音画同步影响）", () => {
    it("std 5s/10s 分别为 0.80/1.60 元", () => {
      expect(getKlingPrice("kling-v1", "std", 5, "on")).toBe(0.8);
      expect(getKlingPrice("kling-v1", "std", 10, "off")).toBe(1.6);
    });

    it("pro 5s/10s 分别为 2.80/5.60 元", () => {
      expect(getKlingPrice("kling-v1", "pro", 5, "on")).toBe(2.8);
      expect(getKlingPrice("kling-v1", "pro", 10, "off")).toBe(5.6);
    });

    it("开启/关闭音画价格一致", () => {
      expect(getKlingPrice("kling-v1", "std", 10, "on")).toBe(getKlingPrice("kling-v1", "std", 10, "off"));
    });
  });

  describe("kling-v1-5 / kling-v1-6（固定时长查表，不受音画同步影响）", () => {
    it.each(["kling-v1-5", "kling-v1-6"])("%s std 5s/10s 分别为 1.60/3.20 元", (model) => {
      expect(getKlingPrice(model, "std", 5, "off")).toBe(1.6);
      expect(getKlingPrice(model, "std", 10, "on")).toBe(3.2);
    });

    it.each(["kling-v1-5", "kling-v1-6"])("%s pro 5s/10s 分别为 2.80/5.60 元", (model) => {
      expect(getKlingPrice(model, "pro", 5, "on")).toBe(2.8);
      expect(getKlingPrice(model, "pro", 10, "off")).toBe(5.6);
    });
  });

  describe("kling-v3（按秒计费，随音画同步变化）", () => {
    it("std 关闭 0.48 元/秒，5s=2.40、10s=4.80", () => {
      expect(getKlingPrice("kling-v3", "std", 5, "off")).toBe(2.4);
      expect(getKlingPrice("kling-v3", "std", 10, "off")).toBe(4.8);
    });

    it("std 开启 0.72 元/秒，5s=3.60、10s=7.20", () => {
      expect(getKlingPrice("kling-v3", "std", 5, "on")).toBe(3.6);
      expect(getKlingPrice("kling-v3", "std", 10, "on")).toBe(7.2);
    });

    it("pro 关闭 0.64 元/秒，5s=3.20、10s=6.40", () => {
      expect(getKlingPrice("kling-v3", "pro", 5, "off")).toBe(3.2);
      expect(getKlingPrice("kling-v3", "pro", 10, "off")).toBe(6.4);
    });

    it("pro 开启 0.96 元/秒，5s=4.80、10s=9.60", () => {
      expect(getKlingPrice("kling-v3", "pro", 5, "on")).toBe(4.8);
      expect(getKlingPrice("kling-v3", "pro", 10, "on")).toBe(9.6);
    });

    it("任意秒数均可计算，结果保留两位小数", () => {
      expect(getKlingPrice("kling-v3", "pro", 1, "on")).toBe(0.96);
      expect(getKlingPrice("kling-v3", "std", 3, "off")).toBe(1.44);
      expect(getKlingPrice("kling-v3", "pro", 7, "on")).toBe(6.72);
    });

    it("支持小数时长，10.5s 精确计费（0.48×10.5=5.04、0.96×10.5=10.08）", () => {
      expect(getKlingPrice("kling-v3", "std", 10.5, "off")).toBe(5.04);
      expect(getKlingPrice("kling-v3", "pro", 10.5, "on")).toBe(10.08);
    });
  });

  describe("边界与未知情况", () => {
    it("v1 系列 duration 非 5/10 时返回 null", () => {
      expect(getKlingPrice("kling-v1", "std", 6, "on")).toBeNull();
      expect(getKlingPrice("kling-v1-6", "pro", 15, "off")).toBeNull();
    });

    it("v1 系列 duration=7（非 5/10）返回 null", () => {
      expect(getKlingPrice("kling-v1", "std", 7, "on")).toBeNull();
      expect(getKlingPrice("kling-v1-5", "std", 7, "off")).toBeNull();
      expect(getKlingPrice("kling-v1-6", "pro", 7, "off")).toBeNull();
    });

    it("duration=0：v3 按 0 元计费，v1 系列返回 null", () => {
      expect(getKlingPrice("kling-v3", "std", 0, "off")).toBe(0);
      expect(getKlingPrice("kling-v1", "std", 0, "on")).toBeNull();
      expect(getKlingPrice("kling-v1-5", "std", 0, "off")).toBeNull();
    });

    it("duration=NaN 返回 null", () => {
      expect(getKlingPrice("kling-v3", "std", NaN, "off")).toBeNull();
      expect(getKlingPrice("kling-v1", "std", NaN, "on")).toBeNull();
    });

    it("duration=Infinity 返回 null", () => {
      expect(getKlingPrice("kling-v3", "std", Infinity, "off")).toBeNull();
      expect(getKlingPrice("kling-v1-6", "pro", Infinity, "off")).toBeNull();
    });

    it("duration=-5：v3 已拦截负数返回 null，v1 系列返回 null", () => {
      expect(getKlingPrice("kling-v3", "std", -5, "off")).toBeNull();
      expect(getKlingPrice("kling-v1", "std", -5, "on")).toBeNull();
      expect(getKlingPrice("kling-v1-5", "pro", -5, "off")).toBeNull();
      expect(getKlingPrice("kling-v1-6", "pro", -5, "off")).toBeNull();
    });

    it("未知模型返回 null", () => {
      expect(getKlingPrice("grok-video", "std", 5, "on")).toBeNull();
      expect(getKlingPrice("kling-v9", "std", 5, "on")).toBeNull();
    });
  });
});

describe("formatKlingPrice", () => {
  it("null 返回价格未知", () => {
    expect(formatKlingPrice(null)).toBe("价格未知");
  });

  it("保留两位小数并带 ¥ 前缀", () => {
    expect(formatKlingPrice(0.8)).toBe("¥0.80");
    expect(formatKlingPrice(2.4)).toBe("¥2.40");
    expect(formatKlingPrice(9.6)).toBe("¥9.60");
    expect(formatKlingPrice(7.2)).toBe("¥7.20");
  });

  it("0 元格式化为 ¥0.00", () => {
    expect(formatKlingPrice(0)).toBe("¥0.00");
  });

  it("负数/NaN/Infinity 返回价格未知（已拦截非法值）", () => {
    expect(formatKlingPrice(-1)).toBe("价格未知");
    expect(formatKlingPrice(NaN)).toBe("价格未知");
    expect(formatKlingPrice(Infinity)).toBe("价格未知");
  });
});
