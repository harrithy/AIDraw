import { X } from "lucide-react";
import { formatDate } from "../../lib/format";
import type { DrawJob } from "../../types";

export function ImagePreview({
  job,
  onClose,
}: {
  job: DrawJob | null;
  onClose: () => void;
}) {
  if (!job?.outputImageUrl) return null;
  const qualityLabel = job.thinking === "low" || job.thinking === "medium" || job.thinking === "high" ? job.thinking : "high";
  const sizeLabel = job.size || `${job.width}x${job.height}`;

  return (
    <div
      className="image-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onClick={onClose}
    >
      <div
        className="image-preview-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="image-preview-close"
          onClick={onClose}
          title="关闭预览"
        >
          <X size={18} />
        </button>
        <img src={job.outputImageUrl} alt={job.prompt} />
        <div className="image-preview-caption">
          <strong>{job.prompt}</strong>
          <span>
            {formatDate(job.createdAt)} · quality {qualityLabel} ·{" "}
            {sizeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
