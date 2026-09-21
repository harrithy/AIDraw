import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  Images,
  Loader2,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { type ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { UploadedImage } from "../../types";
import { downloadImage } from "../../lib/download";
import { prefersReducedMotion } from "../../lib/motion";
import { AnimatedModal } from "../ui/AnimatedModal";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import { Input } from "../ui/input";
import { RetryingImage } from "../ui/RetryingImage";

export type GlobalAssetLibraryProps = {
  isOpen: boolean;
  onClose: () => void;
  images: UploadedImage[];
  isLoading: boolean;
  onUseImage: (url: string) => void;
  onDeleteImage: (imageId: string) => Promise<void>;
  onUploadImage?: (file: File) => Promise<UploadedImage>;
};

const dateLabelFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short"
});

const getLocalDateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "日期未知" : dateLabelFormatter.format(date);
};

const isUploadedVideo = (media: UploadedImage) =>
  media.mimeType?.startsWith("video/") || /\.(?:mp4|webm|mov)(?:\?|$)/i.test(media.url);

const formatByteSize = (bytes: number) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function GlobalAssetLibrary({
  isOpen,
  onClose,
  images,
  isLoading,
  onUseImage,
  onDeleteImage,
  onUploadImage
}: GlobalAssetLibraryProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const popoverId = useId();

  const [dateFilter, setDateFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewImage, setPreviewImage] = useState<UploadedImage | null>(null);
  const [deleteImage, setDeleteImage] = useState<UploadedImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((cur) => (cur === message ? null : cur));
    }, 2000);
  };

  useEffect(() => {
    if (!isOpen) {
      setDateFilter("");
      setSearchQuery("");
      setPreviewImage(null);
      setDeleteImage(null);
      setCollapsedDates({});
      setToastMessage(null);
      setCopiedUrl(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (previewImage) {
          setPreviewImage(null);
        } else if (deleteImage) {
          setDeleteImage(null);
        } else {
          onClose();
        }
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      // 避免在打开弹窗（预览或删除确认）时，点击蒙层误关 popover
      if (previewImage || deleteImage) return;

      const target = event.target as Element | null;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target as Node) &&
        !target?.closest?.(".toolbar-asset-btn") &&
        !target?.closest?.("[role='dialog']")
      ) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onClose, previewImage, deleteImage]);

  useGSAP(
    () => {
      const popover = popoverRef.current;
      if (!popover) return;

      gsap.killTweensOf(popover);

      if (prefersReducedMotion()) {
        gsap.set(popover, {
          autoAlpha: isOpen ? 1 : 0,
          y: 0,
          scale: 1,
          pointerEvents: isOpen ? "auto" : "none"
        });
        return;
      }

      if (isOpen) {
        gsap.set(popover, { pointerEvents: "auto" });
        gsap.fromTo(
          popover,
          { autoAlpha: 0, y: -8, scale: 0.985 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.24, ease: "power3.out", overwrite: "auto" }
        );
      } else {
        gsap.set(popover, { pointerEvents: "none" });
        gsap.to(popover, {
          autoAlpha: 0,
          y: -8,
          scale: 0.985,
          duration: 0.16,
          ease: "power2.in",
          overwrite: "auto"
        });
      }
    },
    { dependencies: [isOpen], scope: popoverRef }
  );

  const filteredImages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return images.filter((image) => {
      if (dateFilter && getLocalDateKey(image.createdAt) !== dateFilter) {
        return false;
      }
      if (q && !image.originalName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [images, dateFilter, searchQuery]);

  const groupedImages = useMemo(() => {
    const groups = new Map<string, UploadedImage[]>();

    for (const image of filteredImages) {
      const dateKey = getLocalDateKey(image.createdAt);
      const group = groups.get(dateKey) ?? [];
      group.push(image);
      groups.set(dateKey, group);
    }

    return Array.from(groups.entries()).map(([dateKey, items]) => ({
      dateKey,
      label: getDateLabel(items[0]?.createdAt ?? ""),
      items
    }));
  }, [filteredImages]);

  const handleUploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !onUploadImage) return;

    try {
      setIsUploading(true);
      for (const file of files) {
        await onUploadImage(file);
      }
      showToast(`已成功上传 ${files.length} 个素材喵！🐾`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmDelete = async () => {
    if (!deleteImage || isDeleting) return;
    try {
      setIsDeleting(true);
      await onDeleteImage(deleteImage.id);
      if (previewImage?.id === deleteImage.id) {
        setPreviewImage(null);
      }
      setDeleteImage(null);
      showToast("已移除该素材记录喵～");
    } catch {
      // 错误由上层处理
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleCollapse = (dateKey: string) => {
    setCollapsedDates((current) => ({
      ...current,
      [dateKey]: !current[dateKey]
    }));
  };

  const handleCopyUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    showToast("链接已复制到剪贴板！");
    setTimeout(() => {
      setCopiedUrl((cur) => (cur === url ? null : cur));
    }, 2000);
  };

  return (
    <>
      <div
        ref={popoverRef}
        id={popoverId}
        className="global-asset-library-popover"
        role="dialog"
        aria-label="总素材库"
        aria-hidden={!isOpen}
      >
        {/* 顶部标题栏 */}
        <div className="global-asset-library-header">
          <div className="global-asset-library-title">
            <Images size={16} className="text-[var(--green-dark)]" aria-hidden="true" />
            <strong>总素材库</strong>
            {images.length > 0 ? (
              <span className="global-asset-total-badge" title={`共 ${images.length} 项素材`}>
                {images.length}
              </span>
            ) : null}
          </div>

          <div className="global-asset-header-actions">
            {onUploadImage ? (
              <label
                className={`global-asset-upload-btn ${isUploading ? "is-uploading" : ""}`}
                title="上传本地图片或视频到总素材库"
              >
                {isUploading ? <Loader2 size={13} className="spin" /> : <Upload size={13} />}
                <span>{isUploading ? "上传中" : "上传素材"}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  disabled={isUploading}
                  className="sr-only"
                  onChange={handleUploadFiles}
                />
              </label>
            ) : null}
          </div>
        </div>

        {/* 过滤控制栏：文件名搜索 + 日期筛选 */}
        <div className="global-asset-controls">
          <div className="global-asset-search-box" title="按文件名搜索">
            <Search size={13} className="global-asset-control-icon" />
            <input
              type="text"
              placeholder="搜索素材名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="global-asset-search-input"
            />
            {searchQuery ? (
              <button
                type="button"
                className="global-asset-clear-btn"
                onClick={() => setSearchQuery("")}
                title="清除搜索"
              >
                <X size={11} />
              </button>
            ) : null}
          </div>

          <div className="global-asset-date-box" title="按日期筛选">
            <Calendar size={13} className="global-asset-control-icon" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="global-asset-date-input"
              aria-label="按日期筛选素材"
            />
            {dateFilter ? (
              <button
                type="button"
                className="global-asset-clear-btn"
                onClick={() => setDateFilter("")}
                title="清除日期筛选"
              >
                <X size={11} />
              </button>
            ) : null}
          </div>
        </div>

        {/* 主体素材网格 */}
        <div className="global-asset-body">
          {isLoading ? (
            <div className="uploaded-image-skeleton-group" aria-hidden="true">
              <div className="uploaded-image-skeleton-heading" />
              <div className="uploaded-image-grid">
                <span className="uploaded-image-skeleton-tile" />
                <span className="uploaded-image-skeleton-tile" />
                <span className="uploaded-image-skeleton-tile" />
              </div>
              <span className="uploaded-image-library-state-text">正在加载全局素材喵...</span>
            </div>
          ) : groupedImages.length === 0 ? (
            <div className="global-asset-empty-state">
              <Images size={28} className="text-[var(--muted)] opacity-60" />
              <p>
                {searchQuery || dateFilter
                  ? "没有找到匹配的素材喵..."
                  : "总素材库暂无素材"}
              </p>
              {onUploadImage && !searchQuery && !dateFilter ? (
                <label className="global-asset-empty-upload-action">
                  <Upload size={13} />
                  <span>点击上传第一张素材</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    disabled={isUploading}
                    className="sr-only"
                    onChange={handleUploadFiles}
                  />
                </label>
              ) : null}
            </div>
          ) : (
            groupedImages.map((group) => {
              const isCollapsed = collapsedDates[group.dateKey] || false;
              return (
                <section className="uploaded-image-date-group" key={group.dateKey}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="uploaded-image-date-heading"
                    onClick={() => toggleCollapse(group.dateKey)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleCollapse(group.dateKey);
                      }
                    }}
                    aria-expanded={!isCollapsed}
                  >
                    <strong>
                      <ChevronDown
                        size={14}
                        className={`uploaded-image-date-chevron ${isCollapsed ? "is-collapsed" : ""}`}
                      />
                      {group.label}
                    </strong>
                    <span>{group.items.length}</span>
                  </div>

                  <div className={`uploaded-image-grid-wrapper ${isCollapsed ? "is-collapsed" : ""}`}>
                    <div className="uploaded-image-grid-content">
                      <div className="uploaded-image-grid">
                        {group.items.map((image) => (
                          <article className="uploaded-image-item" key={image.id}>
                            <button
                              type="button"
                              className="uploaded-image-preview-button"
                              onClick={() => setPreviewImage(image)}
                              title={`预览 ${image.originalName}`}
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                minWidth: 0,
                                minHeight: 0,
                                maxWidth: "none",
                                maxHeight: "none",
                                border: 0,
                                borderRadius: "inherit",
                                padding: 0,
                                margin: 0,
                                background: "transparent",
                                display: "block"
                              }}
                            >
                              {isUploadedVideo(image) ? (
                                <video
                                  src={image.url}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  aria-label={image.originalName}
                                />
                              ) : (
                                <RetryingImage src={image.url} alt={image.originalName} />
                              )}
                            </button>

                            <div className="uploaded-image-overlay">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="uploaded-image-action-btn delete-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteImage(image);
                                }}
                                title="从列表移除"
                                aria-label={`移除 ${image.originalName}`}
                              >
                                <Trash2 size={13} />
                              </Button>

                              <div className="uploaded-image-overlay-bottom">
                                <span className="uploaded-image-overlay-name" title={image.originalName}>
                                  {image.originalName}
                                </span>
                                {!isUploadedVideo(image) ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    className="uploaded-image-action-btn use-btn"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onUseImage(image.url);
                                    }}
                                    title="用作参考图"
                                    aria-label={`${image.originalName} 用作参考图`}
                                  >
                                    <ImagePlus size={13} />
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    className="uploaded-image-action-btn copy-btn"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCopyUrl(image.url);
                                    }}
                                    title="复制链接"
                                    aria-label={`复制 ${image.originalName} 链接`}
                                  >
                                    {copiedUrl === image.url ? (
                                      <Check size={13} className="text-[var(--green)]" />
                                    ) : (
                                      <Copy size={13} />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* 底部轻量提示条 */}
        {toastMessage ? (
          <div className="global-asset-toast-bar">
            <span>{toastMessage}</span>
          </div>
        ) : null}
      </div>

      {/* 大图预览模态框 */}
      <AnimatedModal
        open={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        ariaLabel={previewImage && isUploadedVideo(previewImage) ? "素材视频预览" : "素材图片预览"}
        panelClassName="uploaded-image-preview-panel"
      >
        {previewImage ? (
          <>
            <div className="image-preview-actions">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => void downloadImage(previewImage.url, previewImage.originalName, isUploadedVideo(previewImage) ? "video" : "image")}
                title="下载原文件"
                aria-label="下载原文件"
              >
                <Download />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => handleCopyUrl(previewImage.url)}
                title="复制链接"
                aria-label="复制链接"
              >
                {copiedUrl === previewImage.url ? <Check className="text-[var(--green)]" /> : <Copy />}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => window.open(previewImage.url, "_blank", "noopener,noreferrer")}
                title="在新标签页打开"
                aria-label="在新标签页打开"
              >
                <ExternalLink />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => setPreviewImage(null)}
                title="关闭预览"
                aria-label="关闭预览"
              >
                <X />
              </Button>
            </div>

            {isUploadedVideo(previewImage) ? (
              <video src={previewImage.url} controls autoPlay muted loop playsInline preload="metadata" />
            ) : (
              <RetryingImage src={previewImage.url} alt={previewImage.originalName} />
            )}
          </>
        ) : null}
      </AnimatedModal>

      {/* 删除确认对话框 */}
      <Dialog
        open={Boolean(deleteImage)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteImage(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>从总素材库移除</DialogTitle>
            <DialogDescription>
              将从总素材库列表中移除该记录（不会删除云端图床文件）。已生成的历史任务不会受到影响。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteImage(null)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
