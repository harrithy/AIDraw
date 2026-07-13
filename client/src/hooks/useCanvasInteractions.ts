import gsap from "gsap";
import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { api } from "../api";
import { getConnectionPath, getPositionedJobs, type PositionedJob } from "../lib/canvas";
import type { DrawFolder, DrawJob } from "../types";
import type { CardDragState, DragState } from "../types/ui";

type DraggedLinkState = {
  element: SVGPathElement;
  from: PositionedJob;
  to: PositionedJob;
  draggedEndpoint: "from" | "to";
};

/**
 * 画布交互 Hook 的参数
 */
type UseCanvasInteractionsParams = {
  /** 当前活跃的文件夹（null 表示未选中任何文件夹） */
  activeFolder: DrawFolder | null;
  /** 当前文件夹下的任务列表 */
  jobs: DrawJob[];
  /** 更新文件夹状态 */
  setFolders: React.Dispatch<React.SetStateAction<DrawFolder[]>>;
  /** 更新任务列表 */
  setJobs: React.Dispatch<React.SetStateAction<DrawJob[]>>;
  /** 设置通知消息 */
  setNotice: React.Dispatch<React.SetStateAction<string>>;
};

/**
 * 画布交互 Hook — 拖拽、缩放、卡片定位
 *
 * 管理画布的三种交互：
 * 1. 画布拖拽 — 按住空白区域拖动平移画布
 * 2. 卡片拖拽 — 按住任务卡片拖动到任意位置
 * 3. 画布缩放 — 滚轮缩放（以鼠标位置为焦点）
 *
 * 使用 Pointer Events + requestAnimationFrame + 乐观更新策略：
 * 拖拽过程中只更新合成层 transform，结束后才提交 React state 和持久化位置
 *
 * @param params - 画布状态和更新函数
 * @returns 画布交互的所有 handler 和状态
 */
