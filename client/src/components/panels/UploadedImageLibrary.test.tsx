import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadedImage } from "../../types";
import { UploadedImageLibrary } from "./UploadedImageLibrary";

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("../../hooks/useModalTransition", () => ({ useModalTransition: ({ open }: { open: boolean }) => open }));

const image: UploadedImage = {
  id: "image-1", folderId: "folder-1", url: "https://example.test/reference.png",
  originalName: "参考图片.png", mimeType: "image/png", byteSize: 1024,
  createdAt: "2026-10-23T06:00:00.000Z"
};

describe("素材库公共预览", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("从素材列表打开公共大图，Escape 只关闭大图，再次 Escape 才关闭列表", () => {
    act(() => root.render(<UploadedImageLibrary folderId="folder-1" folderName="测试" images={[image]} isLoading={false}
      onUseImage={vi.fn()} onDeleteImage={vi.fn()} />));
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="上传素材"]')!;
    act(() => trigger.click());
    act(() => container.querySelector<HTMLButtonElement>(".uploaded-image-preview-button")!.click());
    expect(document.querySelector(".media-preview-panel img")?.getAttribute("src")).toBe(image.url);
    expect(document.querySelector('[aria-label="作为参考图引用"]')).toBeTruthy();
    // 使用可取消的真实键盘事件，验证公共弹层与父级列表的事件协作。
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(document.querySelector(".media-preview-panel")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
