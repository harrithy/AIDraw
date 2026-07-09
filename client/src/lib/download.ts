const contentTypeToExtension = (contentType: string) => {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "png";
};

const getExtensionFromUrl = (imageUrl: string) => {
  try {
    const extension = new URL(imageUrl).pathname.match(/\.([a-z0-9]+)$/i)?.[1];
    return extension ? extension.toLowerCase() : "png";
  } catch {
    return "png";
  }
};

const sanitizeFileName = (value: string) => {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 80) || "aidraw-image";
};

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
