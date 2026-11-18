import { memo, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactEventHandler } from "react";
import { constrainImageViewer, FIT_IMAGE_VIEW, isPointInsideViewerImage, zoomImageViewerAt, type ImageViewerTransform, type ViewerPoint, type ViewerSize } from "../../lib/imageViewer";
import { RetryingImage } from "../ui/RetryingImage";
import type { PreviewMedia } from "./MediaPreview";

/** 图片、视频及菜单缩略图共用渲染；隐藏的视频不自动播放。 */
export function PreviewMediaView({ media, hidden = false, thumbnail = false, onImageLoad }: {
  media: PreviewMedia;
  hidden?: boolean;
  thumbnail?: boolean;
  onImageLoad?: ReactEventHandler<HTMLImageElement>;
}) {
  return media.kind === "video" ? (
    <video src={media.url} aria-label={media.alt} controls={!thumbnail && !hidden} autoPlay={!thumbnail && !hidden}
      loop muted playsInline preload="metadata" />
  ) : <RetryingImage key={media.url} src={media.url} alt={media.alt} loading="eager" onLoad={onImageLoad} draggable={false} />;
}

type Props = {
  media: PreviewMedia;
  hidden?: boolean;
  view: ImageViewerTransform;
  onViewChange: (view: ImageViewerTransform) => void;
  onBackgroundClick?: () => void;
};

const KEYBOARD_PAN: Record<string, readonly [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };

/** 独立图片变换层，滚轮、拖拽和双指操作不会影响工具栏或底层画布。 */
export const MediaPreviewViewport = memo(function MediaPreviewViewport({ media, hidden = false, view, onViewChange, onBackgroundClick }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ViewerSize>({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState<ViewerSize>({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, ViewerPoint>());
  const gesture = useRef({ start: { x: 0, y: 0 }, moved: false, startedOnImage: false });
  const enabled = media.kind !== "video" && !hidden;
  const effectiveView = enabled ? constrainImageViewer(view, size, naturalSize) : FIT_IMAGE_VIEW;
  const viewRef = useRef(effectiveView);
  const metricsRef = useRef({ size, naturalSize });
  viewRef.current = effectiveView;
  metricsRef.current = { size, naturalSize };

  const isOnImage = (clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return true;
    return isPointInsideViewerImage({ x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 }, viewRef.current, metricsRef.current.size, metricsRef.current.naturalSize);
  };

  const onImageLoad = useCallback<ReactEventHandler<HTMLImageElement>>((event) => {
    setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize((previous) => previous.width === rect.width && previous.height === rect.height ? previous : { width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const applyView = useCallback((next: ImageViewerTransform) => {
    const metrics = metricsRef.current;
    const constrained = constrainImageViewer(next, metrics.size, metrics.naturalSize);
    viewRef.current = constrained;
    onViewChange(constrained);
  }, [onViewChange]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || !enabled) return;
    // React 的滚轮监听可能是 passive，使用原生监听才能可靠拦截页面滚动。
    const wheel = (event: WheelEvent) => {
      gesture.current.moved = true;
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
      applyView(zoomImageViewerAt(viewRef.current, viewRef.current.scale * Math.exp(-delta * 0.002), {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2
      }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [enabled, applyView]);

  useEffect(() => {
    if (enabled) return;
    const element = viewportRef.current;
    for (const id of pointers.current.keys()) {
      if (element?.hasPointerCapture?.(id)) element.releasePointerCapture(id);
    }
    pointers.current.clear();
    setDragging(false);
  }, [enabled]);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (event.target instanceof Element && event.target.closest("button, a, input")) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    if (pointers.current.size === 0) {
      gesture.current = { start: { x: event.clientX, y: event.clientY }, moved: false, startedOnImage: isOnImage(event.clientX, event.clientY) };
    } else gesture.current.moved = true;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || !pointers.current.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    if (Math.hypot(event.clientX - gesture.current.start.x, event.clientY - gesture.current.start.y) > 4) gesture.current.moved = true;
    const previous = [...pointers.current.values()];
    const previousPoint = pointers.current.get(event.pointerId)!;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const next = [...pointers.current.values()];
    if (previous.length >= 2 && next.length >= 2) {
      const distance = (points: ViewerPoint[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const center = (points: ViewerPoint[]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
      const before = center(previous);
      const after = center(next);
      const rect = event.currentTarget.getBoundingClientRect();
      const oldDistance = distance(previous);
      if (oldDistance < 1) return;
      const zoomed = zoomImageViewerAt(viewRef.current, viewRef.current.scale * distance(next) / oldDistance, {
        x: before.x - rect.left - rect.width / 2, y: before.y - rect.top - rect.height / 2
      });
      applyView({ ...zoomed, x: zoomed.x + after.x - before.x, y: zoomed.y + after.y - before.y });
    } else {
      applyView({ ...viewRef.current, x: viewRef.current.x + event.clientX - previousPoint.x, y: viewRef.current.y + event.clientY - previousPoint.y });
    }
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.type === "pointercancel") gesture.current.moved = true;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(pointers.current.size > 0);
  };

  return (
    <div ref={viewportRef} className={`media-preview-content media-zoom-viewport${dragging ? " is-dragging" : ""}`}
      data-zoomable={enabled} data-scale={effectiveView.scale} tabIndex={enabled ? 0 : -1}
      role="group" aria-label={`${media.alt}查看区域`}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}
      onClick={(event) => {
        event.stopPropagation();
        if (!enabled || !onBackgroundClick) return;
        // 拖动、捏合或从图片上开始的点击不关闭；加载失败时保留重试按钮。
        if (event.target instanceof Element && event.target.closest("button, a, input")) return;
        if (event.detail > 0 && (gesture.current.moved || gesture.current.startedOnImage)) return;
        if (!isOnImage(event.clientX, event.clientY)) onBackgroundClick();
      }}
      onDoubleClick={(event) => {
        if (!enabled) return;
        event.preventDefault();
        event.stopPropagation();
        if (viewRef.current.scale > 1) applyView(FIT_IMAGE_VIEW);
        else {
          const rect = event.currentTarget.getBoundingClientRect();
          applyView(zoomImageViewerAt(viewRef.current, 2, { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }));
        }
      }}
      onKeyDown={(event) => {
        if (!enabled || !event.key.startsWith("Arrow") || event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        const delta = KEYBOARD_PAN[event.key];
        if (delta) applyView({ ...viewRef.current, x: viewRef.current.x + delta[0], y: viewRef.current.y + delta[1] });
      }}>
      <div className="media-zoom-transform" style={{ transform: `translate3d(${effectiveView.x}px, ${effectiveView.y}px, 0) scale(${effectiveView.scale})` }}>
        <PreviewMediaView media={media} hidden={hidden} onImageLoad={onImageLoad} />
      </div>
    </div>
  );
});
