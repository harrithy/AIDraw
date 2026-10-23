import { Download, ImagePlus, Loader2, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { downloadImage } from "../../lib/download";
import { AnimatedModal } from "../ui/AnimatedModal";
import { Message } from "../ui/message";
import { RetryingImage } from "../ui/RetryingImage";

/** 预览只依赖媒体信息，不耦合任务、上传记录或创作草稿。 */
export type PreviewMedia = {
  url: string;
  alt: string;
  kind?: "image" | "video";
};

/** 入口可追加复制链接等操作，按钮外观和无障碍标签由预览统一管理。 */
export type PreviewAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

type MediaPreviewProps = {
  /** 单图传一项；任务历史按旧到新传入，最后一项作为当前版本。 */
  items: readonly PreviewMedia[];
  onClose: () => void;
  ariaLabel?: string;
  title?: string;
  description?: string;
  comparisonKey?: string;
  /** 提供文件名时启用公共下载操作。 */
  downloadName?: string;
  downloadLabel?: string;
  onUseImage?: (url: string) => void;
  actions?: readonly PreviewAction[];
};

/** 所有入口共用的媒体渲染；隐藏版本和缩略图不自动播放视频。 */
function PreviewMediaView({ media, hidden = false, thumbnail = false }: {
  media: PreviewMedia;
  hidden?: boolean;
  thumbnail?: boolean;
}) {
  return media.kind === "video" ? (
    <video
      src={media.url}
      aria-label={media.alt}
      controls={!thumbnail && !hidden}
      autoPlay={!thumbnail && !hidden}
      loop
      muted
      playsInline
      preload="metadata"
    />
  ) : (
    <RetryingImage key={media.url} src={media.url} alt={media.alt} loading="eager" />
  );
}

/** 公共大图预览：统一弹层、加载重试、工具栏、视频兼容及历史版本对比。 */
export function MediaPreview({
  items,
  onClose,
  ariaLabel,
  title,
  description,
  comparisonKey,
  downloadName,
  downloadLabel,
  onUseImage,
  actions
}: MediaPreviewProps) {
  const [selection, setSelection] = useState<{ key: string; index: number } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadInProgressRef = useRef(false);
  const media = items.filter((item) => item.url.trim());
  const current = media[media.length - 1];
  const previous = media.slice(0, -1);
  const groupKey = comparisonKey ?? current?.url ?? "";
  const latestIndex = Math.max(0, previous.length - 1);
  // 切换任务时使用该任务的最近旧版本，历史缩短时及时收敛到有效索引。
  const selectedIndex = Math.max(0, Math.min(selection?.key === groupKey ? selection.index : latestIndex, latestIndex));
  const isVideo = current?.kind === "video";
  const hasComparison = previous.length > 0;

  const handleDownload = async () => {
    if (!current || downloadName === undefined || downloadInProgressRef.current) return;
    downloadInProgressRef.current = true;
    setIsDownloading(true);
    try {
      await downloadImage(current.url, downloadName, isVideo ? "video" : "image");
    } catch {
      Message.error("下载失败，请重试");
    } finally {
      downloadInProgressRef.current = false;
      setIsDownloading(false);
    }
  };

  return (
    <AnimatedModal
      open={Boolean(current)}
      onClose={onClose}
      ariaLabel={ariaLabel ?? (isVideo ? "视频预览" : "图片预览")}
      panelClassName={`media-preview-panel${hasComparison ? " comparison-preview-panel" : ""}`}
    >
      <div className="image-preview-actions">
        {downloadName !== undefined ? (
          <button type="button" className="image-preview-action" onClick={() => void handleDownload()} disabled={isDownloading}
            title={downloadLabel ?? (isVideo ? "下载视频" : "下载图片")} aria-label={downloadLabel ?? (isVideo ? "下载视频" : "下载图片")}>
            {isDownloading ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
          </button>
        ) : null}
        {current && onUseImage && !isVideo ? (
          <button type="button" className="image-preview-action" onClick={() => onUseImage(current.url)} title="作为参考图引用" aria-label="作为参考图引用">
            <ImagePlus size={18} />
          </button>
        ) : null}
        {actions?.map((action) => (
          <button key={action.id} type="button" className="image-preview-action" onClick={action.onClick} title={action.label} aria-label={action.label}>
            {action.icon}
          </button>
        ))}
        <button type="button" className="image-preview-action image-preview-close" onClick={onClose} title="关闭预览" aria-label="关闭预览">
          <X size={18} />
        </button>
      </div>
      {current ? hasComparison ? (
        <>
          <div className="image-comparison-grid">
            <figure className="image-comparison-pane">
              <figcaption><span>对比版本</span><strong>V{selectedIndex + 1}</strong></figcaption>
              <div className="image-comparison-stage">
                {previous.map((item, index) => (
                  <div key={`${index}-${item.url}`} className={`image-comparison-layer${index === selectedIndex ? " is-selected" : ""}`} aria-hidden={index !== selectedIndex}>
                    <PreviewMediaView media={item} hidden={index !== selectedIndex} />
                  </div>
                ))}
              </div>
            </figure>
            <figure className="image-comparison-pane is-current">
              <figcaption><span>当前版本</span><strong>V{media.length}</strong></figcaption>
              <div className="media-preview-content"><PreviewMediaView media={current} /></div>
            </figure>
          </div>
          {previous.length > 1 ? (
            <div className="image-version-picker">
              <span>选择旧版本</span>
              <div className="image-version-list">
                {previous.map((item, index) => (
                  <button key={`${index}-${item.url}`} type="button" className={index === selectedIndex ? "selected" : ""}
                    onClick={() => setSelection({ key: groupKey, index })} aria-pressed={index === selectedIndex}
                    title={`与当前版本对比 V${index + 1}`} aria-label={`与当前版本对比 V${index + 1}`}>
                    <PreviewMediaView media={item} thumbnail />
                    <span>V{index + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="media-preview-content"><PreviewMediaView media={current} /></div>
      ) : null}
      {title || description ? (
        <div className="image-preview-caption">
          {title ? <strong title={title}>{title}</strong> : null}
          {description ? <span title={description}>{description}</span> : null}
        </div>
      ) : null}
    </AnimatedModal>
  );
}
