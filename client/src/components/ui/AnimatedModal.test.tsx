import gsap from "gsap";
import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedModal } from "./AnimatedModal";

describe("AnimatedModal 动画生命周期", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const renderModal = (open: boolean) => {
    act(() => root.render(
      <StrictMode>
        <AnimatedModal open={open} onClose={() => undefined} ariaLabel="动画预览">
          <button type="button">预览操作</button>
        </AnimatedModal>
      </StrictMode>
    ));
  };

  // 主动推进实际 GSAP 时间线，验证生命周期，不依赖机器的帧率和等待时间。
  const finishTransition = () => {
    const panel = document.querySelector(".animated-modal-panel");
    const timelines = new Set(gsap.getTweensOf(panel).map((tween) => tween.parent));
    act(() => timelines.forEach((timeline) => timeline?.progress(1)));
  };

  it("关闭时保留内容，退场完成后才卸载遮罩", () => {
    renderModal(true);
    finishTransition();
    renderModal(false);
    expect(document.querySelector("[role='dialog']")?.textContent).toContain("预览操作");
    finishTransition();
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });

  it("快速重新打开会取消旧退场，不会被旧时间线卸载", () => {
    renderModal(true);
    finishTransition();
    renderModal(false);
    renderModal(true);
    finishTransition();
    const panel = document.querySelector<HTMLElement>(".animated-modal-panel");
    expect(panel).not.toBeNull();
    expect(panel!.style.opacity).toBe("1");
    expect(panel!.style.visibility).toBe("inherit");
  });

  it("减少动态效果时直接关闭，不残留遮罩或运行中的动画", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    renderModal(true);
    const panel = document.querySelector(".animated-modal-panel");
    expect(gsap.getTweensOf(panel)).toHaveLength(0);
    renderModal(false);
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });
});
