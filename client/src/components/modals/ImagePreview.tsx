import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Download, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { downloadImage } from "../../lib/download";
import { formatDate } from "../../lib/format";
import { isNanoBananaModel, isVideoModel, supportsNanoBananaImageSize } from "../../lib/imageModels";
import { getJobOutputImages, getJobVisualKind } from "../../lib/jobImages";
import { prefersReducedMotion } from "../../lib/motion";
import type { DrawJob } from "../../types";
import { AnimatedModal } from "../ui/AnimatedModal";
import { RetryingImage } from "../ui/RetryingImage";

/** 图片对比选中状态 */
type ComparisonSelection = {
  jobId: string;
  imageIndex: number;
};

const renderMediaItem = (
  imageUrl: string,
  altText: string,
  isVideo: boolean,
  className?: string,
  ariaHidden?: boolean
) => {
  if (isVideo) {
    return (
      <video
        src={imageUrl}
        controls
        autoPlay
        loop
        muted
        playsInline
        className={className}
        aria-hidden={ariaHidden}
        style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: "12px" }}
      />
    );
  }
  return <RetryingImage src={imageUrl} alt={altText} className={className} aria-hidden={ariaHidden} />;
};

/**
 * 媒体（图片/视频）预览模态框。
 * 支持查看任务生成的视频或图片，对比同一任务的不同版本输出，
 * 并可将选中媒体用作参考图或下载到本地。
 */
export function ImagePreview({
  job,
  onClose,
  onUseImage,
}: {
  job: DrawJob | null;
  onClose: () => void;
  onUseImage?: (url: string) => void;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const animatedJobIdRef = useRef<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [comparisonSelection, setComparisonSelection] = useState<ComparisonSelection | null>(null);
  const imageUrls = job ? getJobOutputImages(job) : [];
  const currentImageUrl = imageUrls[imageUrls.length - 1];
  const hasComparison = imageUrls.length > 1;
  const latestComparisonIndex = Math.max(0, imageUrls.length - 2);
  const selectedComparisonIndex = comparisonSelection && comparisonSelection.jobId === job?.id
    ? comparisonSelection.imageIndex
    : latestComparisonIndex;
  const safeComparisonIndex = Math.min(selectedComparisonIndex, latestComparisonIndex);
  const imageVersionKey = JSON.stringify(imageUrls);

  useGSAP(
    () => {
      if (!job) {
        animatedJobIdRef.current = null;
        return;
      }

      const layers = previewRef.current
        ? Array.from(previewRef.current.querySelectorAll<HTMLElement>(".image-comparison-layer"))
        : [];
      const currentJobId = job.id;
      const jobChanged = animatedJobIdRef.current !== currentJobId;
      animatedJobIdRef.current = currentJobId;

      if (layers.length === 0) return;

      gsap.killTweensOf(layers);
      if (jobChanged || prefersReducedMotion()) {
        gsap.set(layers, {
          autoAlpha: (imageIndex) => (imageIndex === safeComparisonIndex ? 1 : 0)
        });
        return;
      }

      gsap.to(layers, {
        autoAlpha: (imageIndex) => (imageIndex === safeComparisonIndex ? 1 : 0),
        duration: 0.28,
        ease: "power1.inOut",
        overwrite: true
      });
    },
    {
      dependencies: [job?.id, imageVersionKey, safeComparisonIndex],
      scope: previewRef
    }
  );

  if (!job || !currentImageUrl) {
    return (
      <AnimatedModal open={false} onClose={onClose} ariaLabel="媒体预览">
        {null}
      </AnimatedModal>
    );
  }
  const usesNanoBanana = isNanoBananaModel(job.model);
  const qualityLabel = usesNanoBanana
    ? supportsNanoBananaImageSize(job.model)
      ? job.imageSize ?? "4K"
      : "自动"
    : job.thinking === "low" || job.thinking === "medium" || job.thinking === "high"
      ? job.thinking
      : "high";
  const sizeLabel = job.size || `${job.width}x${job.height}`;
  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadImage(currentImageUrl, job.prompt, isCurrentVideo ? "video" : "image");
    } finally {
      setIsDownloading(false);
    }
  };

  const isCurrentVideo = getJobVisualKind(job, currentImageUrl) === "video";

  return (
    <AnimatedModal
      open
      onClose={onClose}
      ariaLabel={isCurrentVideo ? "视频预览" : "图片预览"}
      panelClassName={hasComparison ? "comparison-preview-panel" : undefined}
    >
      <div className="image-preview-actions">
        <button
          type="button"
          className="image-preview-action"
          onClick={() => void handleDownload()}
          disabled={isDownloading}
          title={isCurrentVideo ? "下载视频" : "下载图片"}
        >
          {isDownloading ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
        </button>
        {onUseImage && !isCurrentVideo && (
          <button
            type="button"
            className="image-preview-action"
            onClick={() => onUseImage(currentImageUrl)}
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
      {hasComparison ? (
        <>
          <div className="image-comparison-grid">
            <figure className="image-comparison-pane">
              <figcaption>
                <span>对比版本</span>
                <strong>V{safeComparisonIndex + 1}</strong>
              </figcaption>
              <div ref={previewRef} className="image-comparison-stage">
                {imageUrls.slice(0, -1).map((imageUrl, imageIndex) => (
                  renderMediaItem(
                    imageUrl,
                    `${job.prompt}，版本 ${imageIndex + 1}`,
                    getJobVisualKind(job, imageUrl) === "video",
                    `image-comparison-layer${imageIndex === safeComparisonIndex ? " is-selected" : ""}`,
                    imageIndex !== safeComparisonIndex
                  )
                ))}
              </div>
            </figure>
            <figure className="image-comparison-pane is-current">
              <figcaption>
                <span>当前版本</span>
                <strong>V{imageUrls.length}</strong>
              </figcaption>
              {renderMediaItem(currentImageUrl, `${job.prompt}，当前版本 ${imageUrls.length}`, isCurrentVideo)}
            </figure>
          </div>
          {imageUrls.length > 2 ? (
            <div className="image-version-picker">
              <span>选择旧版本</span>
              <div className="image-version-list">
                {imageUrls.slice(0, -1).map((imageUrl, imageIndex) => (
                  <button
                    key={`${imageIndex}-${imageUrl}`}
                    type="button"
                    className={imageIndex === safeComparisonIndex ? "selected" : ""}
                    onClick={() => setComparisonSelection({ jobId: job.id, imageIndex })}
                    aria-pressed={imageIndex === safeComparisonIndex}
                    title={`与当前版本对比 V${imageIndex + 1}`}
                  >
                    {renderMediaItem(imageUrl, `版本 ${imageIndex + 1}`, getJobVisualKind(job, imageUrl) === "video")}
                    <span>V{imageIndex + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        renderMediaItem(currentImageUrl, job.prompt, isCurrentVideo)
      )}
      <div className="image-preview-caption">
        <strong>{job.prompt}</strong>
        <span>
          {formatDate(job.createdAt)} · {isCurrentVideo ? "格式 MP4" : usesNanoBanana ? "分辨率 " + qualityLabel : "quality " + qualityLabel} · {sizeLabel}
          {hasComparison ? ` · 共 ${imageUrls.length} 个版本` : ""}
        </span>
      </div>
    </AnimatedModal>
  );
}
