import { describe, expect, it, vi } from "vitest";
import type { UploadedImage } from "../types";
import { hasReferenceImageDrag, readReferenceImageDrag, REFERENCE_IMAGE_DRAG_TYPE, writeReferenceImageDrag } from "./referenceImageDrag";

/** 模拟原生拖拽数据；拖动经过区域时只可读取类型，放下后才可读取内容。 */
const makeTransfer = () => {
  const values = new Map<string, string>();
  return {
    effectAllowed: "none",
    get types() { return [...values.keys()]; },
    setData: (type: string, value: string) => values.set(type, value),
    getData: vi.fn((type: string) => values.get(type) ?? "")
  } as unknown as DataTransfer;
};
const image: UploadedImage = {
  id: "asset", folderId: "folder", url: "https://example.test/reference.png", originalName: "餐桌.png",
  mimeType: "image/png", byteSize: 1, createdAt: "2026-11-03"
};

describe("上传素材拖拽协议", () => {
  it("传递原始图片链接和名称，并声明复制语义", () => {
    const transfer = makeTransfer();
    expect(writeReferenceImageDrag(transfer, image)).toBe(true);
    expect(transfer.effectAllowed).toBe("copy");
    expect(transfer.getData("text/uri-list")).toBe(image.url);
    expect(readReferenceImageDrag(transfer)).toEqual({ url: image.url, originalName: image.originalName });
  });

  it("识别拖入区域时无需提前读取受保护的数据内容", () => {
    const transfer = makeTransfer();
    transfer.setData(REFERENCE_IMAGE_DRAG_TYPE, "");
    expect(hasReferenceImageDrag(transfer)).toBe(true);
    expect(transfer.getData).not.toHaveBeenCalled();
  });

  it.each([
    { mimeType: "video/mp4" }, { mimeType: "audio/mpeg" },
    { url: "https://example.test/video.webm?token=1" }, { url: "file:///private/image.png" }
  ])("不允许拖出非图片素材或本地文件地址：%j", (overrides) => {
    expect(writeReferenceImageDrag(makeTransfer(), { ...image, ...overrides })).toBe(false);
  });

  it("损坏或伪装为视频的自定义负载不回退到普通链接", () => {
    const transfer = makeTransfer();
    transfer.setData("text/uri-list", image.url);
    transfer.setData(REFERENCE_IMAGE_DRAG_TYPE, "{invalid}");
    expect(readReferenceImageDrag(transfer)).toBeNull();
    transfer.setData(REFERENCE_IMAGE_DRAG_TYPE, JSON.stringify({ url: image.url, mimeType: "video/mp4" }));
    expect(readReferenceImageDrag(transfer)).toBeNull();
  });

  it("兼容浏览器原生图片链接并跳过 URI 列表中的注释", () => {
    const transfer = makeTransfer();
    transfer.setData("text/uri-list", `# 图片链接\r\n${image.url}\r\n`);
    expect(readReferenceImageDrag(transfer)).toEqual({ url: image.url, originalName: "参考图片" });
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,AA==", "https://example.test/video.mp4"]) (
    "拒绝无效的图片地址 %s", (url) => {
      const transfer = makeTransfer();
      transfer.setData("text/uri-list", url);
      expect(readReferenceImageDrag(transfer)).toBeNull();
    }
  );

  it("普通文本拖动不会被当成图片，保留提示词编辑的默认行为", () => {
    const transfer = makeTransfer();
    transfer.setData("text/plain", "厨房设计");
    expect(hasReferenceImageDrag(transfer)).toBe(false);
    expect(readReferenceImageDrag(transfer)).toBeNull();
  });
});
