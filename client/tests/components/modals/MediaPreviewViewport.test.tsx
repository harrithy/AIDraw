import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIT_IMAGE_VIEW } from "@/lib/imageViewer";
import { MediaPreviewViewport } from "@/components/modals/MediaPreviewViewport";

/** 用受控状态模拟查看器，固定视口与图片尺寸以验证真实交互链路。 */
function Harness({ video = false, onBackgroundClick }: { video?: boolean; onBackgroundClick?: () => void }) {
  const [view, setView] = useState(FIT_IMAGE_VIEW);
  return <MediaPreviewViewport media={{ url: "/fixture.png", alt: "测试图片", kind: video ? "video" : "image" }} view={view} onViewChange={setView} onBackgroundClick={onBackgroundClick} />;
}

describe("图片查看区域手势", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, toJSON: () => ({}) });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  const viewport = () => container.querySelector<HTMLDivElement>(".media-zoom-viewport")!;
  const load = (width = 800, height = 600) => act(() => {
    const image = container.querySelector("img")!;
    Object.defineProperties(image, { naturalWidth: { value: width }, naturalHeight: { value: height } });
    image.dispatchEvent(new Event("load", { bubbles: true }));
  });

  it("点击竖图两侧留白关闭，点击图片和拖动手势不关闭", () => {
    const close = vi.fn();
    act(() => root.render(<Harness onBackgroundClick={close} />));
    load(300, 600);
    const surface = viewport();
    surface.setPointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => false);
    const pointer = (type: string, x: number) => surface.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "mouse", button: 0, clientX: x, clientY: 150, bubbles: true }));
    const click = (x: number) => surface.dispatchEvent(new MouseEvent("click", { clientX: x, clientY: 150, bubbles: true, detail: 1 }));
    act(() => { pointer("pointerdown", 200); pointer("pointerup", 200); click(200); });
    expect(close).not.toHaveBeenCalled();
    // 在留白开始拖动也不误关闭，松手后仍可继续查看。
    act(() => { pointer("pointerdown", 20); pointer("pointermove", 50); pointer("pointerup", 50); click(50); });
    expect(close).not.toHaveBeenCalled();
    act(() => { pointer("pointerdown", 20); pointer("pointerup", 20); click(20); });
    expect(close).toHaveBeenCalledOnce();
  });

  it("捏合与取消手势之后不因合成点击而关闭", () => {
    const close = vi.fn();
    act(() => root.render(<Harness onBackgroundClick={close} />));
    load(300, 600);
    const surface = viewport();
    surface.setPointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => false);
    const pointer = (type: string, id: number) => surface.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: 10, clientY: 100, bubbles: true }));
    act(() => {
      pointer("pointerdown", 1); pointer("pointerdown", 2);
      pointer("pointerup", 2); pointer("pointercancel", 1);
      surface.dispatchEvent(new MouseEvent("click", { clientX: 10, clientY: 100, bubbles: true, detail: 1 }));
    });
    expect(close).not.toHaveBeenCalled();
  });

  it("滚轮围绕指针放大并阻止页面接收到滚动，双击还原", () => {
    act(() => root.render(<Harness />));
    load();
    const bubble = vi.fn();
    container.addEventListener("wheel", bubble);
    const wheel = new WheelEvent("wheel", { deltaY: -100, clientX: 250, clientY: 175, bubbles: true, cancelable: true });
    // happy-dom 的 WheelEvent 未继承鼠标坐标，补齐浏览器实际携带的焦点位置。
    Object.defineProperties(wheel, { clientX: { value: 250 }, clientY: { value: 175 } });
    act(() => viewport().dispatchEvent(wheel));
    expect(wheel.defaultPrevented).toBe(true);
    expect(bubble).not.toHaveBeenCalled();
    expect(Number(viewport().dataset.scale)).toBeGreaterThan(1);
    expect(container.querySelector<HTMLElement>(".media-zoom-transform")!.style.transform).not.toContain("translate3d(0px, 0px");
    act(() => viewport().dispatchEvent(new MouseEvent("dblclick", { clientX: 200, clientY: 150, bubbles: true })));
    expect(Number(viewport().dataset.scale)).toBe(1);
  });

  it("键盘可以移动放大图片，并在窗口边缘停止", () => {
    act(() => root.render(<Harness />));
    load();
    act(() => viewport().dispatchEvent(new MouseEvent("dblclick", { clientX: 200, clientY: 150, bubbles: true })));
    act(() => { for (let i = 0; i < 20; i++) viewport().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })); });
    expect(container.querySelector<HTMLElement>(".media-zoom-transform")!.style.transform).toContain("translate3d(-200px, 0px");
  });

  it("视频保留播放器的滚轮与原生控件，不进行图片缩放", () => {
    act(() => root.render(<Harness video />));
    const wheel = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    act(() => viewport().dispatchEvent(wheel));
    expect(wheel.defaultPrevented).toBe(false);
    expect(viewport().dataset.scale).toBe("1");
    expect(container.querySelector("video")?.controls).toBe(true);
  });

  it("双指缩放后可以拖动，手势取消与卸载后停止处理事件", () => {
    act(() => root.render(<Harness />));
    load();
    const surface = viewport();
    surface.setPointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => false);
    const pointer = (type: string, id: number, x: number, y = 150) => surface.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, cancelable: true }));
    act(() => { pointer("pointerdown", 1, 150); pointer("pointerdown", 2, 250); });
    act(() => { pointer("pointermove", 1, 100); pointer("pointermove", 2, 300); });
    expect(Number(surface.dataset.scale)).toBeCloseTo(2);
    act(() => pointer("pointerup", 1, 100));
    act(() => pointer("pointermove", 2, 320, 170));
    const moved = container.querySelector<HTMLElement>(".media-zoom-transform")!.style.transform;
    expect(moved).toContain("translate3d(20px, 20px");
    act(() => pointer("pointercancel", 2, 320, 170));
    act(() => pointer("pointermove", 2, 350, 200));
    expect(container.querySelector<HTMLElement>(".media-zoom-transform")!.style.transform).toBe(moved);
    expect(surface.classList.contains("is-dragging")).toBe(false);
    act(() => root.render(null));
    const wheel = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    surface.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });
});
