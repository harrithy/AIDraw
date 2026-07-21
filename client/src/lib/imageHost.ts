const IMAGE_UPLOAD_BASE_URL = "https://image.harrio.xyz";
const IMAGE_UPLOAD_PROXY_PATH = "/image-upload/upload";

type ImageUploadResponse = Array<{
  src?: string;
  url?: string;
}>;

const getErrorMessage = (payload: unknown, fallback: string) => {
  const data = payload as {
    error?: { code?: string; message?: string; type?: string };
    message?: string;
    msg?: string;
    data?: { description?: string; msg?: string };
  } | null;
  const message = [
    data?.error?.message,
    data?.message,
    data?.data?.msg,
    data?.data?.description,
    data?.msg
  ].find((value) => typeof value === "string" && value.trim());
  const details = [data?.error?.code, data?.error?.type].filter(Boolean).join(" / ");
  if (message && details) return `${message}（${details}）`;
  return message ?? fallback;
};

const extractUploadedImageUrl = (payload: ImageUploadResponse | null) => {
  const uploaded = payload?.find((item) => typeof item.src === "string" || typeof item.url === "string");
  const rawUrl = uploaded?.src ?? uploaded?.url;
  if (!rawUrl) throw new Error("图床上传成功，但未返回图片地址");
  return new URL(rawUrl, IMAGE_UPLOAD_BASE_URL).toString();
};

/** 上传本地图片，并返回图床提供的公网地址。 */
export const uploadImageToHost = async (file: File) => {
  const body = new FormData();
  body.append("file", file);

  try {
    const response = await fetch(IMAGE_UPLOAD_PROXY_PATH, { method: "POST", body });
    const payload = (await response.json().catch(() => null)) as ImageUploadResponse | null;
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `图床上传失败：HTTP ${response.status}`));
    }
    return extractUploadedImageUrl(payload);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("上传到图床失败：可能是网络不可达、CORS 限制，或 image.harrio.xyz 暂时不可用");
    }
    throw error;
  }
};

const imageExtensionFromType = (mimeType: string) => {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("svg")) return "svg";
  return "png";
};

/** 将远程生成结果转换为 File，供用户手动再次上传到图床。 */
export const createFileFromImageUrl = async (imageUrl: string, jobId: string) => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const mimeType = blob.type || "image/png";
    if (!mimeType.startsWith("image/")) throw new Error("返回内容不是图片");
    return new File([blob], `aidraw-${jobId}.${imageExtensionFromType(mimeType)}`, { type: mimeType });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("读取最新图片失败：图片服务器可能不允许浏览器跨域读取该文件");
    }
    throw new Error(`读取最新图片失败：${error instanceof Error ? error.message : "未知错误"}`);
  }
};
