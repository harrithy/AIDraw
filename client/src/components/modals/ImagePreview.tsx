import { Download, ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { downloadImage } from "../../lib/download";
import { formatDate } from "../../lib/format";
import type { DrawJob } from "../../types";

export function ImagePreview({
  job,
  onClose,
  onUseImage,
}: {
  job: DrawJob | null;
  onClose: () => void;
  onUseImage?: (url: string) => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  if (!job?.outputImageUrl) return null;
  const imageUrl = job.outputImageUrl;
  const qualityLabel = job.thinking === "low" || job.thinking === "medium" || job.thinking === "high" ? job.thinking : "high";
  const sizeLabel = job.size || `${job.width}x${job.height}`;
  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadImage(imageUrl, job.prompt);
    } finally {
      setIsDownloading(false);
    }
  };

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
        <div className="image-preview-actions">
          <button
            type="button"
            className="image-preview-action"
            onClick={() => void handleDownload()}
            disabled={isDownloading}
            title="下载图片"
          >
            {isDownloading ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
          </button>
          {onUseImage && (
            <button
              type="button"
              className="image-preview-action"
              onClick={() => onUseImage(imageUrl)}
              title="作为参考图引用"
            >
              <ImagePlus size={18} />
            </button>
          )}
          <button
            type="button"
            className="image-preview-action image-preview-close"
            onClick={onClose}
            title="关闭预览"
          >
            <X size={18} />
          </button>
        </div>
        <img src={imageUrl} alt={job.prompt} />
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
