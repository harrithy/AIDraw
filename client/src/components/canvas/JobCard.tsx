import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Clock,
  Download,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Sparkles,
  X
} from "lucide-react";
import { type CSSProperties, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { JobCardSize } from "../../lib/canvas";
import { downloadImage } from "../../lib/download";
import { formatDate } from "../../lib/format";
import { statusLabel } from "../../lib/jobLabels";
import { prefersReducedMotion } from "../../lib/motion";
import type { DrawJob } from "../../types";

type JobCardProps = {
  job: DrawJob;
  cardSize: JobCardSize;
  index: number;
  total: number;
  posX: number;
  posY: number;
  isDragging: boolean;
  onMove: (jobId: string, direction: -1 | 1) => void;
  onPreview: (job: DrawJob) => void;
  onRetry: (jobId: string) => void;
  onUseImage?: (url: string) => void;
};

const statusIcon = (status: DrawJob["status"]) => {
  if (status === "running") return <Loader2 className="spin" size={16} />;
  if (status === "pending") return <Clock size={16} />;
  if (status === "failed") return <AlertCircle size={16} />;
  return <Sparkles size={16} />;
};

export function JobCard({
  job,
  cardSize,
  index,
  total,
  posX,
  posY,
  isDragging,
  onMove,
  onPreview,
  onRetry,
  onUseImage
}: JobCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null);
  const canRetry = job.status === "completed" || job.status === "failed";
  const sizeLabel = job.size || (job.width && job.height ? `${job.width}x${job.height}` : "auto");
  const qualityLabel = job.thinking === "low" || job.thinking === "medium" || job.thinking === "high" ? job.thinking : "high";
  const referenceImages =
    job.mode === "image-to-image"
      ? Array.from(
          new Set(
            (job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [])
              .map((url) => url.trim())
              .filter(Boolean)
          )
        )
      : [];
  const cardStyle: CSSProperties & Record<"--job-card-width" | "--job-card-height" | "--job-image-width" | "--job-image-height", string> = {
    left: `${posX}px`,
    top: `${posY}px`,
    "--job-card-width": `${cardSize.cardWidth}px`,
    "--job-card-height": `${cardSize.cardHeight}px`,
    "--job-image-width": `${cardSize.imageWidth}px`,
    "--job-image-height": `${cardSize.imageHeight}px`
  };

  const handleDownload = async () => {
    if (!job.outputImageUrl || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadImage(job.outputImageUrl, job.prompt);
    } finally {
      setIsDownloading(false);
    }
  };

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
      className={`job-card status-${job.status}${toolsOpen ? " tools-open" : ""}${isDragging ? " card-dragging" : ""}${
        referenceImages.length > 0 ? " has-references" : ""
      }`}
      data-job-id={job.id}
      style={cardStyle}
    >
      {referenceImages.length > 0 ? (
        <div className="job-reference-strip" aria-label="参考图片" onPointerDown={(event) => event.stopPropagation()}>
          {referenceImages.map((imageUrl, imageIndex) => (
            <button
              key={`${imageUrl}-${imageIndex}`}
              type="button"
              className="job-reference-thumb"
              onClick={() => setReferencePreviewUrl(imageUrl)}
              title="放大参考图"
            >
              <img src={imageUrl} alt={`参考图片 ${imageIndex + 1}`} />
            </button>
          ))}
        </div>
      ) : null}

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
              {job.outputImageUrl ? (
                <>
                  <button type="button" onClick={() => void handleDownload()} disabled={isDownloading} title="下载图片">
                    {isDownloading ? <Loader2 className="spin" size={15} /> : <Download size={15} />}
                  </button>
                  {onUseImage && (
                    <button type="button" onClick={() => onUseImage(job.outputImageUrl!)} title="作为参考图引用">
                      <ImagePlus size={15} />
                    </button>
                  )}
                </>
              ) : null}
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
            <em>Quality</em>
            <strong>{qualityLabel}</strong>
          </span>
          <span className="job-meta-item">
            <em>尺寸</em>
            <strong>{sizeLabel}</strong>
          </span>
        </div>
        {job.errorMessage ? <small className="error-text">{job.errorMessage}</small> : null}
      </div>

      {referencePreviewUrl
        ? createPortal(
            <div
              className="image-preview-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="参考图片预览"
              onClick={() => setReferencePreviewUrl(null)}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="image-preview-panel reference-preview-panel" onClick={(event) => event.stopPropagation()}>
                <div className="image-preview-actions">
                  <button
                    type="button"
                    className="image-preview-action image-preview-close"
                    onClick={() => setReferencePreviewUrl(null)}
                    title="关闭预览"
                  >
                    <X size={18} />
                  </button>
                </div>
                <img src={referencePreviewUrl} alt="参考图片" />
              </div>
            </div>,
            document.body
          )
        : null}
    </article>
  );
}
