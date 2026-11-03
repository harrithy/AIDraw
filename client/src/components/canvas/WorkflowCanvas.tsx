import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEventHandler } from "react";
import { useCanvasViewport } from "../../hooks/useCanvasViewport";
import { type PositionedJob } from "../../lib/canvas";
import { getCanvasLinks, getVisibleCanvasJobs, getVisibleCanvasLinks } from "../../lib/canvasVisibility";
import type { CardLayoutPreferences } from "../../lib/uiPreferences";
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
 * @param onEditRetryJob - 带着原始参数跳转到编辑页重绘
 * @param onUploadLatestMedia - 将任务的最新图片或视频上传到图床
 * @param onUseImage - 将输出图片用作参考图
 */
type WorkflowCanvasProps = {
  activeFolder: DrawFolder | null;
  boardSize: { width: number; height: number };
  isDragging: boolean;
  isCanvasDragging: boolean;
  isLoading: boolean;
  onStartCreating: () => void;
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
  onDeleteJob?: (jobId: string) => void;
  onUploadLatestMedia?: (jobId: string) => Promise<void>;
  onUseImage?: (url: string) => void;
  cardPreferences: CardLayoutPreferences;
};

export const WorkflowCanvas = memo(function WorkflowCanvas({
  activeFolder,
  boardSize,
  isDragging,
  isCanvasDragging,
  isLoading,
  onStartCreating,
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
  onDeleteJob,
  onUploadLatestMedia,
  onUseImage,
  cardPreferences
}: WorkflowCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const renderBounds = useCanvasViewport(stageRef, activeFolder?.id ?? null, {
    panX: activeFolder?.canvasPanX ?? 0,
    panY: activeFolder?.canvasPanY ?? 0,
    zoom: activeFolder?.canvasZoom ?? 1
  });
  const [retainedJobIds, setRetainedJobIds] = useState<ReadonlySet<string>>(() => new Set());
  const [measuredHeights, setMeasuredHeights] = useState<ReadonlyMap<string, number>>(() => new Map());
  const onHeightChange = useCallback((jobId: string, height: number) => {
    setMeasuredHeights((current) => {
      if (current.get(jobId) === height) return current;
      return new Map(current).set(jobId, height);
    });
  }, []);
  const onRetentionChange = useCallback((jobId: string, retain: boolean) => {
    setRetainedJobIds((current) => {
      if (current.has(jobId) === retain) return current;
      const next = new Set(current);
      if (retain) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  }, []);
  useEffect(() => {
    const ids = new Set(positionedJobs.map((item) => item.job.id));
    setRetainedJobIds((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
    setMeasuredHeights((current) => {
      const next = new Map([...current].filter(([id]) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [positionedJobs]);
  const visibleJobs = useMemo(
    () => getVisibleCanvasJobs(positionedJobs, renderBounds, retainedJobIds, draggingJobId, measuredHeights),
    [positionedJobs, renderBounds, retainedJobIds, draggingJobId, measuredHeights]
  );
  const links = useMemo(() => getCanvasLinks(positionedJobs), [positionedJobs]);
  const visibleLinks = useMemo(
    () => getVisibleCanvasLinks(links, renderBounds, draggingJobId),
    [links, renderBounds, draggingJobId]
  );
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
          <EmptyCanvas isLoading={isLoading} hasFolder={Boolean(activeFolder)} onStart={onStartCreating} />
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
            <WorkflowLinks links={visibleLinks} bounds={renderBounds} />
            {visibleJobs.map(({ job, index, x, y, cardSize }) => (
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
                onDelete={onDeleteJob}
                onUploadLatestMedia={onUploadLatestMedia}
                onUseImage={onUseImage}
                cardPreferences={cardPreferences}
                onRetentionChange={onRetentionChange}
                onHeightChange={onHeightChange}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
});
