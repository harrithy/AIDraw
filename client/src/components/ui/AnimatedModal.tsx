import { type PointerEventHandler, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalTransition } from "../../hooks/useModalTransition";
import { cn } from "../../lib/utils";

type AnimatedModalProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  rootClassName?: string;
  panelClassName?: string;
  portal?: boolean;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
};

type PreservedModalContent = Pick<
  AnimatedModalProps,
  "ariaLabel" | "children" | "rootClassName" | "panelClassName"
>;

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
