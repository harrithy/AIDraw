/**
 * 根据 Content-Type 推断文件扩展名
 * 从 response blob 的 MIME 类型反推后缀
 */
const contentTypeToExtension = (contentType: string) => {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "png";
};

/**
 * 从图片 URL 中提取文件扩展名
 * 例如 `https://example.com/image.png?w=100` → `png`
 */
const getExtensionFromUrl = (imageUrl: string) => {
  try {
    const extension = new URL(imageUrl).pathname.match(/\.([a-z0-9]+)$/i)?.[1];
    return extension ? extension.toLowerCase() : "png";
  } catch {
    return "png";
  }
};

/**
 * 清理文件名，替换非法字符为空格
 * Windows/Mac/Linux 文件名都不能包含 < > : " / \\ | ? * 和控制字符
 */
const sanitizeFileName = (value: string) => {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 80) || "aidraw-image";
};

/**
 * 触发浏览器下载
 * 创建一个隐藏的 `<a>` 标签并模拟点击，下载完成后自动清理
 * @param href - 下载链接（blob URL 或 data URL）
 * @param fileName - 下载文件名
 * @param openInNewTab - 是否在新标签页打开（用于无法直接下载的场景）
 */
const triggerDownload = (href: string, fileName: string, openInNewTab = false) => {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  if (openInNewTab) {
    link.target = "_blank";
    link.rel = "noreferrer";
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
};

/**
 * 下载 AI 生成的图片到本地
 * 先从远端 fetch 图片的 blob，再根据 MIME 类型确定扩展名，最后触发下载
 * 如果 fetch 失败（可能跨域），则退化为直接打开图片链接
 * @param imageUrl - 图片的远程 URL
 * @param prompt - 原始提示词（用作文件名的一部分）
 */
export const downloadImage = async (imageUrl: string, prompt: string) => {
  const baseName = sanitizeFileName(`AIDraw ${prompt}`);
  const fallbackName = `${baseName}.${getExtensionFromUrl(imageUrl)}`;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const extension = contentTypeToExtension(blob.type);
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, `${baseName}.${extension}`);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    // 跨域图片可能不允许转为 blob，失败时退回浏览器默认下载或新标签打开。
    triggerDownload(imageUrl, fallbackName, true);
  }
};
