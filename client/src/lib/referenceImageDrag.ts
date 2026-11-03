import type { UploadedImage } from "../types";

/** 素材拖拽只传递已上传图片的链接和名称，不重新上传图片文件。 */
export const REFERENCE_IMAGE_DRAG_TYPE = "application/x-aidraw-reference-image";
export type DraggedReferenceImage = { url: string; originalName: string };

const isHttpUrl = (value: string) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
};

const isVideoUrl = (value: string) => /\.(?:mp4|webm|mov|m4v|m3u8)(?:[?#]|$)/i.test(value);

/** dragover 阶段不能读取负载，只根据类型判断是否为可接收的图片链接。 */
export const hasReferenceImageDrag = (transfer: DataTransfer): boolean =>
  Array.from(transfer.types).some((type) => type === REFERENCE_IMAGE_DRAG_TYPE || type === "text/uri-list");

export const writeReferenceImageDrag = (transfer: DataTransfer, image: UploadedImage): boolean => {
  if (!isHttpUrl(image.url) || (image.mimeType && !image.mimeType.startsWith("image/")) || isVideoUrl(image.url)) return false;
  transfer.effectAllowed = "copy";
  transfer.setData(REFERENCE_IMAGE_DRAG_TYPE, JSON.stringify({
    url: image.url, originalName: image.originalName, mimeType: image.mimeType
  }));
  transfer.setData("text/uri-list", image.url);
  transfer.setData("text/plain", image.url);
  return true;
};

/** 自定义负载损坏时拒绝回退，避免把视频或非法地址伪装成普通图片链接。 */
export const readReferenceImageDrag = (transfer: DataTransfer): DraggedReferenceImage | null => {
  if (Array.from(transfer.types).includes(REFERENCE_IMAGE_DRAG_TYPE)) {
    try {
      const image = JSON.parse(transfer.getData(REFERENCE_IMAGE_DRAG_TYPE));
      if (typeof image?.url !== "string" || !isHttpUrl(image.url) || isVideoUrl(image.url) ||
        (typeof image.mimeType === "string" && image.mimeType && !image.mimeType.startsWith("image/"))) return null;
      return { url: image.url.trim(), originalName: typeof image.originalName === "string" ? image.originalName : "参考图片" };
    } catch { return null; }
  }
  const url = transfer.getData("text/uri-list").split(/\r?\n/).map((value) => value.trim())
    .find((value) => value && !value.startsWith("#"));
  return url && isHttpUrl(url) && !isVideoUrl(url) ? { url, originalName: "参考图片" } : null;
};
