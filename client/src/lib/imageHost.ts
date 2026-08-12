const IMAGE_UPLOAD_BASE_URL = "https://image.harrio.xyz";
const IMAGE_UPLOAD_PROXY_PATH = "/image-upload/upload";
const MEDIA_PROXY_PATH = "/api/media-proxy";

/**
 * 把远程媒体地址转换为同源代理地址，绕过浏览器 CORS 限制。
 * 本地开发由 vite 中间件处理，生产由 Vercel serverless（api/media-proxy.ts）处理。
 */
export const getMediaProxyUrl = (mediaUrl: string) => {
  try {
    const url = new URL(mediaUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return mediaUrl;
  } catch {
    return mediaUrl;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${MEDIA_PROXY_PATH}?url=${encodeURIComponent(mediaUrl)}`;
  }
  return mediaUrl;
};

type MediaUploadResponse = Array<{
  src?: string;
  url?: string;
}>;

type MediaKind = "image" | "video";

export type HostedRemoteMedia = {
  url: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  const data = payload as {
    error?: string | { code?: string; message?: string; type?: string };
    message?: string;
    msg?: string;
    data?: { description?: string; msg?: string };
  } | null;
  const apiError = data?.error;
  const message = [
    typeof apiError === "string" ? apiError : apiError?.message,
    data?.message,
    data?.data?.msg,
    data?.data?.description,
    data?.msg
  ].find((value) => typeof value === "string" && value.trim());
  const details = typeof apiError === "object" ? [apiError.code, apiError.type].filter(Boolean).join(" / ") : "";
  if (message && details) return `${message}（${details}）`;
  return message ?? fallback;
};

const extractUploadedMediaUrl = (payload: MediaUploadResponse | null) => {
  const uploaded = payload?.find((item) => typeof item.src === "string" || typeof item.url === "string");
  const rawUrl = uploaded?.src ?? uploaded?.url;
  if (!rawUrl) throw new Error("图床上传成功，但未返回媒体地址");
  return new URL(rawUrl, IMAGE_UPLOAD_BASE_URL).toString();
};

/** 上传本地图片或视频，并返回图床提供的公网地址。 */
export const uploadMediaToHost = async (file: File) => {
  const body = new FormData();
  body.append("file", file);

  try {
    const response = await fetch(IMAGE_UPLOAD_PROXY_PATH, { method: "POST", body });
    const payload = (await response.json().catch(() => null)) as MediaUploadResponse | null;
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `图床上传失败：HTTP ${response.status}`));
    }
    return extractUploadedMediaUrl(payload);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("上传到图床失败：可能是网络不可达、CORS 限制，或 image.harrio.xyz 暂时不可用");
    }
    throw error;
  }
};

/** 让同源服务端把远程媒体直接转存到图床，浏览器不再中转大文件。 */
export const uploadMediaUrlToHost = async (
  mediaUrl: string,
  jobId: string,
  expectedKind: MediaKind
): Promise<HostedRemoteMedia> => {
  try {
    const response = await fetch("/api/media-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaUrl, jobId, expectedKind })
    });
    const payload = (await response.json().catch(() => null)) as Partial<HostedRemoteMedia> | null;
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `远程媒体上传失败：HTTP ${response.status}`));
    }
    if (
      typeof payload?.url !== "string" ||
      typeof payload.originalName !== "string" ||
      typeof payload.mimeType !== "string" ||
      typeof payload.byteSize !== "number"
    ) {
      throw new Error("远程媒体上传成功，但返回结果不完整");
    }
    return payload as HostedRemoteMedia;
  } catch (error) {
    if (error instanceof TypeError) throw new Error("远程媒体上传服务暂时不可用");
    throw error;
  }
};

const mediaExtensionFromType = (mimeType: string, mediaUrl: string) => {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("mp4") || mimeType.startsWith("video/")) return "mp4";
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("svg")) return "svg";
  if (mimeType.startsWith("image/")) return "png";

  try {
    const extension = new URL(mediaUrl).pathname.match(/\.([a-z0-9]+)$/i)?.[1];
    if (extension) return extension.toLowerCase();
  } catch {
    // URL 已由调用方提供；解析失败时使用媒体类型的默认扩展名。
  }
  return "png";
};

const resolveMediaKind = (mimeType: string, mediaUrl: string, expectedKind: MediaKind) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType && mimeType !== "application/octet-stream" && mimeType !== "binary/octet-stream") return null;

  let extension = "";
  try {
    extension = new URL(mediaUrl).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";
  } catch {
    extension = "";
  }
  if (["mp4", "webm", "mov"].includes(extension)) return "video";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(extension)) return "image";
  return expectedKind;
};

/** 将远程生成结果转换为 File，供用户手动再次上传到图床。 */
export const createFileFromMediaUrl = async (mediaUrl: string, jobId: string, expectedKind: MediaKind) => {
  try {
    // 禁用浏览器缓存，避免部署路由修复后仍复用此前误返回的 index.html。
    const response = await fetch(getMediaProxyUrl(mediaUrl), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const mediaKind = resolveMediaKind(blob.type, mediaUrl, expectedKind);
    if (!mediaKind) throw new Error("返回内容不是图片或视频");

    const mimeType = blob.type.startsWith(`${mediaKind}/`)
      ? blob.type
      : mediaKind === "video"
        ? "video/mp4"
        : "image/png";
    const extension = mediaExtensionFromType(mimeType, mediaUrl);
    return new File([blob], `aidraw-${jobId}.${extension}`, { type: mimeType });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("读取最新媒体失败：远程服务器可能不允许浏览器跨域读取该文件");
    }
    throw new Error(`读取最新媒体失败：${error instanceof Error ? error.message : "未知错误"}`);
  }
};