export function useCanvasInteractions({
  activeFolder,
  jobs,
  setFolders,
  setJobs,
  setNotice
}: UseCanvasInteractionsParams) {
  /** 画布拖拽状态（null = 未拖拽） */
  const [canvasDrag, setCanvasDrag] = useState<DragState | null>(null);
  /** 卡片拖拽状态（null = 未拖拽） */
  const [cardDrag, setCardDrag] = useState<CardDragState | null>(null);
  /** 画布拖拽过程中的实时偏移（避免频繁 setState） */
  const pendingCanvasRef = useRef({ panX: 0, panY: 0 });
  /** 卡片拖拽过程中的实时位置 */
  const pendingCardRef = useRef<{ jobId: string; posX: number; posY: number } | null>(null);
  /** 卡片拖拽过程中的实时位移，仅用于合成层 transform */
  const pendingCardDeltaRef = useRef({ x: 0, y: 0 });
  /** 当前被直接移动的卡片元素 */
  const draggedCardElementRef = useRef<HTMLElement | null>(null);
  /** 与当前卡片相邻的连线，最多包含前后两条 */
  const draggedLinksRef = useRef<DraggedLinkState[]>([]);
  /** 当前被直接移动的画布元素 */
  const canvasBoardElementRef = useRef<HTMLElement | null>(null);
  /** 将高频 pointermove 合并为每帧最多一次 DOM 写入 */
  const dragFrameRef = useRef<number | null>(null);
  /**
   * 拖拽开始时的卡片位置快照
   * 用于在异步加载任务列表时保持拖拽位置不被服务器数据覆盖
   */
  const lockedCardPositionRef = useRef<{ jobId: string; posX: number; posY: number } | null>(null);

  const cancelPendingDragFrame = useCallback(() => {
    if (dragFrameRef.current === null) return;
    window.cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
  }, []);

  useEffect(
    () => () => {
      cancelPendingDragFrame();
    },
    [cancelPendingDragFrame]
  );

  /**
   * 更新画布状态（缩放/平移）
   * @param patch - 要更新的画布属性
   * @param persist - 是否立即持久化到服务器（拖拽中=false，拖完=true）
   */
  const updateCanvas = useCallback(
    (patch: Partial<Pick<DrawFolder, "canvasZoom" | "canvasPanX" | "canvasPanY">>, persist = true) => {
      if (!activeFolder) return;
      const folderId = activeFolder.id;
      setFolders((current) =>
        current.map((folder) => (folder.id === folderId ? { ...folder, ...patch } : folder))
      );
      if (persist) {
        void api.updateFolder(folderId, patch).catch((error) => {
          setNotice(error instanceof Error ? error.message : "画布状态保存失败");
        });
      }
    },
    [activeFolder, setFolders, setNotice]
  );

  /**
   * 缩放画布
   * 支持以鼠标位置为焦点缩放——缩放时鼠标指向的区域保持在原位
   * @param delta - 缩放增量（正值放大，负值缩小）
   * @param focalPoint - 缩放焦点（屏幕坐标），不传则以画布左上角为焦点
   */
  const zoomCanvas = useCallback(
    (delta: number, focalPoint?: { x: number; y: number }) => {
      if (!activeFolder) return;
      const canvasZoom = Math.min(1.8, Math.max(0.55, Number((activeFolder.canvasZoom + delta).toFixed(2))));
      if (canvasZoom === activeFolder.canvasZoom) return;

      // 无焦点 → 简单缩放
      if (!focalPoint) {
        updateCanvas({ canvasZoom });
        return;
      }

      // 有焦点 → 计算新的平移量，保持焦点位置不变
      const zoomRatio = canvasZoom / activeFolder.canvasZoom;
      updateCanvas({
        canvasZoom,
        canvasPanX: focalPoint.x - (focalPoint.x - activeFolder.canvasPanX) * zoomRatio,
        canvasPanY: focalPoint.y - (focalPoint.y - activeFolder.canvasPanY) * zoomRatio
      });
    },
    [activeFolder, updateCanvas]
  );

  /** 重置画布到默认状态（缩放=1，平移归零） */
  const resetCanvas = useCallback(() => {
    updateCanvas({ canvasZoom: 1, canvasPanX: 0, canvasPanY: 0 });
  }, [updateCanvas]);

  /**
   * 开始拖拽（Pointer Down）
   * 自动判断：点中卡片 -> 卡片拖拽；点中空白 -> 画布拖拽
   * 忽略对按钮、输入框等交互元素的点击
   */
  const startCanvasDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!activeFolder || event.button !== 0) return;
      const target = event.target as HTMLElement | null;

      // 忽略交互元素上的点击（按钮、输入框等）
      if (target?.closest("button, input, textarea, select, label, a")) return;

      // 检测是否点中了任务卡片 → 卡片拖拽
      const cardEl = target?.closest(".job-card") as HTMLElement | null;
      if (cardEl) {
        const jobId = cardEl.dataset.jobId;
        if (!jobId) return;
        const jobIndex = jobs.findIndex((item) => item.id === jobId);
        const positionedJobs = getPositionedJobs(jobs);
        const positionedJob = positionedJobs[jobIndex];
        if (!positionedJob) return;

        event.currentTarget.setPointerCapture(event.pointerId);
        // 卡片入场动画也会写 transform；拖拽改用独立 translate 前先停止残留的位移动画。
        gsap.killTweensOf(cardEl, "x,y,xPercent,yPercent,scale,scaleX,scaleY");
        cardEl.style.removeProperty("transform");
        const displayPos = { x: positionedJob.x, y: positionedJob.y };
        const adjacentLinks: DraggedLinkState[] = [];
        const previousJob = positionedJobs[jobIndex - 1];
        const nextJob = positionedJobs[jobIndex + 1];

        if (previousJob) {
          const previousLink = event.currentTarget.querySelector<SVGPathElement>(
            `.workflow-link[data-link-index="${jobIndex - 1}"]`
          );
          if (previousLink) {
            adjacentLinks.push({
              element: previousLink,
              from: previousJob,
              to: positionedJob,
              draggedEndpoint: "to"
            });
          }
        }

        if (nextJob) {
          const nextLink = event.currentTarget.querySelector<SVGPathElement>(
            `.workflow-link[data-link-index="${jobIndex}"]`
          );
          if (nextLink) {
            adjacentLinks.push({
              element: nextLink,
              from: positionedJob,
              to: nextJob,
              draggedEndpoint: "from"
            });
          }
        }

        setCardDrag({
          jobId,
          startX: event.clientX,
          startY: event.clientY,
          posX: displayPos.x,
          posY: displayPos.y
        });
        pendingCardRef.current = { jobId, posX: displayPos.x, posY: displayPos.y };
        pendingCardDeltaRef.current = { x: 0, y: 0 };
        draggedCardElementRef.current = cardEl;
        draggedLinksRef.current = adjacentLinks;
        canvasBoardElementRef.current = null;
        lockedCardPositionRef.current = { jobId, posX: displayPos.x, posY: displayPos.y };
        return;
      }

      // 空白区域 → 画布拖拽
      event.currentTarget.setPointerCapture(event.pointerId);
      pendingCanvasRef.current = {
        panX: activeFolder.canvasPanX,
        panY: activeFolder.canvasPanY
      };
      draggedCardElementRef.current = null;
      draggedLinksRef.current = [];
      canvasBoardElementRef.current = event.currentTarget.querySelector<HTMLElement>(".canvas-board");
      setCanvasDrag({
        startX: event.clientX,
        startY: event.clientY,
        panX: activeFolder.canvasPanX,
        panY: activeFolder.canvasPanY
      });
    },
    [activeFolder, jobs]
  );

  /**
   * 拖拽移动（Pointer Move）
   * 实时更新卡片位置或画布平移
   * 拖拽中的更新只修改合成层 transform，不触发 React render 或服务器请求
   */
  const moveCanvasDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (cardDrag) {
        // 卡片拖拽：考虑画布缩放比例转换鼠标位移
        const zoom = activeFolder?.canvasZoom ?? 1;
        const deltaX = (event.clientX - cardDrag.startX) / zoom;
        const deltaY = (event.clientY - cardDrag.startY) / zoom;
        const nextPosX = cardDrag.posX + deltaX;
        const nextPosY = cardDrag.posY + deltaY;
        pendingCardRef.current = {
          jobId: cardDrag.jobId,
          posX: nextPosX,
          posY: nextPosY
        };
        lockedCardPositionRef.current = {
          jobId: cardDrag.jobId,
          posX: nextPosX,
          posY: nextPosY
        };
        pendingCardDeltaRef.current = { x: deltaX, y: deltaY };

        // translate 与 GSAP/CSS 的 transform 分离，避免动画覆盖拖拽位置。
        if (dragFrameRef.current === null) {
          dragFrameRef.current = window.requestAnimationFrame(() => {
            dragFrameRef.current = null;
            const cardElement = draggedCardElementRef.current;
            const delta = pendingCardDeltaRef.current;
            const nextPosition = pendingCardRef.current;
            if (cardElement) {
              cardElement.style.translate = `${delta.x}px ${delta.y}px`;
            }
            if (!nextPosition) return;

            // 只重算当前卡片前后的连线，避免触发整层 SVG 或 React 重渲染。
            for (const link of draggedLinksRef.current) {
              const movedEndpoint = {
                ...(link.draggedEndpoint === "from" ? link.from : link.to),
                x: nextPosition.posX,
                y: nextPosition.posY
              };
              const from = link.draggedEndpoint === "from" ? movedEndpoint : link.from;
              const to = link.draggedEndpoint === "to" ? movedEndpoint : link.to;
              link.element.setAttribute("d", getConnectionPath(from, to));
            }
          });
        }
        return;
      }

      if (!canvasDrag || !activeFolder) return;
      const nextPan = {
        canvasPanX: canvasDrag.panX + event.clientX - canvasDrag.startX,
        canvasPanY: canvasDrag.panY + event.clientY - canvasDrag.startY
      };
      pendingCanvasRef.current = {
        panX: nextPan.canvasPanX,
        panY: nextPan.canvasPanY
      };

      // 画布平移同样绕过 React state，并把高频事件限制为每帧一次写入。
      if (dragFrameRef.current === null) {
        dragFrameRef.current = window.requestAnimationFrame(() => {
          dragFrameRef.current = null;
          const boardElement = canvasBoardElementRef.current;
          if (!boardElement) return;
          const pan = pendingCanvasRef.current;
          boardElement.style.transform = `translate3d(${pan.panX}px, ${pan.panY}px, 0) scale(${activeFolder.canvasZoom})`;
        });
      }
    },
    [activeFolder, canvasDrag, cardDrag]
  );

  /**
   * 结束拖拽（Pointer Up）
   * 拖拽结束后才将最终位置持久化到服务器
   * 卡片位置 -> `api.updateJobPosition`
   * 画布平移 -> `api.updateFolder`
   */
  const stopCanvasDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (cardDrag) {
        cancelPendingDragFrame();
        const nextPosition = pendingCardRef.current;
        if (nextPosition) {
          lockedCardPositionRef.current = nextPosition;

          const cardElement = draggedCardElementRef.current;
          if (cardElement) cardElement.style.transition = "none";

          // 只在松手时提交一次 React 状态；同步提交后再移除临时 transform，避免画面跳回。
          flushSync(() => {
            setJobs((current) =>
              current.map((job) =>
                job.id === nextPosition.jobId
                  ? {
                      ...job,
                      posX: nextPosition.posX,
                      posY: nextPosition.posY,
                      hasCustomPosition: true
                    }
                  : job
              )
            );
            setCardDrag(null);
          });

          if (cardElement) {
            cardElement.style.removeProperty("translate");
            window.requestAnimationFrame(() => cardElement.style.removeProperty("transition"));
          }

          void api
            .updateJobPosition(nextPosition.jobId, nextPosition.posX, nextPosition.posY)
            .then((updatedJob) => {
              setJobs((current) => current.map((job) => (job.id === updatedJob.id ? updatedJob : job)));
            })
            .catch((error) => {
              setNotice(error instanceof Error ? error.message : "位置保存失败");
            })
            .finally(() => {
              if (lockedCardPositionRef.current === nextPosition) {
                lockedCardPositionRef.current = null;
              }
            });
        } else {
          setCardDrag(null);
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        pendingCardRef.current = null;
        draggedCardElementRef.current = null;
        draggedLinksRef.current = [];
        return;
      }

      if (!activeFolder || !canvasDrag) return;
      cancelPendingDragFrame();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const nextPan = {
        canvasPanX: pendingCanvasRef.current.panX,
        canvasPanY: pendingCanvasRef.current.panY
      };
      flushSync(() => {
        updateCanvas(nextPan, false);
        setCanvasDrag(null);
      });
      canvasBoardElementRef.current = null;
      void api
        .updateFolder(activeFolder.id, nextPan)
        .catch((error) => {
          setNotice(error instanceof Error ? error.message : "画布状态保存失败");
        });
    },
    [activeFolder, cancelPendingDragFrame, canvasDrag, cardDrag, setJobs, setNotice, updateCanvas]
  );

  const wheelCanvas = useCallback(
    (event: WheelEvent) => {
      if (!activeFolder || event.deltaY === 0) return;
      if (event.cancelable) event.preventDefault();
      const stage = event.currentTarget as HTMLElement | null;
      if (!stage) return;
      const stageRect = stage.getBoundingClientRect();

      zoomCanvas(event.deltaY > 0 ? -0.08 : 0.08, {
        x: event.clientX - stageRect.left,
        y: event.clientY - stageRect.top
      });
    },
    [activeFolder, zoomCanvas]
  );

  return {
    canvasDrag,
    cardDrag,
    lockedCardPositionRef,
    moveCanvasDrag,
    resetCanvas,
    startCanvasDrag,
    stopCanvasDrag,
    wheelCanvas,
    zoomCanvas
  };
}
