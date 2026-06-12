import { PointerEvent, useCallback, useRef, useState, WheelEvent } from "react";
import { api } from "../api";
import { getDefaultCardPosition } from "../lib/canvas";
import type { DrawFolder, DrawJob } from "../types";
import type { CardDragState, DragState } from "../types/ui";

type UseCanvasInteractionsParams = {
  activeFolder: DrawFolder | null;
  jobs: DrawJob[];
  setFolders: React.Dispatch<React.SetStateAction<DrawFolder[]>>;
  setJobs: React.Dispatch<React.SetStateAction<DrawJob[]>>;
  setNotice: React.Dispatch<React.SetStateAction<string>>;
};

export function useCanvasInteractions({
  activeFolder,
  jobs,
  setFolders,
  setJobs,
  setNotice
}: UseCanvasInteractionsParams) {
  const [canvasDrag, setCanvasDrag] = useState<DragState | null>(null);
  const [cardDrag, setCardDrag] = useState<CardDragState | null>(null);
  const pendingCanvasRef = useRef({ panX: 0, panY: 0 });
  const pendingCardRef = useRef<{ jobId: string; posX: number; posY: number } | null>(null);
  const lockedCardPositionRef = useRef<{ jobId: string; posX: number; posY: number } | null>(null);

  const getCardDisplayPos = useCallback((job: DrawJob, index: number) => {
    if (job.hasCustomPosition && Number.isFinite(job.posX) && Number.isFinite(job.posY)) {
      return { x: job.posX, y: job.posY };
    }
    return getDefaultCardPosition(index);
  }, []);

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

  const zoomCanvas = useCallback(
    (delta: number) => {
      if (!activeFolder) return;
      const canvasZoom = Math.min(1.8, Math.max(0.55, Number((activeFolder.canvasZoom + delta).toFixed(2))));
      updateCanvas({ canvasZoom });
    },
    [activeFolder, updateCanvas]
  );

  const resetCanvas = useCallback(() => {
    updateCanvas({ canvasZoom: 1, canvasPanX: 0, canvasPanY: 0 });
  }, [updateCanvas]);

  const startCanvasDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!activeFolder || event.button !== 0) return;
      const target = event.target as HTMLElement | null;

      if (target?.closest("button, input, textarea, select, label, a")) return;

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

  const moveCanvasDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (cardDrag) {
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
      updateCanvas(nextPan, false);
    },
    [activeFolder, canvasDrag, cardDrag, setJobs, updateCanvas]
  );

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
    (event: WheelEvent<HTMLDivElement>) => {
      if (!activeFolder) return;
      event.preventDefault();
      zoomCanvas(event.deltaY > 0 ? -0.08 : 0.08);
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
