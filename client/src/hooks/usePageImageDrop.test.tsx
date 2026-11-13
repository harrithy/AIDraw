import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePageImageDrop } from "./usePageImageDrop";

/** 只构造浏览器拖拽事件所需字段，可模拟拖入前尚不可读取的文件列表。 */
const transfer = (types = ["Files"], files: File[] = []): DataTransfer => ({
  types,
  files,
  getData: () => "",
  dropEffect: "none"
}) as unknown as DataTransfer;
const dragEvent = (type: string, dataTransfer: DataTransfer) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event;
};
const Harness = ({ onDrop, onLocalDrop }: {
  onDrop: (dataTransfer: DataTransfer) => void;
  onLocalDrop?: () => void;
}) => {
  const active = usePageImageDrop(onDrop);
  return <section data-active={String(active)} onDrop={onLocalDrop}><span>画布中的任务卡片</span></section>;
};

describe("全页图片拖拽", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mounted = true;
  });
  afterEach(() => {
    if (mounted) act(() => root.unmount());
    container.remove();
  });

  it("在任意页面区域接管文件投放，表单自身不会再重复接收", () => {
    const onDrop = vi.fn();
    const onLocalDrop = vi.fn();
    act(() => root.render(<Harness onDrop={onDrop} onLocalDrop={onLocalDrop} />));
    const data = transfer(["Files"], [new File(["image"], "test.png", { type: "image/png" })]);
    const event = dragEvent("drop", data);
    act(() => container.querySelector("span")!.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(onDrop).toHaveBeenCalledExactlyOnceWith(data);
    expect(onLocalDrop).not.toHaveBeenCalled();
  });

  it("进入子元素不会反复隐藏提示，离开网页或取消拖拽后清理状态", () => {
    act(() => root.render(<Harness onDrop={vi.fn()} />));
    const data = transfer();
    const enter = dragEvent("dragenter", data);
    act(() => document.body.dispatchEvent(enter));
    act(() => container.querySelector("span")!.dispatchEvent(dragEvent("dragenter", data)));
    act(() => document.body.dispatchEvent(dragEvent("dragleave", data)));
    expect(enter.defaultPrevented).toBe(true);
    expect(container.querySelector("section")?.dataset.active).toBe("true");
    act(() => document.body.dispatchEvent(dragEvent("dragleave", data)));
    expect(container.querySelector("section")?.dataset.active).toBe("false");
    act(() => document.body.dispatchEvent(dragEvent("dragenter", data)));
    act(() => window.dispatchEvent(new Event("dragend")));
    expect(container.querySelector("section")?.dataset.active).toBe("false");
  });

  it("普通文本拖动不被拦截", () => {
    const onDrop = vi.fn();
    act(() => root.render(<Harness onDrop={onDrop} />));
    for (const type of ["dragenter", "dragover", "drop"]) {
      const event = dragEvent(type, transfer(["text/plain"]));
      act(() => document.body.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("素材链接可复用，非图片文件交由接收器校验且不触发浏览器导航", () => {
    const onDrop = vi.fn();
    act(() => root.render(<Harness onDrop={onDrop} />));
    const url = dragEvent("drop", transfer(["text/uri-list"]));
    const otherFile = dragEvent("drop", transfer(["Files"], [new File(["pdf"], "test.pdf", { type: "application/pdf" })]));
    act(() => document.body.dispatchEvent(url));
    act(() => document.body.dispatchEvent(otherFile));
    expect(url.defaultPrevented).toBe(true);
    expect(otherFile.defaultPrevented).toBe(true);
    expect(onDrop).toHaveBeenCalledTimes(2);
  });

  it("编辑目标切换后只调用最新接收器，卸载后清除全局监听", () => {
    const composerDrop = vi.fn();
    const editorDrop = vi.fn();
    act(() => root.render(<Harness onDrop={composerDrop} />));
    act(() => root.render(<Harness onDrop={editorDrop} />));
    act(() => document.body.dispatchEvent(dragEvent("drop", transfer())));
    expect(editorDrop).toHaveBeenCalledOnce();
    expect(composerDrop).not.toHaveBeenCalled();
    act(() => root.unmount());
    mounted = false;
    const afterUnmount = dragEvent("drop", transfer());
    document.body.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
    expect(editorDrop).toHaveBeenCalledOnce();
  });
});
