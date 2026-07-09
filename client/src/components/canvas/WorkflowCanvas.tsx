import { useEffect, useRef, type PointerEventHandler } from "react";
import { type PositionedJob } from "../../lib/canvas";
import type { DrawFolder, DrawJob } from "../../types";
import { EmptyCanvas } from "./EmptyCanvas";
import { JobCard } from "./JobCard";
import { WorkflowLinks } from "./WorkflowLinks";

type WorkflowCanvasProps = {
  activeFolder: DrawFolder | null;
  boardSize: {
    width: number;
    height: number;
  };
  isDragging: boolean;
  isLoading: boolean;
  positionedJobs: PositionedJob[];
  draggingJobId: string | null;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onWheel: (event: WheelEvent) => void;
  onMoveJob: (jobId: string, direction: -1 | 1) => void;
  onPreviewJob: (job: DrawJob) => void;
  onRetryJob: (jobId: string) => void;
  onUseImage?: (url: string) => void;
};

export function WorkflowCanvas({
  activeFolder,
  boardSize,
  isDragging,
  isLoading,
  positionedJobs,
  draggingJobId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onWheel,
  onMoveJob,
  onPreviewJob,
  onRetryJob,
  onUseImage
}: WorkflowCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wheelHandlerRef = useRef(onWheel);

  useEffect(() => {
    wheelHandlerRef.current = onWheel;
  }, [onWheel]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleWheel = (event: WheelEvent) => {
      wheelHandlerRef.current(event);
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <section className="canvas-layer" data-tour="canvas">
      <div
        ref={stageRef}
        className={`canvas-stage ${isDragging ? "dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {positionedJobs.length === 0 ? (
          <EmptyCanvas isLoading={isLoading} />
        ) : (
          <div
            className="canvas-board"
            style={{
              width: `${boardSize.width}px`,
              height: `${boardSize.height}px`,
              transform: `translate(${activeFolder?.canvasPanX ?? 0}px, ${
                activeFolder?.canvasPanY ?? 0
              }px) scale(${activeFolder?.canvasZoom ?? 1})`
            }}
          >
            <WorkflowLinks positionedJobs={positionedJobs} />
            {positionedJobs.map(({ job, index, x, y, cardSize }) => (
              <JobCard
                key={job.id}
                job={job}
                cardSize={cardSize}
                index={index}
                total={positionedJobs.length}
                posX={x}
                posY={y}
                isDragging={draggingJobId === job.id}
                onMove={onMoveJob}
                onPreview={onPreviewJob}
                onRetry={onRetryJob}
                onUseImage={onUseImage}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
