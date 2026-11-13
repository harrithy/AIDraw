import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hasReferenceImageDrag } from "../lib/referenceImageDrag";

/** 当前表单暴露的图片接收入口，复用各自的上传、去重和数量限制。 */
export type ImageDropTarget = {
  addDroppedImages: (transfer: DataTransfer) => void;
};

const hasImageDrop = (transfer: DataTransfer) =>
  hasReferenceImageDrag(transfer) || transfer.files.length > 0 || Array.from(transfer.types).includes("Files");

/** 全页捕获图片拖拽；一次投放只交给当前表单，普通文本拖动继续交给浏览器处理。 */
export const usePageImageDrop = (onDrop: (transfer: DataTransfer) => void): boolean => {
  const onDropRef = useRef(onDrop);
  const [isDragging, setIsDragging] = useState(false);

  useLayoutEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    let dragDepth = 0;
    const reset = () => {
      dragDepth = 0;
      setIsDragging(false);
    };
    const accept = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const enter = (event: DragEvent) => {
      if (!event.dataTransfer || !hasImageDrop(event.dataTransfer)) return;
      accept(event);
      dragDepth += 1;
      setIsDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!event.dataTransfer || !hasImageDrop(event.dataTransfer)) return;
      accept(event);
      setIsDragging(true);
    };
    const leave = () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setIsDragging(false);
    };
    const drop = (event: DragEvent) => {
      reset();
      if (!event.dataTransfer || !hasImageDrop(event.dataTransfer)) return;
      // 在捕获阶段接管投放，避免表单自身的 onDrop 再上传一次。
      accept(event);
      onDropRef.current(event.dataTransfer);
    };

    window.addEventListener("dragenter", enter, true);
    window.addEventListener("dragover", over, true);
    window.addEventListener("dragleave", leave, true);
    window.addEventListener("drop", drop, true);
    window.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("dragenter", enter, true);
      window.removeEventListener("dragover", over, true);
      window.removeEventListener("dragleave", leave, true);
      window.removeEventListener("drop", drop, true);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
    };
  }, []);

  return isDragging;
};
