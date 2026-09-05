import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MugiPet } from "./MugiPet";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("MugiPet", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(window, "requestAnimationFrame");
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const mockReducedMotion = (matches: boolean) => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  };

  it("减少动效时使用静态图片且不启动动画帧循环", () => {
    mockReducedMotion(true);

    act(() => root.render(<MugiPet />));

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("/mugi/idle.png");
    expect(image?.getAttribute("alt")).toBe("Mugi 桌宠");
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("普通模式待机时不持续请求动画帧", () => {
    mockReducedMotion(false);

    act(() => root.render(<MugiPet />));

    expect(container.querySelector("img")?.getAttribute("src")).toBe("/mugi/idle.gif");
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
