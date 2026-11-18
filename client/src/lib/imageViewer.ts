/** 缩放倍率相对于“适应窗口”的初始画面，限制范围避免丢失图片。 */
export const MIN_VIEWER_SCALE = 0.25;
export const MAX_VIEWER_SCALE = 8;
export type ViewerPoint = { x: number; y: number };
export type ViewerSize = { width: number; height: number };
export type ImageViewerTransform = ViewerPoint & { scale: number };
export const FIT_IMAGE_VIEW: ImageViewerTransform = { scale: 1, x: 0, y: 0 };

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/** 以指定焦点缩放，焦点下的图片内容在变换前后保持同一屏幕位置。 */
export function zoomImageViewerAt(view: ImageViewerTransform, scale: number, point: ViewerPoint): ImageViewerTransform {
  const previous = clamp(finite(view.scale, 1), MIN_VIEWER_SCALE, MAX_VIEWER_SCALE);
  const next = clamp(finite(scale, previous), MIN_VIEWER_SCALE, MAX_VIEWER_SCALE);
  const ratio = next / previous;
  const x = finite(point.x, 0);
  const y = finite(point.y, 0);
  return {
    scale: next,
    x: x - (x - finite(view.x, 0)) * ratio,
    y: y - (y - finite(view.y, 0)) * ratio
  };
}

/** 基于图片实际比例限制平移；缩小或某个方向未超出视口时自动居中。 */
export function constrainImageViewer(view: ImageViewerTransform, viewport: ViewerSize, image: ViewerSize): ImageViewerTransform {
  const scale = clamp(finite(view.scale, 1), MIN_VIEWER_SCALE, MAX_VIEWER_SCALE);
  if (viewport.width <= 0 || viewport.height <= 0 || image.width <= 0 || image.height <= 0) return { scale, x: 0, y: 0 };
  const fit = Math.min(viewport.width / image.width, viewport.height / image.height);
  const limitX = Math.max(0, (image.width * fit * scale - viewport.width) / 2);
  const limitY = Math.max(0, (image.height * fit * scale - viewport.height) / 2);
  return { scale, x: limitX > 0 ? clamp(finite(view.x, 0), -limitX, limitX) : 0, y: limitY > 0 ? clamp(finite(view.y, 0), -limitY, limitY) : 0 };
}

/** 判断指针是否位于实际显示的图片内，避免 object-fit 留白被误认为图片。 */
export function isPointInsideViewerImage(point: ViewerPoint, view: ImageViewerTransform, viewport: ViewerSize, image: ViewerSize): boolean {
  // 加载中尚无尺寸时不把媒体误判为留白，重试按钮仍可正常使用。
  if (viewport.width <= 0 || viewport.height <= 0 || image.width <= 0 || image.height <= 0) return true;
  const fit = Math.min(viewport.width / image.width, viewport.height / image.height);
  const halfWidth = image.width * fit * view.scale / 2;
  const halfHeight = image.height * fit * view.scale / 2;
  return Math.abs(point.x - view.x) <= halfWidth && Math.abs(point.y - view.y) <= halfHeight;
}
