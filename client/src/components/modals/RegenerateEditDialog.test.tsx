import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrawJob, UploadedImage } from "../../types";
import { MAX_NANO_BANANA_REFERENCE_IMAGES, NANO_BANANA_2_1_MODEL } from "../../lib/imageModels";
import { REFERENCE_IMAGE_DRAG_TYPE, writeReferenceImageDrag } from "../../lib/referenceImageDrag";
import { RegenerateEditDialog } from "./RegenerateEditDialog";
import { UploadedImageLibrary } from "../panels/UploadedImageLibrary";

const { showError } = vi.hoisted(() => ({ showError: vi.fn() }));
vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("@/components/ui/prompt-polish", () => ({ PromptPolish: () => null }));
vi.mock("@/components/ui/message", () => ({ Message: { error: showError } }));

const asset: UploadedImage = {
  id: "asset", folderId: "folder", url: "https://example.test/table.png", originalName: "餐桌.png",
  mimeType: "image/png", byteSize: 100, createdAt: "2026-11-03"
};
const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job", folderId: "folder", mode: "image-to-image", status: "completed", prompt: "厨房设计",
  negativePrompt: "", width: 1024, height: 1024, count: 1, thinking: "high", model: "gpt-image-2",
  orderIndex: 0, posX: 0, posY: 0, createdAt: "2026-11-03", updatedAt: "2026-11-03",
  inputImageUrls: ["https://example.test/original.png"], ...overrides
});

/** 使用真实拖拽事件的字段形状，既覆盖链接复用，也覆盖原有文件上传路径。 */
const makeTransfer = (files: File[] = []) => {
  const values = new Map<string, string>();
  return {
    files,
    items: files.map((file) => ({ kind: "file", type: file.type })),
    get types() { return [...values.keys(), ...(files.length ? ["Files"] : [])]; },
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? ""
  } as unknown as DataTransfer;
};
const dragEvent = (type: string, transfer: DataTransfer) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  return event;
};

describe("重绘弹窗拖拽引用上传素材", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onUpload = vi.fn().mockResolvedValue({ url: "https://example.test/uploaded.png", originalName: "本地图片.png" });
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const render = async (job = makeJob(), isSubmitting = false) => {
    await act(async () => root.render(<>
      <UploadedImageLibrary folderId="folder" folderName="外部素材" images={[asset]} isLoading={false}
        referenceTargetActive onUseImage={() => {}} onDeleteImage={async () => {}} />
      <RegenerateEditDialog apiProviderId="duomi" open job={job}
        isSubmitting={isSubmitting} onClose={onClose} onUploadImage={onUpload} onConfirm={onConfirm} />
    </>));
  };
  const dialog = () => document.querySelector<HTMLElement>(".regenerate-edit-dialog")!;
  const drop = async (transfer: DataTransfer) => {
    const event = dragEvent("drop", transfer);
    await act(async () => dialog().querySelector("form")!.dispatchEvent(event));
    return event;
  };

  it("从同一份上传素材面板拖入，复用链接、保留名称并随原参数提交", async () => {
    await render();
    const source = container.querySelector<HTMLButtonElement>(".uploaded-image-preview-button")!;
    expect(dialog().querySelector(".uploaded-image-library-anchor")).toBeNull();
    expect(document.querySelectorAll(".uploaded-image-library-anchor")).toHaveLength(1);
    expect(container.querySelector(".uploaded-image-library-popover")?.getAttribute("aria-hidden")).toBe("false");
    expect(source.getAttribute("draggable")).toBe("true");
    await act(async () => source.focus());
    expect(document.activeElement).toBe(source);
    expect(onClose).not.toHaveBeenCalled();
    const transfer = makeTransfer();
    act(() => source.dispatchEvent(dragEvent("dragstart", transfer)));
    expect((await drop(transfer)).defaultPrevented).toBe(true);
    expect(dialog().querySelector('.composer-attachments img[alt="餐桌.png"]')?.getAttribute("src")).toBe(asset.url);
    expect(onUpload).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => dialog().querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(onConfirm).toHaveBeenCalledWith("job", expect.objectContaining({
      prompt: "厨房设计", inputImageUrls: ["https://example.test/original.png", asset.url]
    }));
  });

  it("外部面板点选的素材由编辑器消费", async () => {
    const onImageUsed = vi.fn();
    await act(async () => root.render(<RegenerateEditDialog apiProviderId="duomi" open job={makeJob()}
      isSubmitting={false} onClose={onClose} onUploadImage={onUpload} onConfirm={onConfirm}
      usedImage={asset.url} onImageUsed={onImageUsed} />));
    expect(dialog().querySelectorAll(".composer-attachments img")).toHaveLength(2);
    expect(onImageUsed).toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("重复拖入不增加参考图，达到模型上限后拒绝新图片", async () => {
    const urls = Array.from({ length: MAX_NANO_BANANA_REFERENCE_IMAGES }, (_, index) => `https://example.test/${index}.png`);
    await render(makeJob({ model: NANO_BANANA_2_1_MODEL, inputImageUrls: urls }));
    const duplicate = makeTransfer();
    writeReferenceImageDrag(duplicate, { ...asset, url: urls[0] });
    await drop(duplicate);
    expect(showError).not.toHaveBeenCalled();
    const extra = makeTransfer();
    writeReferenceImageDrag(extra, asset);
    await drop(extra);
    expect(showError).toHaveBeenCalledWith(expect.stringContaining("最多支持 10 张参考图"));
    expect(dialog().querySelectorAll(".composer-attachments img")).toHaveLength(10);
  });

  it("拒绝视频或非法拖拽负载，阻止浏览器默认打开地址", async () => {
    await render();
    const transfer = makeTransfer();
    transfer.setData(REFERENCE_IMAGE_DRAG_TYPE, JSON.stringify({ url: asset.url, mimeType: "video/mp4" }));
    expect((await drop(transfer)).defaultPrevented).toBe(true);
    expect(showError).toHaveBeenCalledWith("请拖入有效的图片素材");
    expect(dialog().querySelectorAll(".composer-attachments img")).toHaveLength(1);
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("继续支持本地文件拖入上传", async () => {
    await render();
    const file = new File(["image"], "本地图片.png", { type: "image/png" });
    await drop(makeTransfer([file]));
    expect(onUpload).toHaveBeenCalledExactlyOnceWith(file);
    expect(dialog().querySelectorAll(".composer-attachments img")).toHaveLength(2);
  });

  it("提交期间不允许添加素材，普通文本拖动不被图片处理器拦截", async () => {
    await render(makeJob(), true);
    const transfer = makeTransfer();
    writeReferenceImageDrag(transfer, asset);
    await drop(transfer);
    expect(showError).toHaveBeenCalledWith("正在处理图片，请稍后再添加参考图");
    const text = makeTransfer();
    text.setData("text/plain", "新的提示词");
    expect((await drop(text)).defaultPrevented).toBe(false);
    expect(dialog().querySelectorAll(".composer-attachments img")).toHaveLength(1);
  });
});
