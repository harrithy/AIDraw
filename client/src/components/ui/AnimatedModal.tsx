import { type PointerEventHandler, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalTransition } from "../../hooks/useModalTransition";
import { cn } from "../../lib/utils";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

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
  const onCloseRef = useRef(onClose);
  const restoreFocusFrameRef = useRef<number | null>(null);
  const preservedContentRef = useRef<PreservedModalContent>({
    ariaLabel,
    children,
    rootClassName,
    panelClassName
  });

  if (open) {
    preservedContentRef.current = { ariaLabel, children, rootClassName, panelClassName };
  }
  onCloseRef.current = onClose;

  const isPresent = useModalTransition({
    open,
    scopeRef: rootRef,
    backdropRef,
    panelRef
  });

  useEffect(() => {
    if (!open) return;
    if (restoreFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreFocusFrameRef.current);
      restoreFocusFrameRef.current = null;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const getFocusableElements = () => {
      const panel = panelRef.current;
      if (!panel) return [];
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => {
          const style = window.getComputedStyle(element);
          return element.getAttribute("aria-hidden") !== "true" && style.display !== "none" && style.visibility !== "hidden";
        }
      );
    };
    const focusFrame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>("[data-autofocus]");
      const firstFocusable = getFocusableElements()[0];
      (preferred || firstFocusable || panel).focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !panel.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) {
        restoreFocusFrameRef.current = window.requestAnimationFrame(() => {
          restoreFocusFrameRef.current = null;
          previouslyFocused.focus({ preventScroll: true });
        });
      }
    };
  }, [open]);

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
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {content.children}
      </div>
    </div>
  );

  return portal ? createPortal(modal, document.body) : modal;
}
