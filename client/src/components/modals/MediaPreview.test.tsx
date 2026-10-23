import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPreview, type PreviewMedia } from "./MediaPreview";

const mocks = vi.hoisted(() => ({ download: vi.fn(), error: vi.fn() }));
vi.mock("../../lib/download", () => ({ downloadImage: mocks.download }));
vi.mock("../ui/message", () => ({ Message: { error: mocks.error } }));
// 只跳过入退场动画，保留真实弹层的关闭、焦点与键盘处理。
vi.mock("../../hooks/useModalTransition", () => ({ useModalTransition: ({ open }: { open: boolean }) => open }));

const image: PreviewMedia = { url: "https://example.test/image.png", alt: "参考图片" };
const versions: PreviewMedia[] = [1, 2, 3].map((version) => ({
  url: `https://example.test/v${version}.png`, alt: `版本 ${version}`
}));

describe("公共媒体预览", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.download.mockReset().mockResolvedValue(undefined);
    mocks.error.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const findButton = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it("空数据不弹窗，单图共用加载组件、说明和关闭操作", () => {
    const onClose = vi.fn();
    act(() => root.render(<MediaPreview items={[]} onClose={onClose} />));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    act(() => root.render(<MediaPreview items={[image]} onClose={onClose} title="参考图.png" description="参考图片" />));
    expect(document.querySelector(".media-preview-content .retrying-image-wrapper img")?.getAttribute("src")).toBe(image.url);
    expect(document.body.textContent).toContain("参考图.png");
    expect(findButton("下载图片")).toBeNull();
    act(() => findButton("关闭预览").click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("遮罩和 Escape 都关闭公共弹层，点击内容不误关闭", () => {
    const onClose = vi.fn();
    act(() => root.render(<MediaPreview items={[image]} onClose={onClose} />));
    act(() => document.querySelector<HTMLElement>(".image-preview-panel")!.click());
    expect(onClose).not.toHaveBeenCalled();
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    act(() => document.querySelector<HTMLElement>('[role="dialog"]')!.click());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("引用操作和入口扩展操作使用当前图片", () => {
    const onUseImage = vi.fn();
    const copy = vi.fn();
    act(() => root.render(<MediaPreview items={[image]} onClose={vi.fn()} onUseImage={onUseImage}
      actions={[{ id: "copy", label: "复制链接", icon: <span>复制</span>, onClick: copy }]} />));
    act(() => findButton("作为参考图引用").click());
    act(() => findButton("复制链接").click());
    expect(onUseImage).toHaveBeenCalledExactlyOnceWith(image.url);
    expect(copy).toHaveBeenCalledOnce();
  });

  it("下载期间阻止重复请求，完成后恢复按钮", async () => {
    let finish!: () => void;
    mocks.download.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    act(() => root.render(<MediaPreview items={[image]} onClose={vi.fn()} downloadName="原图" />));
    const button = findButton("下载图片");
    act(() => { button.click(); button.click(); });
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(image.url, "原图", "image");
    expect(button.disabled).toBe(true);
    await act(async () => { finish(); });
    expect(button.disabled).toBe(false);
  });

  it("下载失败后提供反馈并允许重试", async () => {
    mocks.download.mockRejectedValueOnce(new Error("下载失败"));
    act(() => root.render(<MediaPreview items={[image]} onClose={vi.fn()} downloadName="原图" />));
    await act(async () => findButton("下载图片").click());
    expect(mocks.error).toHaveBeenCalledWith("下载失败，请重试");
    expect(findButton("下载图片").disabled).toBe(false);
    await act(async () => findButton("下载图片").click());
    expect(mocks.download).toHaveBeenCalledTimes(2);
  });

  it("视频仍使用视频播放器和视频下载，不显示参考图操作", async () => {
    act(() => root.render(<MediaPreview items={[{ ...image, kind: "video" }]} onClose={vi.fn()} downloadName="视频" onUseImage={vi.fn()} />));
    expect(document.querySelector(".media-preview-content video")?.getAttribute("src")).toBe(image.url);
    expect(findButton("作为参考图引用")).toBeNull();
    await act(async () => findButton("下载视频").click());
    expect(mocks.download).toHaveBeenCalledWith(image.url, "视频", "video");
  });

  it("默认对比最近旧版本，可切换且不会串到另一个任务", () => {
    const renderPreview = (key: string, items = versions) => act(() => root.render(<MediaPreview items={items} comparisonKey={key} onClose={vi.fn()} />));
    renderPreview("job-a");
    expect(findButton("与当前版本对比 V2").getAttribute("aria-pressed")).toBe("true");
    act(() => findButton("与当前版本对比 V1").click());
    expect(document.querySelector('.image-comparison-layer[aria-hidden="false"] img')?.getAttribute("src")).toBe(versions[0].url);
    renderPreview("job-b");
    expect(findButton("与当前版本对比 V2").getAttribute("aria-pressed")).toBe("true");
    // 历史被更新或缩短后，不保留越界的选中版本。
    renderPreview("job-b", versions.slice(0, 2));
    expect(document.querySelector('.image-comparison-layer[aria-hidden="false"] img')?.getAttribute("src")).toBe(versions[0].url);
  });
});
