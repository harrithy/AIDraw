import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import {
  CANVAS_VIEWPORT_CHANGE,
  containsCanvasBounds,
  getCanvasViewportBounds,
  type CanvasTransform,
  type CanvasViewport
} from "../lib/canvasVisibility";

const OVERSCAN_PX = 600;
const GUARD_PX = 160;

/** 使用带缓冲区的可见窗口，平移几百像素才补充一次卡片，不逐帧重渲染 React。 */
export const useCanvasViewport = (
  stageRef: RefObject<HTMLDivElement | null>,
  folderId: string | null,
  { panX, panY, zoom }: CanvasTransform
) => {
  const viewportRef = useRef<CanvasViewport>({ panX, panY, zoom, width: window.innerWidth, height: window.innerHeight });
  const [renderBounds, setRenderBounds] = useState(() => getCanvasViewportBounds(viewportRef.current, OVERSCAN_PX));
  const boundsRef = useRef(renderBounds);
  const identityRef = useRef({ folderId, zoom });

  const updateViewport = useCallback((viewport: CanvasViewport, force = false, sync = false) => {
    viewportRef.current = viewport;
    const guardBounds = getCanvasViewportBounds(viewport, GUARD_PX);
    if (!force && containsCanvasBounds(boundsRef.current, guardBounds)) return;
    const nextBounds = getCanvasViewportBounds(viewport, OVERSCAN_PX);
    boundsRef.current = nextBounds;
    // 只有越过缓冲边界才同步补充少量节点，快速大幅拖动也不会先出现空白帧。
    if (sync) flushSync(() => setRenderBounds(nextBounds));
    else setRenderBounds(nextBounds);
  }, []);

  useLayoutEffect(() => {
    const previous = identityRef.current;
    identityRef.current = { folderId, zoom };
    updateViewport(
      { ...viewportRef.current, panX, panY, zoom },
      previous.folderId !== folderId || previous.zoom !== zoom
    );
  }, [folderId, panX, panY, zoom, updateViewport]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const resize = () => updateViewport({
      ...viewportRef.current,
      width: stage.clientWidth || window.innerWidth,
      height: stage.clientHeight || window.innerHeight
    }, true);
    const onPan = (event: Event) => {
      const transform = (event as CustomEvent<CanvasTransform>).detail;
      updateViewport({ ...viewportRef.current, ...transform }, false, true);
    };
    stage.addEventListener(CANVAS_VIEWPORT_CHANGE, onPan);
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    return () => {
      observer.disconnect();
      stage.removeEventListener(CANVAS_VIEWPORT_CHANGE, onPan);
    };
  }, [stageRef, updateViewport]);

  return renderBounds;
};
