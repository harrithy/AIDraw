const IMAGE_UPLOAD_BASE_URL = "https://image.harrio.xyz";
const IMAGE_UPLOAD_ENDPOINT = `${IMAGE_UPLOAD_BASE_URL}/upload`;
const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

export type MediaKind = "image" | "video";

export type TransferredMedia = {
  url: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
};

const parseTargetUrl = (rawUrl: string) => {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("媒体地址仅支持 http/https");
  }
  return url;
};

const getPathExtension = (mediaUrl: URL) =>
  mediaUrl.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";

const getMediaKind = (mimeType: string, extension: string, expectedKind: MediaKind): MediaKind | null => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType && mimeType !== "application/octet-stream" && mimeType !== "binary/octet-stream") return null;
  if (["mp4", "webm", "mov"].includes(extension)) return "video";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(extension)) return "image";
  return expectedKind;
};

const getMimeType = (mimeType: string, extension: string, mediaKind: MediaKind) => {
  if (mimeType.startsWith(`${mediaKind}/`)) return mimeType;
  const mimeTypes: Record<string, string> = {
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    mov: "video/quicktime",
    mp4: "video/mp4",
    png: "image/png",
    svg: "image/svg+xml",
    webm: "video/webm",
    webp: "image/webp"
  };
  return mimeTypes[extension] ?? (mediaKind === "video" ? "video/mp4" : "image/png");
};

const getExtension = (mimeType: string, extension: string, mediaKind: MediaKind) => {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("svg")) return "svg";
  if (extension) return extension;
  return mediaKind === "video" ? "mp4" : "png";
};

const getUploadError = (payload: unknown, status: number) => {
  const data = payload as {
    error?: { message?: string };
    message?: string;
    msg?: string;
    data?: { description?: string; msg?: string };
  } | null;
  return [data?.error?.message, data?.message, data?.data?.msg, data?.data?.description, data?.msg]
    .find((value) => typeof value === "string" && value.trim()) ?? `HTTP ${status}`;
};

const extractUploadedUrl = (payload: unknown) => {
  if (!Array.isArray(payload)) return null;
  const item = payload.find((value) => value && typeof value === "object" && ("src" in value || "url" in value)) as
    | { src?: unknown; url?: unknown }
    | undefined;
  const rawUrl = typeof item?.src === "string" ? item.src : typeof item?.url === "string" ? item.url : "";
  return rawUrl ? new URL(rawUrl, IMAGE_UPLOAD_BASE_URL).toString() : null;
};

/** 服务端读取远程媒体后直接转发到图床，避免把大文件返回给浏览器。 */
export const transferRemoteMedia = async (
  mediaUrl: string,
  jobId: string,
  expectedKind: MediaKind
): Promise<TransferredMedia> => {
  const targetUrl = parseTargetUrl(mediaUrl);
  const extension = getPathExtension(targetUrl);
  const response = await fetch(targetUrl, {
    headers: { "user-agent": "aidraw-media-transfer/1.0" }
  });
  if (!response.ok) throw new Error(`读取远程媒体失败：HTTP ${response.status}`);

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_MEDIA_BYTES) throw new Error("媒体文件过大，无法上传");

  const sourceMimeType = (response.headers.get("content-type") || "application/octet-stream")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const mediaKind = getMediaKind(sourceMimeType, extension, expectedKind);
  if (!mediaKind) throw new Error("远程服务器返回的不是图片或视频");

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_MEDIA_BYTES) throw new Error("媒体文件过大，无法上传");

  const mimeType = getMimeType(sourceMimeType, extension, mediaKind);
  const fileExtension = getExtension(mimeType, extension, mediaKind);
  const safeJobId = jobId.replace(/[^a-z0-9_-]/gi, "-") || "media";
  const originalName = `aidraw-${safeJobId}.${fileExtension}`;
  const body = new FormData();
  body.append("file", new Blob([buffer], { type: mimeType }), originalName);

  const uploadResponse = await fetch(IMAGE_UPLOAD_ENDPOINT, { method: "POST", body });
  const payload = await uploadResponse.json().catch(() => null);
  if (!uploadResponse.ok) {
    throw new Error(`图床上传失败：${getUploadError(payload, uploadResponse.status)}`);
  }

  const uploadedUrl = extractUploadedUrl(payload);
  if (!uploadedUrl) throw new Error("图床上传成功，但未返回媒体地址");
  return { url: uploadedUrl, originalName, mimeType, byteSize: buffer.byteLength };
};
