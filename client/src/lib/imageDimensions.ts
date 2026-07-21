/**
 * 将像素尺寸或宽高比转换成画布预览使用的尺寸。
 * 最长边统一为 1024，避免卡片布局依赖具体绘图平台。
 */
export const dimensionsFromSize = (size: string) => {
  const fixedSize = /^(\d+)x(\d+)$/.exec(size);
  if (fixedSize) {
    const rawWidth = Number(fixedSize[1]);
    const rawHeight = Number(fixedSize[2]);
    const ratio = rawWidth / rawHeight;
    if (ratio >= 1) return { width: 1024, height: Math.round(1024 / ratio) };
    return { width: Math.round(1024 * ratio), height: 1024 };
  }

  const ratioSize = /^(\d+):(\d+)$/.exec(size);
  if (ratioSize) {
    const rawWidth = Number(ratioSize[1]);
    const rawHeight = Number(ratioSize[2]);
    const ratio = rawWidth / rawHeight;
    if (ratio >= 1) return { width: 1024, height: Math.round(1024 / ratio) };
    return { width: Math.round(1024 * ratio), height: 1024 };
  }

  return { width: 1024, height: 1024 };
};
