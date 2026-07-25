import { type PointerEventHandler, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalTransition } from "../../hooks/useModalTransition";
import { cn } from "../../lib/utils";

/** AnimatedModal 组件的 Props 类型 */
type AnimatedModalProps = {
  /** 是否显示模态框 */
  open: boolean;
  onClose: () => void;
  /** 无障碍标签 */
  ariaLabel: string;
  children: ReactNode;
  /** 根容器额外 CSS 类 */
  rootClassName?: string;
  /** 面板容器额外 CSS 类 */
  panelClassName?: string;
  /** 是否通过 Portal 渲染到 body */
  portal?: boolean;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
};

type PreservedModalContent = Pick<
  AnimatedModalProps,
  "ariaLabel" | "children" | "rootClassName" | "panelClassName"
>;

/**
 * 通用动画模态框组件。
 * 基于 GSAP 提供入场/出场动画，支持 Portal 渲染和 keepMounted 模式
 * （关闭时保留 DOM 以便退出动画播放完再卸载）。
 */
export function AnimatedModal({
  open,
  onClose,
  ariaLabel,
  children,
  rootClassName,
  panelClassName,
  portal = true,
  onPointerDown
}: AnimatedModalProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const preservedContentRef = useRef<PreservedModalContent>({
    ariaLabel,
    children,
    rootClassName,
    panelClassName
  });

  if (open) {
    preservedContentRef.current = { ariaLabel, children, rootClassName, panelClassName };
  }

  const isPresent = useModalTransition({
    open,
    scopeRef: rootRef,
    backdropRef,
    panelRef
  });

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!isPresent) return null;

  const content = open
    ? { ariaLabel, children, rootClassName, panelClassName }
    : preservedContentRef.current;
  const modal = (
    <div
      ref={rootRef}
      className={cn("image-preview-backdrop animated-modal-root", content.rootClassName)}
      role="dialog"
      aria-modal="true"
      aria-label={content.ariaLabel}
      onClick={onClose}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
    >
      <div ref={backdropRef} className="animated-modal-backdrop" aria-hidden="true" />
      <div
        ref={panelRef}
        className={cn("image-preview-panel animated-modal-panel", content.panelClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        {content.children}
      </div>
    </div>
  );

  return portal ? createPortal(modal, document.body) : modal;
}
