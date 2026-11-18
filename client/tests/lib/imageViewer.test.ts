import { describe, expect, it } from "vitest";
import { constrainImageViewer, FIT_IMAGE_VIEW, isPointInsideViewerImage, MAX_VIEWER_SCALE, MIN_VIEWER_SCALE, zoomImageViewerAt } from "@/lib/imageViewer";

describe("图片查看器缩放与边界", () => {
  it("按图片真实比例和变换后的位置识别留白，尺寸未就绪时保留媒体交互", () => {
    const viewport = { width: 800, height: 600 };
    const image = { width: 400, height: 800 };
    expect(isPointInsideViewerImage({ x: 250, y: 0 }, FIT_IMAGE_VIEW, viewport, image)).toBe(false);
    expect(isPointInsideViewerImage({ x: 150, y: 0 }, FIT_IMAGE_VIEW, viewport, image)).toBe(true);
    expect(isPointInsideViewerImage({ x: 250, y: 0 }, { scale: 2, x: -100, y: 0 }, viewport, image)).toBe(false);
    expect(isPointInsideViewerImage({ x: 150, y: 0 }, { scale: 2, x: -100, y: 0 }, viewport, image)).toBe(true);
    expect(isPointInsideViewerImage({ x: 300, y: 0 }, FIT_IMAGE_VIEW, viewport, { width: 0, height: 0 })).toBe(true);
  });

  it("缩放后鼠标下的图片坐标保持不变", () => {
    const before = { scale: 2, x: -80, y: 45 };
    const cursor = { x: 120, y: -65 };
    const after = zoomImageViewerAt(before, 3.5, cursor);
    expect((cursor.x - after.x) / after.scale).toBeCloseTo((cursor.x - before.x) / before.scale);
    expect((cursor.y - after.y) / after.scale).toBeCloseTo((cursor.y - before.y) / before.scale);
  });

  it("连续滚轮输入在缩放上下限处停止，不产生无效坐标", () => {
    expect(zoomImageViewerAt(FIT_IMAGE_VIEW, 10000, { x: 0, y: 0 }).scale).toBe(MAX_VIEWER_SCALE);
    expect(zoomImageViewerAt(FIT_IMAGE_VIEW, -1, { x: 0, y: 0 }).scale).toBe(MIN_VIEWER_SCALE);
    expect(zoomImageViewerAt(FIT_IMAGE_VIEW, NaN, { x: NaN, y: Infinity })).toEqual(FIT_IMAGE_VIEW);
  });

  it("根据真实比例限制平移，竖图没有溢出的横轴仍居中", () => {
    const viewport = { width: 800, height: 600 };
    const image = { width: 400, height: 800 };
    // 适应窗口时竖图是 300×600，放大两倍后只有纵轴溢出。
    expect(constrainImageViewer({ scale: 2, x: 500, y: -900 }, viewport, image)).toEqual({ scale: 2, x: 0, y: -300 });
    expect(constrainImageViewer({ scale: 4, x: 500, y: 2000 }, viewport, image)).toEqual({ scale: 4, x: 200, y: 900 });
  });

  it("缩回适应窗口及尺寸尚未加载时归中，窗口变化后重新约束位置", () => {
    const image = { width: 1200, height: 1200 };
    expect(constrainImageViewer({ scale: 1, x: 200, y: -100 }, { width: 600, height: 400 }, image)).toEqual(FIT_IMAGE_VIEW);
    expect(constrainImageViewer({ scale: 0.5, x: -80, y: 90 }, { width: 0, height: 0 }, image)).toEqual({ scale: 0.5, x: 0, y: 0 });
    expect(constrainImageViewer({ scale: 3, x: 600, y: 600 }, { width: 200, height: 200 }, image)).toEqual({ scale: 3, x: 200, y: 200 });
  });
});
