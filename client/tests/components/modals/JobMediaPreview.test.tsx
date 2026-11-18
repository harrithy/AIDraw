import React, { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { DrawJob } from "@/types";
import { JobMediaPreview } from "@/components/modals/JobMediaPreview";

const mocks = vi.hoisted(() => ({ download: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/download", () => ({ downloadImage: mocks.download }));
vi.mock("@/components/ui/message", () => ({ Message: { success: mocks.success, error: mocks.error } }));
// 保留真实工具菜单与事件，只跳过依赖真实帧的弹层动画。
vi.mock("@/hooks/useModalTransition", () => ({ useModalTransition: ({ open }: { open: boolean }) => open }));

const job: DrawJob = {
  id: "job-a", folderId: "folder-a", mode: "text-to-image", status: "completed", prompt: "测试任务",
  negativePrompt: "", model: "gpt-image-2", thinking: "high", count: 1, width: 1024, height: 1024,
  orderIndex: 0, posX: 0, posY: 0, createdAt: "2026-11-18T00:00:00Z", updatedAt: "2026-11-18T00:00:00Z"
};
const image = { url: "https://example.test/selected.png", alt: "预览结果" };

describe("任务预览顶部操作", () => {
  let container: HTMLDivElement;
  let root: Root;
  let close: Mock<() => void>;
  let retry: Mock<(jobId: string) => void>;
  let edit: Mock<(job: DrawJob) => void>;
  let remove: Mock<(jobId: string) => void>;
  let upload: Mock<(jobId: string) => Promise<void>>;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    close = vi.fn<() => void>(); retry = vi.fn<(jobId: string) => void>(); edit = vi.fn<(job: DrawJob) => void>();
    remove = vi.fn<(jobId: string) => void>(); upload = vi.fn<(jobId: string) => Promise<void>>().mockResolvedValue(undefined);
    mocks.download.mockReset().mockResolvedValue(undefined);
    mocks.success.mockReset(); mocks.error.mockReset();
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  const render = (props: Partial<ComponentProps<typeof JobMediaPreview>> = {}) => act(() => root.render(
    <JobMediaPreview job={job} items={[image]} onClose={close} onRetry={retry} onEditRetry={edit}
      onDelete={remove} onUploadLatestMedia={upload} downloadName="测试任务" {...props} />
  ));
  const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const item = (label: string) => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((element) => element.textContent === label)!;
  const openMenu = async (label: string) => {
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    await act(async () => {
      const trigger = button(label); trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
  };

  it("顶部保留下载、复制、引用等功能，点击不会关闭且没有排序操作", async () => {
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const useImage = vi.fn();
    render({ onUseImage: useImage });
    await act(async () => button("复制图片链接").click());
    expect(copy).toHaveBeenCalledExactlyOnceWith(image.url);
    await act(async () => button("下载图片").click());
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(image.url, "测试任务", "image");
    act(() => button("作为参考图引用").click());
    expect(useImage).toHaveBeenCalledExactlyOnceWith(image.url);
    expect(close).not.toHaveBeenCalled();
    expect(document.querySelector('.media-viewer-header [title="上移"], .media-viewer-header [title="下移"]')).toBeNull();
  });

  it("重绘菜单支持继续绘制和重新编辑，编辑前关闭全屏预览", async () => {
    render();
    await openMenu("重新绘制");
    await act(async () => item("继续绘制").click());
    expect(retry).toHaveBeenCalledExactlyOnceWith(job.id);
    expect(close).not.toHaveBeenCalled();
    await openMenu("重新绘制");
    await act(async () => item("重新编辑").click());
    expect(edit).toHaveBeenCalledExactlyOnceWith(job);
    expect(close).toHaveBeenCalledOnce();
    expect(close.mock.invocationCallOrder[0]).toBeLessThan(edit.mock.invocationCallOrder[0]);
  });

  it("能力任务保留继续操作，运行中的任务不显示重绘入口", async () => {
    render({ job: { ...job, capabilityId: "image.gpt-image-2" } });
    await openMenu("重新绘制");
    expect(item("重新编辑")).toBeUndefined();
    expect(item("继续绘制")).toBeDefined();
    render({ job: { ...job, status: "running" } });
    expect(button("重新绘制")).toBeNull();
  });

  it("删除必须再次确认，取消与菜单 Escape 都不关闭图片", async () => {
    render();
    await openMenu("删除盒子");
    expect(remove).not.toHaveBeenCalled();
    await act(async () => item("取消").click());
    expect(remove).not.toHaveBeenCalled();
    await openMenu("删除盒子");
    await act(async () => document.querySelector('[role="menu"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(close).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    await openMenu("删除盒子");
    await act(async () => item("确定删除").click());
    expect(remove).toHaveBeenCalledExactlyOnceWith(job.id);
  });

  it("图床上传阻止重复提交，失败后可重试当前任务", async () => {
    let reject!: (error: Error) => void;
    upload.mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    render();
    act(() => { button("上传最新结果到图床").click(); button("上传最新结果到图床").click(); });
    expect(upload).toHaveBeenCalledExactlyOnceWith(job.id);
    expect(button("上传最新结果到图床").disabled).toBe(true);
    await act(async () => reject(new Error("图床暂不可用")));
    expect(mocks.error).toHaveBeenCalledWith("图床暂不可用");
    expect(button("上传最新结果到图床").disabled).toBe(false);
    await act(async () => button("上传最新结果到图床").click());
    expect(upload).toHaveBeenCalledTimes(2);
    expect(mocks.success).toHaveBeenCalledWith("最新结果已上传到图床");
  });
});
