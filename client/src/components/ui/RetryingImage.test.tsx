import React, { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RetryingImage } from "./RetryingImage";

/** 在被动副作用之前触发 load，模拟已缓存图片的快速加载时序。 */
function CachedImage({ src }: { src: string }) {
  useLayoutEffect(() => {
    document.querySelector("img")!.dispatchEvent(new Event("load"));
  }, [src]);
  return <RetryingImage src={src} alt="缓存图片" />;
}

describe("图片加载与重试", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("缓存图片提前加载成功后不会被重新标记为加载中", () => {
    act(() => root.render(<CachedImage src="https://example.test/cached.png" />));
    expect(container.querySelector(".image-skeleton-placeholder")).toBeNull();
    expect(container.querySelector("img")?.classList.contains("is-loaded")).toBe(true);
    act(() => root.render(<CachedImage src="https://example.test/another-cached.png" />));
    expect(container.querySelector(".image-skeleton-placeholder")).toBeNull();
  });

  it("地址变化会取消旧重试，并为新图片重新显示加载状态", () => {
    act(() => root.render(<RetryingImage src="https://example.test/old.png" alt="旧图" />));
    act(() => container.querySelector("img")!.dispatchEvent(new Event("error")));
    act(() => root.render(<RetryingImage src="https://example.test/new.png" alt="新图" />));
    const image = container.querySelector("img");
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelector("img")).toBe(image);
    expect(container.querySelector(".image-skeleton-placeholder")).toBeTruthy();
    act(() => image!.dispatchEvent(new Event("load")));
    expect(container.querySelector(".image-skeleton-placeholder")).toBeNull();
  });

  it("连续失败达到五次后停止重试并显示失败状态", () => {
    act(() => root.render(<RetryingImage src="https://example.test/missing.png" alt="失败图片" />));
    for (let attempt = 1; attempt <= 5; attempt++) {
      act(() => container.querySelector("img")!.dispatchEvent(new Event("error")));
      act(() => vi.advanceTimersByTime(1000));
    }
    const lastImage = container.querySelector("img");
    act(() => vi.advanceTimersByTime(5000));
    expect(container.querySelector("img")).toBe(lastImage);
    expect(container.textContent).toContain("加载失败");
  });
});
