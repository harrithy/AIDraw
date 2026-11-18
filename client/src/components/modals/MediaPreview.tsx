import { Download, ImagePlus, Loader2, Maximize, X, ZoomIn, ZoomOut } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { downloadImage } from "../../lib/download";
import { FIT_IMAGE_VIEW, MAX_VIEWER_SCALE, MIN_VIEWER_SCALE, zoomImageViewerAt, type ImageViewerTransform } from "../../lib/imageViewer";
import { AnimatedModal } from "../ui/AnimatedModal";
import { Message } from "../ui/message";
import { MediaPreviewViewport, PreviewMediaView } from "./MediaPreviewViewport";

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

export type MediaPreviewProps = {
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
  /** 任务预览追加重绘等操作，独立图片无需了解任务状态。 */
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
};

/** 公共全屏查看器：统一缩放、平移、加载重试、下载与历史版本对比。 */
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
  actions,
  toolbarStart,
  toolbarEnd
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
  // 更换任务或历史版本列表后重建菜单，避免继续操作旧任务的下载选项。
  const downloadMenuKey = JSON.stringify([groupKey, ...media.map((item) => item.url)]);
  const viewKey = JSON.stringify([groupKey, current?.url, selectedIndex, previous[selectedIndex]?.url]);
  const [viewState, setViewState] = useState<{ key: string; value: ImageViewerTransform }>({ key: viewKey, value: FIT_IMAGE_VIEW });
  // 同步记录每次查看对象变化，关闭后重开同一张图片也从适应窗口开始。
  if (viewState.key !== viewKey) setViewState({ key: viewKey, value: FIT_IMAGE_VIEW });
  const view = viewState.key === viewKey ? viewState.value : FIT_IMAGE_VIEW;
  const viewRef = useRef(view);
  viewRef.current = view;
  const updateView = useCallback((value: ImageViewerTransform) => setViewState({ key: viewKey, value }), [viewKey]);
  const isOpen = Boolean(current);
  const hasImages = Boolean((current && current.kind !== "video") || (previous[selectedIndex] && previous[selectedIndex].kind !== "video"));

  const closeOnBackground = (event: MouseEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    // 工具、缩略图和媒体区域独立处理点击；其余留白可直接关闭。
    if (target?.closest('button, a, input, video, [role="menu"], .media-zoom-viewport, .image-version-picker')) return;
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !hasImages) return;
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      // 下载菜单、视频控件和输入框保留自己的键盘行为。
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || target?.isContentEditable ||
          target?.matches("input, textarea, select") || target?.closest('[role="menu"], video')) return;
      if (event.key === "0") { event.preventDefault(); updateView(FIT_IMAGE_VIEW); }
      else if (["+", "=", "-", "_"].includes(event.key)) {
        event.preventDefault();
        const factor = event.key === "+" || event.key === "=" ? 1.2 : 1 / 1.2;
        updateView(zoomImageViewerAt(viewRef.current, viewRef.current.scale * factor, { x: 0, y: 0 }));
      }
    };
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [isOpen, hasImages, updateView]);

  const handleDownload = async (index = media.length - 1) => {
    const target = media[index];
    if (!target || downloadName === undefined || downloadInProgressRef.current) return;
    downloadInProgressRef.current = true;
    setIsDownloading(true);
    try {
      // 版本号放在文件名前面，长提示词被截断时仍能区分各个版本。
      const fileName = hasComparison ? `V${index + 1} ${downloadName}` : downloadName;
      await downloadImage(target.url, fileName, target.kind === "video" ? "video" : "image");
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
      presentation="fullscreen"
      rootClassName="media-viewer-root"
      panelClassName={`media-preview-panel media-viewer-panel${hasComparison ? " comparison-preview-panel" : ""}`}
    >
      <header className="media-viewer-header" onClick={closeOnBackground}>
        <strong className="media-viewer-label">{isVideo ? "视频预览" : "图片预览"}</strong>
        <div className="media-viewer-tools">
          {hasImages ? (
            <div className="media-viewer-zoom-tools" role="group" aria-label="图片缩放">
              <button type="button" className="image-preview-action" aria-label="缩小图片" title="缩小（-）" disabled={view.scale <= MIN_VIEWER_SCALE}
                onClick={() => updateView(zoomImageViewerAt(view, view.scale / 1.2, { x: 0, y: 0 }))}><ZoomOut size={18} /></button>
              <output className="media-viewer-zoom-value" aria-label="缩放比例" title="相对于适应窗口的缩放比例">{Math.round(view.scale * 100)}%</output>
              <button type="button" className="image-preview-action" aria-label="放大图片" title="放大（+）" disabled={view.scale >= MAX_VIEWER_SCALE}
                onClick={() => updateView(zoomImageViewerAt(view, view.scale * 1.2, { x: 0, y: 0 }))}><ZoomIn size={18} /></button>
              <button type="button" className="image-preview-action" aria-label="适应窗口" title="适应窗口并重置位置（0）" onClick={() => updateView(FIT_IMAGE_VIEW)}><Maximize size={18} /></button>
            </div>
          ) : null}
          <div className="image-preview-actions">
            {toolbarStart}
            {downloadName !== undefined ? (
              hasComparison ? (
                <DropdownMenu.Root key={downloadMenuKey} modal={false}>
                  <DropdownMenu.Trigger asChild>
                    <button type="button" className="image-preview-action" disabled={isDownloading}
                      title="选择下载版本" aria-label="选择下载版本">
                      {isDownloading ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="preview-download-menu" align="end" sideOffset={8} collisionPadding={12}
                      // Escape 先关闭版本菜单，不穿透关闭下面的图片预览。
                      onEscapeKeyDown={(event) => event.stopPropagation()}
                      aria-label="选择下载版本">
                      <DropdownMenu.Label className="preview-download-menu-heading">下载生成版本</DropdownMenu.Label>
                      {media.map((item, index) => (
                        <DropdownMenu.Item key={`${index}-${item.url}`} className="preview-download-menu-item"
                          disabled={isDownloading} onSelect={() => void handleDownload(index)}
                          aria-label={`下载 V${index + 1}${index === media.length - 1 ? "（当前版本）" : ""}`}>
                          <span className="preview-download-thumbnail" aria-hidden="true"><PreviewMediaView media={item} thumbnail /></span>
                          <strong>V{index + 1}</strong>
                          {index === media.length - 1 ? <span className="preview-download-version-tag is-current">当前版本</span>
                            : index === selectedIndex ? <span className="preview-download-version-tag">对比中</span> : null}
                          <Download size={15} className="preview-download-item-icon" aria-hidden="true" />
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              ) : (
                <button type="button" className="image-preview-action" onClick={() => void handleDownload()} disabled={isDownloading}
                  title={downloadLabel ?? (isVideo ? "下载视频" : "下载图片")} aria-label={downloadLabel ?? (isVideo ? "下载视频" : "下载图片")}>
                  {isDownloading ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
                </button>
              )
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
            {toolbarEnd}
          </div>
        </div>
        <button type="button" className="image-preview-action image-preview-close" onClick={onClose} title="关闭预览" aria-label="关闭预览">
          <X size={18} />
        </button>
      </header>
      {current ? hasComparison ? (
        <>
          <div className="image-comparison-grid" onClick={closeOnBackground}>
            <figure className="image-comparison-pane">
              <figcaption><span>对比版本</span><strong>V{selectedIndex + 1}</strong></figcaption>
              <div className="image-comparison-stage">
                {previous.map((item, index) => (
                  <div key={`${index}-${item.url}`} className={`image-comparison-layer${index === selectedIndex ? " is-selected" : ""}`} aria-hidden={index !== selectedIndex}>
                    <MediaPreviewViewport media={item} hidden={index !== selectedIndex} view={index === selectedIndex ? view : FIT_IMAGE_VIEW} onViewChange={updateView} onBackgroundClick={onClose} />
                  </div>
                ))}
              </div>
            </figure>
            <figure className="image-comparison-pane is-current">
              <figcaption><span>当前版本</span><strong>V{media.length}</strong></figcaption>
              <MediaPreviewViewport key={current.url} media={current} view={view} onViewChange={updateView} onBackgroundClick={onClose} />
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
        <MediaPreviewViewport key={current.url} media={current} view={view} onViewChange={updateView} onBackgroundClick={onClose} />
      ) : null}
      {title || description || hasImages ? (
        <footer className="media-viewer-footer" onClick={closeOnBackground}>
          <div className="image-preview-caption">
            {title ? <strong title={title}>{title}</strong> : null}
            {description ? <span title={description}>{description}</span> : null}
          </div>
          {hasImages ? <span className="media-viewer-help">滚轮 / 双指缩放 · 拖拽移动 · 点击空白关闭</span> : null}
        </footer>
      ) : null}
    </AnimatedModal>
  );
}
