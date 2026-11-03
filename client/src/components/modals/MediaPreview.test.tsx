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
  /** 使用真实菜单的键盘入口，覆盖焦点和关闭行为。 */
  const openDownloadMenu = async () => {
    // 等预览的首帧自动聚焦结束，再模拟用户打开菜单。
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    await act(async () => {
      const button = findButton("选择下载版本");
      button.focus();
      button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
  };
  const findVersion = (version: number) => document.querySelector<HTMLElement>(`[role="menuitem"][aria-label^="下载 V${version}"]`)!;

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

  it.each([1, 2, 3])("可选择下载 V%i，使用该版本链接并在文件名中标出版本", async (version) => {
    const onClose = vi.fn();
    act(() => root.render(<MediaPreview items={versions} onClose={onClose} downloadName="生成图片" />));
    await openDownloadMenu();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
    expect(findVersion(3).textContent).toContain("当前版本");
    expect(findVersion(version).querySelector("img")?.getAttribute("src")).toBe(versions[version - 1].url);
    await act(async () => findVersion(version).click());
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(versions[version - 1].url, `V${version} 生成图片`, "image");
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(findButton("与当前版本对比 V2").getAttribute("aria-pressed")).toBe("true");
  });

  it("Escape 优先关闭版本菜单，再次按下才关闭预览", async () => {
    const onClose = vi.fn();
    act(() => root.render(<MediaPreview items={versions} onClose={onClose} downloadName="生成图片" />));
    await openDownloadMenu();
    await act(async () => document.querySelector('[role="menu"]')!.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape", bubbles: true, cancelable: true
    })));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("切换任务或更新版本列表时关闭旧菜单，重新打开后下载新任务图片", async () => {
    const render = (key: string, items: PreviewMedia[]) => act(() => root.render(
      <MediaPreview items={items} comparisonKey={key} onClose={vi.fn()} downloadName="新任务" />
    ));
    render("job-a", versions);
    await openDownloadMenu();
    const nextVersions = versions.slice(0, 2).map((item) => ({ ...item, url: item.url.replace("/v", "/next-v") }));
    render("job-b", nextVersions);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    await openDownloadMenu();
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    await act(async () => findVersion(1).click());
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(nextVersions[0].url, "V1 新任务", "image");
    await openDownloadMenu();
    render("job-b", nextVersions.slice(0, 1));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(findButton("下载图片")).not.toBeNull();
  });

  it("版本下载期间阻止重复请求，失败后可以重试原版本", async () => {
    let reject!: (error: Error) => void;
    mocks.download.mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    act(() => root.render(<MediaPreview items={versions} onClose={vi.fn()} downloadName="生成图片" />));
    await openDownloadMenu();
    const firstVersion = findVersion(1);
    act(() => { firstVersion.click(); firstVersion.click(); });
    expect(mocks.download).toHaveBeenCalledTimes(1);
    expect(findButton("选择下载版本").disabled).toBe(true);
    await act(async () => reject(new Error("下载失败")));
    expect(mocks.error).toHaveBeenCalledWith("下载失败，请重试");
    expect(findButton("选择下载版本").disabled).toBe(false);
    await openDownloadMenu();
    await act(async () => findVersion(1).click());
    expect(mocks.download).toHaveBeenLastCalledWith(versions[0].url, "V1 生成图片", "image");
    expect(mocks.download).toHaveBeenCalledTimes(2);
  });

  it("历史版本按各自的媒体类型下载", async () => {
    act(() => root.render(<MediaPreview items={[{ ...versions[0], kind: "video" }, versions[1]]}
      onClose={vi.fn()} downloadName="混合版本" />));
    await openDownloadMenu();
    await act(async () => findVersion(1).click());
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(versions[0].url, "V1 混合版本", "video");
  });
});
