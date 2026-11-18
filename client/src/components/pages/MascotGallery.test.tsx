import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MascotGallery } from "./MascotGallery";

vi.mock("./MascotLive2DStudio", () => ({ MascotLive2DStudio: () => <div role="region" aria-label="原创少女 Live2D 展示">Live2D</div> }));

describe("项目形象馆", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it("切换形象时同步主视觉、图标预览与下载目标", async () => {
    await act(async () => root.render(<MascotGallery />));
    const chibi = container.querySelector<HTMLButtonElement>('[aria-label="查看Q 版形象"]')!;
    await act(async () => chibi.click());
    expect(chibi.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".mascot-main-art")?.getAttribute("src")).toBe("/mascot/aidraw-girl-chibi-v1.png");
    expect(container.querySelector(".mascot-download-button")?.getAttribute("href")).toBe("/mascot/aidraw-girl-chibi-v1.png");
    expect(container.querySelector(".mascot-icon-samples img")?.getAttribute("src")).toBe("/mascot/aidraw-girl-chibi-v1.png");
  });

  it("默认展示原创 Live2D，切换画风时移除运行时", async () => {
    await act(async () => root.render(<MascotGallery />));
    expect(container.querySelector('[aria-label="原创少女 Live2D 展示"]')).not.toBeNull();
    expect(container.querySelector(".mascot-main-art")).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="查看坨坨脸形象"]')!.click());
    expect(container.querySelector('[aria-label="原创少女 Live2D 展示"]')).toBeNull();
    expect(container.querySelector(".mascot-main-art")?.getAttribute("src")).toBe("/mascot/aidraw-girl-face-v1.png");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="查看Live2D形象"]')!.click());
    expect(container.querySelector('[aria-label="原创少女 Live2D 展示"]')).not.toBeNull();
  });
});
