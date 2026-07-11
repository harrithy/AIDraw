import { PointerEvent, useCallback, useRef, useState } from "react";
import { api } from "../api";
import { getDefaultCardPosition } from "../lib/canvas";
import type { DrawFolder, DrawJob } from "../types";
import type { CardDragState, DragState } from "../types/ui";

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
 * 使用 Pointer Events + React state + 乐观更新策略：
 * 卡片拖拽完才发请求持久化位置，拖的过程中只更新本地 state
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
  /**
   * 拖拽开始时的卡片位置快照
   * 用于在异步加载任务列表时保持拖拽位置不被服务器数据覆盖
   */
  const lockedCardPositionRef = useRef<{ jobId: string; posX: number; posY: number } | null>(null);

  /**
   * 获取卡片的显示位置
   * 优先使用自定义位置（用户拖拽过），否则用默认自动布局位置
   */
  const getCardDisplayPos = useCallback(
    (job: DrawJob, index: number) => {
      if (job.hasCustomPosition && Number.isFinite(job.posX) && Number.isFinite(job.posY)) {
        return { x: job.posX, y: job.posY };
      }
      return getDefaultCardPosition(index, jobs);
    },
    [jobs]
  );

  /**
   * 更新画布状态（缩放/平移）
   * @param patch - 要更新的画布属性
   * @param persist - 是否立即持久化到服务器（拖拽中=false，拖完=true）
   */
  const updateCanvas = useCallback(
    (patch: Partial<Pick<DrawFolder, "canvasZoom" | "canvasPanX" | "canvasPanY">>, persist = true) => {
      if (!activeFolder) return;
      const nextFolder = { ...activeFolder, ...patch };
      setFolders((current) => current.map((folder) => (folder.id === activeFolder.id ? nextFolder : folder)));
      if (persist) {
        void api.updateFolder(activeFolder.id, patch).catch((error) => {
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
        const job = jobs.find((item) => item.id === jobId);
        if (!job) return;

        event.currentTarget.setPointerCapture(event.pointerId);
        const displayPos = getCardDisplayPos(job, jobs.findIndex((item) => item.id === jobId));
        setCardDrag({
          jobId,
          startX: event.clientX,
          startY: event.clientY,
          posX: displayPos.x,
          posY: displayPos.y
        });
        pendingCardRef.current = { jobId, posX: displayPos.x, posY: displayPos.y };
        lockedCardPositionRef.current = { jobId, posX: displayPos.x, posY: displayPos.y };
        return;
      }

      // 空白区域 → 画布拖拽
      event.currentTarget.setPointerCapture(event.pointerId);
      pendingCanvasRef.current = {
        panX: activeFolder.canvasPanX,
        panY: activeFolder.canvasPanY
      };
      setCanvasDrag({
        startX: event.clientX,
        startY: event.clientY,
        panX: activeFolder.canvasPanX,
        panY: activeFolder.canvasPanY
      });
    },
    [activeFolder, getCardDisplayPos, jobs]
  );

  /**
   * 拖拽移动（Pointer Move）
   * 实时更新卡片位置或画布平移
   * 拖拽中的更新只修改本地 state，不请求服务器（性能优化）
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

        // 乐观更新：直接改 state，不等服务器响应
        setJobs((current) =>
          current.map((job) =>
            job.id === cardDrag.jobId ? { ...job, posX: nextPosX, posY: nextPosY, hasCustomPosition: true } : job
          )
        );
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
      updateCanvas(nextPan, false); // 拖拽中不持久化
    },
    [activeFolder, canvasDrag, cardDrag, setJobs, updateCanvas]
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
        const nextPosition = pendingCardRef.current;
        if (nextPosition) {
          lockedCardPositionRef.current = nextPosition;
          void api
            .updateJobPosition(nextPosition.jobId, nextPosition.posX, nextPosition.posY)
            .then((updatedJob) => {
              setJobs((current) => current.map((job) => (job.id === updatedJob.id ? updatedJob : job)));
            })
            .catch((error) => {
              setNotice(error instanceof Error ? error.message : "位置保存失败");
            })
            .finally(() => {
              if (lockedCardPositionRef.current?.jobId === nextPosition.jobId) {
                lockedCardPositionRef.current = null;
              }
            });
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setCardDrag(null);
        pendingCardRef.current = null;
        return;
      }

      if (!activeFolder || !canvasDrag) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setCanvasDrag(null);
      void api
        .updateFolder(activeFolder.id, {
          canvasPanX: pendingCanvasRef.current.panX,
          canvasPanY: pendingCanvasRef.current.panY
        })
        .catch((error) => {
          setNotice(error instanceof Error ? error.message : "画布状态保存失败");
        });
    },
    [activeFolder, canvasDrag, cardDrag, setJobs, setNotice]
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
    getCardDisplayPos,
    lockedCardPositionRef,
    moveCanvasDrag,
    resetCanvas,
    startCanvasDrag,
    stopCanvasDrag,
    wheelCanvas,
    zoomCanvas
  };
}
