import { useEffect, useRef, type PointerEventHandler } from "react";
import { type PositionedJob } from "../../lib/canvas";
import type { DrawFolder, DrawJob } from "../../types";
import { EmptyCanvas } from "./EmptyCanvas";
import { JobCard } from "./JobCard";
import { WorkflowLinks } from "./WorkflowLinks";

/**
 * 工作流画布主组件
 * 渲染包含连接线和任务卡片的可拖拽/可缩放画布
 * 根据 activeFolder 的缩放和平移参数使用 CSS transform 控制视口
 * @param activeFolder - 当前选中的文件夹（含缩放/平移状态）
 * @param boardSize - 画布的虚拟尺寸
 * @param isDragging - 是否正在进行拖拽操作（影响光标样式）
 * @param isCanvasDragging - 是否正在平移整张画布（控制合成层优化）
 * @param isLoading - 是否正在加载数据
 * @param positionedJobs - 已完成定位计算的任务卡片列表
 * @param draggingJobId - 当前被拖拽的卡片 ID（高亮用）
 * @param onPointerDown - 指针按下事件（开始拖拽）
 * @param onPointerMove - 指针移动事件（拖拽中）
 * @param onPointerUp - 指针释放事件（结束拖拽）
 * @param onPointerCancel - 指针取消事件
 * @param onWheel - 滚轮事件（画布缩放）
 * @param onMoveJob - 移动任务排序
 * @param onPreviewJob - 预览任务图片
 * @param onRetryJob - 重试失败任务
 * @param onUseImage - 将输出图片用作参考图
 */
type WorkflowCanvasProps = {
  activeFolder: DrawFolder | null;
  boardSize: { width: number; height: number };
  isDragging: boolean;
  isCanvasDragging: boolean;
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
  onEditRetryJob: (job: DrawJob) => void;
  onUseImage?: (url: string) => void;
};

export function WorkflowCanvas({
  activeFolder,
  boardSize,
  isDragging,
  isCanvasDragging,
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
  onEditRetryJob,
  onUseImage
}: WorkflowCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  /** 用 ref 存最新的 wheel handler，避免 useEffect 重复绑定/解绑事件 */
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
        className={`canvas-stage${isDragging ? " dragging" : ""}${
          isCanvasDragging ? " canvas-panning" : ""
        }`}
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
                onEditRetry={onEditRetryJob}
                onUseImage={onUseImage}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
