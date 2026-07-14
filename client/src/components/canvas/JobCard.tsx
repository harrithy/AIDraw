import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  PenLine,
  Play,
  RotateCcw,
  Sparkles,
  X
} from "lucide-react";
import { memo, type CSSProperties, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { JobCardSize } from "../../lib/canvas";
import { downloadImage } from "../../lib/download";
import { formatDate } from "../../lib/format";
import { isNanoBananaModel, supportsNanoBananaImageSize } from "../../lib/imageModels";
import { getJobOutputImages } from "../../lib/jobImages";
import { statusLabel } from "../../lib/jobLabels";
import { prefersReducedMotion } from "../../lib/motion";
import type { DrawJob } from "../../types";
import { AnimatedModal } from "../ui/AnimatedModal";
import { RetryingImage } from "../ui/RetryingImage";

const VERSION_GAP = 8;

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
  onEditRetry: (job: DrawJob) => void;
  onUseImage?: (url: string) => void;
};

const statusIcon = (status: DrawJob["status"]) => {
  if (status === "running") return <Loader2 className="spin" size={16} />;
  if (status === "pending") return <Clock size={16} />;
  if (status === "failed") return <AlertCircle size={16} />;
  return <Sparkles size={16} />;
};

export const JobCard = memo(function JobCard({
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
  onEditRetry,
  onUseImage
}: JobCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [retryMenuOpen, setRetryMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null);
  const [versionsExpanded, setVersionsExpanded] = useState(false);
  const [renderHistory, setRenderHistory] = useState(false);
  const versionAnimationRef = useRef<gsap.core.Tween | null>(null);
  const canRetry = job.status === "completed" || job.status === "failed";
  const outputImages = getJobOutputImages(job);
  const previousOutputCountRef = useRef(Math.max(1, outputImages.length));
  const currentImageUrl = outputImages[outputImages.length - 1];
  const hasMultipleVersions = outputImages.length > 1;
  const displayedVersions = hasMultipleVersions
    ? renderHistory
      ? outputImages.map((imageUrl, imageIndex) => ({
          imageUrl,
          versionNumber: imageIndex + 1
        }))
      : currentImageUrl
        ? [{ imageUrl: currentImageUrl, versionNumber: outputImages.length }]
        : []
    : [];
  const layoutVersionCount = hasMultipleVersions && versionsExpanded ? outputImages.length : 1;
  const expandedImageWidth =
    layoutVersionCount * cardSize.imageWidth + (layoutVersionCount - 1) * VERSION_GAP;
  const historyImageWidth =
    Math.max(1, displayedVersions.length) * cardSize.imageWidth + (Math.max(1, displayedVersions.length) - 1) * VERSION_GAP;
  const expandedCardWidth = cardSize.cardWidth + expandedImageWidth - cardSize.imageWidth;
  const expandedOffsetX = expandedCardWidth - cardSize.cardWidth;
  const isRegenerating = Boolean(currentImageUrl) && (job.status === "pending" || job.status === "running");
  const sizeLabel = job.size || (job.width && job.height ? `${job.width}x${job.height}` : "auto");
  const usesNanoBanana = isNanoBananaModel(job.model);
  const qualityLabel = usesNanoBanana
    ? supportsNanoBananaImageSize(job.model)
      ? job.imageSize ?? "4K"
      : "自动"
    : job.thinking === "low" || job.thinking === "medium" || job.thinking === "high"
      ? job.thinking
      : "high";
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
  const cardStyle: CSSProperties &
    Record<
      | "--job-card-width"
      | "--job-card-base-width"
      | "--job-card-height"
      | "--job-image-width"
      | "--job-image-height"
      | "--job-expanded-image-width"
      | "--job-history-image-width"
      | "--job-version-count",
      string
    > = {
    left: `${posX - expandedOffsetX}px`,
    top: `${posY}px`,
    "--job-card-width": `${expandedCardWidth}px`,
    "--job-card-base-width": `${cardSize.cardWidth}px`,
    "--job-card-height": `${cardSize.cardHeight}px`,
    "--job-image-width": `${cardSize.imageWidth}px`,
    "--job-image-height": `${cardSize.imageHeight}px`,
    "--job-expanded-image-width": `${expandedImageWidth}px`,
    "--job-history-image-width": `${historyImageWidth}px`,
    "--job-version-count": String(Math.max(1, displayedVersions.length))
  };

  const { contextSafe } = useGSAP({ scope: cardRef });

  const toggleVersions = contextSafe(() => {
    const card = cardRef.current;
    const image = card?.querySelector<HTMLElement>(".job-image");
    if (!card || !image) return;

    const nextExpanded = !versionsExpanded;
    versionAnimationRef.current?.kill();

    if (prefersReducedMotion()) {
      flushSync(() => {
        setRenderHistory(nextExpanded);
        setVersionsExpanded(nextExpanded);
      });
      versionAnimationRef.current = null;
      return;
    }

    const cardStyles = window.getComputedStyle(card);
    const imageStyles = window.getComputedStyle(image);
    const currentLeft = Number.parseFloat(cardStyles.left);
    const currentCardWidth = Number.parseFloat(cardStyles.width);
    const currentImageWidth = Number.parseFloat(imageStyles.width);
    const targetVersionCount = nextExpanded ? outputImages.length : 1;
    const targetImageWidth =
      targetVersionCount * cardSize.imageWidth + (targetVersionCount - 1) * VERSION_GAP;
    const targetCardWidth = cardSize.cardWidth + targetImageWidth - cardSize.imageWidth;
    const targetLeft = posX - (targetCardWidth - cardSize.cardWidth);

    flushSync(() => {
      if (nextExpanded) setRenderHistory(true);
      setVersionsExpanded(nextExpanded);
    });

    versionAnimationRef.current = gsap.fromTo(
      card,
      {
        left: Number.isFinite(currentLeft) ? currentLeft : posX - expandedOffsetX,
        "--job-card-width": `${Number.isFinite(currentCardWidth) ? currentCardWidth : expandedCardWidth}px`,
        "--job-expanded-image-width": `${Number.isFinite(currentImageWidth) ? currentImageWidth : expandedImageWidth}px`
      },
      {
        left: targetLeft,
        "--job-card-width": `${targetCardWidth}px`,
        "--job-expanded-image-width": `${targetImageWidth}px`,
        duration: 0.5,
        ease: "power2.inOut",
        overwrite: true,
        onComplete: () => {
          versionAnimationRef.current = null;
          if (!nextExpanded) setRenderHistory(false);
        }
      }
    );
  });

  const handleDownload = async () => {
    if (!currentImageUrl || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadImage(currentImageUrl, job.prompt);
    } finally {
      setIsDownloading(false);
    }
  };

  // 重绘菜单打开时，点击卡片外部或按 Esc 关闭菜单
  useEffect(() => {
    if (!retryMenuOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      const card = cardRef.current;
      if (card && !card.contains(event.target as Node)) setRetryMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRetryMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [retryMenuOpen]);

  // 工具栏收起时，一并关闭重绘菜单
  useEffect(() => {
    if (!toolsOpen) setRetryMenuOpen(false);
  }, [toolsOpen]);

  useGSAP(
    () => {
      const previousCount = previousOutputCountRef.current;
      const nextCount = Math.max(1, outputImages.length);
      previousOutputCountRef.current = nextCount;
      if (!versionsExpanded || nextCount <= previousCount || prefersReducedMotion()) return;

      const card = cardRef.current;
      if (!card) return;

      const previousImageWidth = previousCount * cardSize.imageWidth + (previousCount - 1) * VERSION_GAP;
      const previousCardWidth = cardSize.cardWidth + previousImageWidth - cardSize.imageWidth;
      const previousLeft = posX - (previousCardWidth - cardSize.cardWidth);

      versionAnimationRef.current?.kill();
      versionAnimationRef.current = gsap.fromTo(
        card,
        {
          left: previousLeft,
          "--job-card-width": `${previousCardWidth}px`,
          "--job-expanded-image-width": `${previousImageWidth}px`
        },
        {
          left: posX - expandedOffsetX,
          "--job-card-width": `${expandedCardWidth}px`,
          "--job-expanded-image-width": `${expandedImageWidth}px`,
          duration: 0.5,
          ease: "power2.inOut",
          overwrite: true,
          onComplete: () => {
            versionAnimationRef.current = null;
          }
        }
      );
    },
    { dependencies: [outputImages.length], scope: cardRef }
  );

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
      }${hasMultipleVersions ? " has-output-versions" : ""}${hasMultipleVersions && versionsExpanded ? " versions-expanded" : ""}`}
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
              <img
                src={imageUrl}
                alt={`参考图片 ${imageIndex + 1}`}
                loading="lazy"
                decoding="async"
              />
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
              {currentImageUrl ? (
                <>
                  <button type="button" onClick={() => void handleDownload()} disabled={isDownloading} title="下载图片">
                    {isDownloading ? <Loader2 className="spin" size={15} /> : <Download size={15} />}
                  </button>
                  {onUseImage && (
                    <button type="button" onClick={() => onUseImage(currentImageUrl)} title="作为参考图引用">
                      <ImagePlus size={15} />
                    </button>
                  )}
                </>
              ) : null}
              {canRetry ? (
                <div className="job-retry-wrapper">
                  <button
                    type="button"
                    className={`job-retry-toggle${retryMenuOpen ? " is-open" : ""}`}
                    onClick={() => setRetryMenuOpen((value) => !value)}
                    title="重新绘制"
                    aria-haspopup="menu"
                    aria-expanded={retryMenuOpen}
                  >
                    <RotateCcw size={15} />
                  </button>
                  {retryMenuOpen ? (
                    <div className="job-retry-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="job-retry-menu-item"
                        onClick={() => {
                          setRetryMenuOpen(false);
                          setToolsOpen(false);
                          onEditRetry(job);
                        }}
                      >
                        <PenLine size={14} />
                        <span>重新编辑</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="job-retry-menu-item"
                        onClick={() => {
                          setRetryMenuOpen(false);
                          onRetry(job.id);
                        }}
                      >
                        <Play size={14} />
                        <span>继续</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className={`job-image ${currentImageUrl ? "has-output" : ""}${hasMultipleVersions ? " has-versions" : ""}`}>
        {currentImageUrl ? (
          hasMultipleVersions ? (
            <div className="job-image-comparison">
              {displayedVersions.map(({ imageUrl, versionNumber }) => {
                const isLatest = versionNumber === outputImages.length;

                return (
                  <button
                    key={`${versionNumber}-${imageUrl}`}
                    type="button"
                    className={`job-image-version${isLatest ? " is-latest" : ""}`}
                    onClick={() => onPreview(job)}
                    title={isLatest ? `查看当前版本 V${versionNumber}` : `查看并对比 V${versionNumber}`}
                  >
                    <RetryingImage src={imageUrl} alt={`${job.prompt}，版本 ${versionNumber}`} />
                    <span>{isLatest ? "当前" : "上一版"} · V{versionNumber}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <button type="button" className="job-image-button" onClick={() => onPreview(job)} title="放大预览">
              <RetryingImage key={currentImageUrl} src={currentImageUrl} alt={job.prompt} />
            </button>
          )
        ) : (
          <div className="job-placeholder">
            {statusIcon(job.status)}
            <span>{statusLabel[job.status]}</span>
          </div>
        )}
        {isRegenerating ? (
          <span className="job-regenerating-status">
            {job.status === "running" ? <Loader2 className="spin" size={13} /> : <Clock size={13} />}
            正在生成新版本
          </span>
        ) : null}
      </div>

      {hasMultipleVersions ? (
        <button
          type="button"
          className="job-version-toggle"
          onClick={toggleVersions}
          aria-expanded={versionsExpanded}
          title={versionsExpanded ? "收纳历史版本" : "向左展开历史版本"}
        >
          {versionsExpanded ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      ) : null}

      <div className="job-body">
        <div className="job-meta-line" aria-label="任务参数">
          <span className="job-meta-item">
            <em>时间</em>
            <strong>{formatDate(job.createdAt)}</strong>
          </span>
          <span className="job-meta-item">
            <em>{usesNanoBanana ? "分辨率" : "Quality"}</em>
            <strong>{qualityLabel}</strong>
          </span>
          <span className="job-meta-item">
            <em>尺寸</em>
            <strong>{sizeLabel}</strong>
          </span>
        </div>
        {job.errorMessage ? <small className="error-text">{job.errorMessage}</small> : null}
      </div>

      <AnimatedModal
        open={Boolean(referencePreviewUrl)}
        onClose={() => setReferencePreviewUrl(null)}
        ariaLabel="参考图片预览"
        panelClassName="reference-preview-panel"
      >
        {referencePreviewUrl ? (
          <>
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
          </>
        ) : null}
      </AnimatedModal>
    </article>
  );
});
