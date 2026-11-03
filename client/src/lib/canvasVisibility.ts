import { getConnectionPath, type PositionedJob } from "./canvas";

/** 画布直接更新 transform 后，仅通知画布自身检查是否需要补充可见内容。 */
export const CANVAS_VIEWPORT_CHANGE = "aidraw-canvas-viewport-change";
export type CanvasTransform = { panX: number; panY: number; zoom: number };
export type CanvasViewport = CanvasTransform & { width: number; height: number };
export type CanvasBounds = { left: number; top: number; right: number; bottom: number };
export type CanvasLink = {
  from: PositionedJob;
  to: PositionedJob;
  index: number;
  path: string;
  bounds: CanvasBounds;
};

/** 将屏幕上的视口和预加载边距换算为未缩放的画布坐标。 */
export const getCanvasViewportBounds = (viewport: CanvasViewport, padding = 0): CanvasBounds => ({
  left: (-viewport.panX - padding) / viewport.zoom,
  top: (-viewport.panY - padding) / viewport.zoom,
  right: (viewport.width - viewport.panX + padding) / viewport.zoom,
  bottom: (viewport.height - viewport.panY + padding) / viewport.zoom
});

/** 边缘接触也视为相交，避免卡片和箭头在视口边界闪烁。 */
export const intersectsCanvasBounds = (a: CanvasBounds, b: CanvasBounds): boolean =>
  a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

export const containsCanvasBounds = (outer: CanvasBounds, inner: CanvasBounds): boolean =>
  outer.left <= inner.left && outer.top <= inner.top && outer.right >= inner.right && outer.bottom >= inner.bottom;

/** 卡片标题、工具和参考图可伸出卡片本体，裁剪时保留这些附属区域。 */
const getCardBounds = ({ x, y, cardSize }: PositionedJob, measuredHeight = 0): CanvasBounds => ({
  left: x - 180,
  top: y - 64,
  right: x + cardSize.cardWidth + 180,
  bottom: y + Math.max(cardSize.cardHeight, measuredHeight) + 160
});

/** 保留全局索引和顺序；正在操作的卡片即使离开视口也不卸载。 */
export const getVisibleCanvasJobs = (
  jobs: readonly PositionedJob[],
  bounds: CanvasBounds,
  retainedIds: ReadonlySet<string>,
  draggingJobId: string | null,
  measuredHeights: ReadonlyMap<string, number> = new Map()
): PositionedJob[] => jobs.filter((item) =>
  item.job.id === draggingJobId || retainedIds.has(item.job.id) ||
  intersectsCanvasBounds(getCardBounds(item, measuredHeights.get(item.job.id)), bounds)
);

/** 连线按原始相邻关系建立一次，不能用裁剪后的卡片数组重新连接。 */
export const getCanvasLinks = (jobs: readonly PositionedJob[]): CanvasLink[] => jobs.slice(0, -1).map((from, index) => {
  const to = jobs[index + 1];
  return {
    from, to, index, path: getConnectionPath(from, to),
    bounds: {
      left: Math.min(from.x, to.x) - 16,
      top: Math.min(from.y, to.y) - 16,
      right: Math.max(from.x + from.cardSize.cardWidth, to.x + to.cardSize.cardWidth) + 16,
      bottom: Math.max(from.y + from.cardSize.cardHeight, to.y + to.cardSize.cardHeight) + 16
    }
  };
});

/** 两端都在屏幕外但穿过视口的连线也要保留；拖动卡片时保留相邻两条线。 */
export const getVisibleCanvasLinks = (
  links: readonly CanvasLink[],
  bounds: CanvasBounds,
  draggingJobId: string | null
): CanvasLink[] => links.filter((link) =>
  link.from.job.id === draggingJobId || link.to.job.id === draggingJobId || intersectsCanvasBounds(link.bounds, bounds)
);

export const notifyCanvasViewport = (stage: HTMLElement, transform: CanvasTransform) => {
  stage.dispatchEvent(new CustomEvent<CanvasTransform>(CANVAS_VIEWPORT_CHANGE, { detail: transform }));
};
