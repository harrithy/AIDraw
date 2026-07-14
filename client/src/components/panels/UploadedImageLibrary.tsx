import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Calendar,
  ChevronDown,
  ImagePlus,
  Images,
  Loader2,
  Trash2,
  X,
  Eye
} from "lucide-react";
import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
import type { UploadedImage } from "../../types";
import { formatDate } from "../../lib/format";
import { prefersReducedMotion } from "../../lib/motion";
import { AnimatedModal } from "../ui/AnimatedModal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import { RetryingImage } from "../ui/RetryingImage";

type UploadedImageLibraryProps = {
  folderId: string;
  folderName: string;
  images: UploadedImage[];
  isLoading: boolean;
  onUseImage: (url: string) => void;
  onDeleteImage: (imageId: string) => Promise<void>;
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

export function UploadedImageLibrary({
  folderId,
  folderName,
  images,
  isLoading,
  onUseImage,
  onDeleteImage
}: UploadedImageLibraryProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hasOpenedRef = useRef(false);
  const popoverId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [previewImage, setPreviewImage] = useState<UploadedImage | null>(null);
  const [deleteImage, setDeleteImage] = useState<UploadedImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsOpen(false);
    setDateFilter("");
    setPreviewImage(null);
    setDeleteImage(null);
    setCollapsedDates({});
  }, [folderId]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

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
        hasOpenedRef.current = true;
        gsap.set(popover, { pointerEvents: "auto" });
        gsap.fromTo(
          popover,
          { autoAlpha: 0, y: -8, scale: 0.985 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: "power3.out", overwrite: "auto" }
        );

        const content = popover.querySelectorAll<HTMLElement>(
          ".uploaded-image-library-controls, .uploaded-image-date-group, .uploaded-image-library-state"
        );
        if (content.length > 0) {
          gsap.fromTo(
            content,
            { autoAlpha: 0, y: -4 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.24,
              delay: 0.06,
              stagger: 0.035,
              ease: "power2.out",
              clearProps: "transform,opacity,visibility"
            }
          );
        }
        return;
      }

      gsap.set(popover, { pointerEvents: "none" });
      if (!hasOpenedRef.current) {
        gsap.set(popover, { autoAlpha: 0, y: -8, scale: 0.985 });
        return;
      }
      gsap.to(popover, {
        autoAlpha: 0,
        y: -8,
        scale: 0.985,
        duration: 0.18,
        ease: "power2.in",
        overwrite: "auto"
      });
    },
    { dependencies: [isOpen], scope: anchorRef }
  );

  const groupedImages = useMemo(() => {
    const filteredImages = dateFilter
      ? images.filter((image) => getLocalDateKey(image.createdAt) === dateFilter)
      : images;
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
  }, [dateFilter, images]);

  const confirmDelete = async () => {
    if (!deleteImage || isDeleting) return;
    try {
      setIsDeleting(true);
      await onDeleteImage(deleteImage.id);
      setDeleteImage(null);
    } catch {
      // App 已展示失败状态，保留确认框便于重试。
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

  return (
    <>
      <div
        ref={anchorRef}
        className="uploaded-image-library-anchor"
        data-testid="uploaded-image-library"
      >
        <button
          ref={triggerRef}
          type="button"
          className="uploaded-image-library-trigger"
          onClick={() => setIsOpen((value) => !value)}
          title="上传图片"
          aria-label="上传图片"
          aria-expanded={isOpen}
          aria-controls={popoverId}
          aria-haspopup="dialog"
        >
          <Images size={19} />
          {images.length > 0 ? <span className="uploaded-image-library-count" aria-hidden="true">{images.length}</span> : null}
        </button>

        <div
          ref={popoverRef}
          id={popoverId}
          className="uploaded-image-library-popover"
          role="dialog"
          aria-label={`${folderName}的上传图片`}
          aria-hidden={!isOpen}
        >
          <div className="uploaded-image-library-header">
            <div className="uploaded-image-library-title">
              <Images size={15} aria-hidden="true" />
              <span>上传图片</span>
            </div>
            {images.length > 0 ? (
              <span className="uploaded-image-library-total" aria-hidden="true">
                {images.length}
              </span>
            ) : null}
          </div>

          <div className="uploaded-image-library-controls">
            <div className="uploaded-image-date-wrapper" title="按日期筛选">
              <Calendar size={14} className="uploaded-image-date-icon" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="uploaded-image-date-input"
                aria-label="按日期筛选上传图片"
              />
              {dateFilter ? (
                <button
                  type="button"
                  className="uploaded-image-date-clear"
                  onClick={() => setDateFilter("")}
                  title="清除日期筛选"
                  aria-label="清除日期筛选"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="uploaded-image-library-body">
            {isLoading ? (
              <div className="uploaded-image-skeleton-group" aria-hidden="true">
                <div className="uploaded-image-skeleton-heading" />
                <div className="uploaded-image-grid">
                  <span className="uploaded-image-skeleton-tile" />
                  <span className="uploaded-image-skeleton-tile" />
                  <span className="uploaded-image-skeleton-tile" />
                </div>
                <span className="uploaded-image-library-state-text">正在加载</span>
              </div>
            ) : groupedImages.length === 0 ? (
              <div className="uploaded-image-library-state">
                <Images size={22} />
                <span>{dateFilter ? "该日期没有图片" : "暂无上传图片"}</span>
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
                              >
                                <RetryingImage src={image.url} alt={image.originalName} />
                              </button>
                              <div className="uploaded-image-overlay">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  className="uploaded-image-action-btn delete-btn"
                                  onClick={() => setDeleteImage(image)}
                                  title="从列表移除"
                                  aria-label={`移除 ${image.originalName}`}
                                >
                                  <Trash2 size={13} />
                                </Button>

                                <div className="uploaded-image-overlay-bottom">
                                  <span className="uploaded-image-overlay-name" title={image.originalName}>
                                    {image.originalName}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    className="uploaded-image-action-btn use-btn"
                                    onClick={() => onUseImage(image.url)}
                                    title="用作参考图"
                                    aria-label={`${image.originalName} 用作参考图`}
                                  >
                                    <ImagePlus size={13} />
                                  </Button>
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
        </div>
      </div>

      <AnimatedModal
        open={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        ariaLabel="上传图片预览"
        panelClassName="uploaded-image-preview-panel"
      >
        {previewImage ? (
          <>
            <div className="image-preview-actions">
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
            <RetryingImage src={previewImage.url} alt={previewImage.originalName} />
            <div className="image-preview-caption uploaded-image-preview-caption">
              <div>
                <strong>{previewImage.originalName}</strong>
                <span>{formatDate(previewImage.createdAt)}</span>
              </div>
              <Button
                type="button"
                onClick={() => {
                  onUseImage(previewImage.url);
                  setPreviewImage(null);
                }}
              >
                <ImagePlus data-icon="inline-start" />
                用作参考图
              </Button>
            </div>
          </>
        ) : null}
      </AnimatedModal>

      <Dialog open={Boolean(deleteImage)} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteImage(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>移除上传记录</DialogTitle>
            <DialogDescription>只会从当前文件夹的图片列表中移除，不会删除图床文件。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteImage(null)} disabled={isDeleting}>取消</Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
              移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
