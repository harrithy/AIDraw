import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Clock,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { useRef, useState } from "react";
import { formatDate } from "../../lib/format";
import { statusLabel } from "../../lib/jobLabels";
import { prefersReducedMotion } from "../../lib/motion";
import type { DrawJob } from "../../types";

type JobCardProps = {
  job: DrawJob;
  index: number;
  total: number;
  posX: number;
  posY: number;
  isDragging: boolean;
  onMove: (jobId: string, direction: -1 | 1) => void;
  onPreview: (job: DrawJob) => void;
  onRetry: (jobId: string) => void;
};

const statusIcon = (status: DrawJob["status"]) => {
  if (status === "running") return <Loader2 className="spin" size={16} />;
  if (status === "pending") return <Clock size={16} />;
  if (status === "failed") return <AlertCircle size={16} />;
  return <Sparkles size={16} />;
};

export function JobCard({
  job,
  index,
  total,
  posX,
  posY,
  isDragging,
  onMove,
  onPreview,
  onRetry
}: JobCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const canRetry = job.status === "completed" || job.status === "failed";
  const sizeLabel = job.width && job.height ? `${job.width}x${job.height}` : "auto";

  useGSAP(
    () => {
      if (!toolsOpen || prefersReducedMotion()) return;

      const toolButtons = gsap.utils.toArray<HTMLElement>(".job-actions button:not(.job-tools-toggle)");
      if (toolButtons.length === 0) return;

      gsap.fromTo(
        toolButtons,
        { x: -8, scale: 0.9, autoAlpha: 0 },
        {
          x: 0,
          scale: 1,
          autoAlpha: 1,
          duration: 0.24,
          ease: "back.out(1.7)",
          stagger: 0.035,
          clearProps: "transform,visibility"
        }
      );
    },
    { dependencies: [toolsOpen], scope: cardRef }
  );

  return (
    <article
      ref={cardRef}
      className={`job-card status-${job.status}${toolsOpen ? " tools-open" : ""}${isDragging ? " card-dragging" : ""}`}
      data-job-id={job.id}
      style={{
        left: `${posX}px`,
        top: `${posY}px`
      }}
    >
      <div className="job-card-header">
        <h3>{job.prompt}</h3>

        <div className="job-actions">
          <button
            type="button"
            className="job-tools-toggle"
            onClick={() => setToolsOpen((value) => !value)}
            aria-expanded={toolsOpen}
            title={toolsOpen ? "收起工具栏" : "展开工具栏"}
          >
            <MoreHorizontal size={15} />
          </button>
          {toolsOpen ? (
            <>
              <button type="button" onClick={() => onMove(job.id, -1)} disabled={index === 0} title="上移">
                <ArrowUp size={15} />
              </button>
              <button type="button" onClick={() => onMove(job.id, 1)} disabled={index === total - 1} title="下移">
                <ArrowDown size={15} />
              </button>
              {canRetry ? (
                <button type="button" onClick={() => onRetry(job.id)} title="重新绘制">
                  <RotateCcw size={15} />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className={`job-image ${job.outputImageUrl ? "has-output" : ""}`}>
        {job.outputImageUrl ? (
          <button type="button" className="job-image-button" onClick={() => onPreview(job)} title="放大预览">
            <img src={job.outputImageUrl} alt={job.prompt} />
          </button>
        ) : (
          <div className="job-placeholder">
            {statusIcon(job.status)}
            <span>{statusLabel[job.status]}</span>
          </div>
        )}
      </div>

      <div className="job-body">
        <div className="job-meta-line" aria-label="任务参数">
          <span className="job-meta-item">
            <em>时间</em>
            <strong>{formatDate(job.createdAt)}</strong>
          </span>
          <span className="job-meta-item">
            <em>Thinking</em>
            <strong>{job.thinking || "high"}</strong>
          </span>
          <span className="job-meta-item">
            <em>尺寸</em>
            <strong>{sizeLabel}</strong>
          </span>
        </div>
        {job.errorMessage ? <small className="error-text">{job.errorMessage}</small> : null}
      </div>
    </article>
  );
}
