import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";

export const MODAL_ENTER_DURATION = 0.28;
export const MODAL_EXIT_DURATION = 0.2;

type UseModalTransitionParams = {
  open: boolean;
  scopeRef: RefObject<HTMLElement | null>;
  backdropRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
};

export function useModalTransition({
  open,
  scopeRef,
  backdropRef,
  panelRef
}: UseModalTransitionParams) {
  const [isPresent, setIsPresent] = useState(open);
  const animationRef = useRef<gsap.core.Timeline | null>(null);
  const hasEnteredRef = useRef(false);

  useLayoutEffect(() => {
    if (open) setIsPresent(true);
  }, [open]);

  useGSAP(
    () => {
      const cleanup = () => {
        animationRef.current?.kill();
        animationRef.current = null;
        hasEnteredRef.current = false;
      };

      animationRef.current?.kill();
      animationRef.current = null;

      if (!isPresent) return cleanup;

      const backdrop = backdropRef.current;
      const panel = panelRef.current;
      if (!backdrop || !panel) return cleanup;

      if (prefersReducedMotion()) {
        gsap.set(backdrop, { autoAlpha: open ? 1 : 0 });
        gsap.set(panel, { autoAlpha: open ? 1 : 0, y: 0, scale: 1 });
        hasEnteredRef.current = open;
        if (!open) setIsPresent(false);
        return cleanup;
      }

      if (open) {
        if (!hasEnteredRef.current) {
          gsap.set(backdrop, { autoAlpha: 0 });
          gsap.set(panel, { autoAlpha: 0, y: 10, scale: 0.985 });
        }

        hasEnteredRef.current = true;
        const timeline = gsap.timeline({
          onComplete: () => {
            if (animationRef.current === timeline) animationRef.current = null;
          }
        });
        timeline
          .to(backdrop, { autoAlpha: 1, duration: 0.2, ease: "power1.out", overwrite: "auto" }, 0)
          .to(panel, { autoAlpha: 1, y: 0, scale: 1, duration: MODAL_ENTER_DURATION, ease: "power2.out", overwrite: "auto" }, 0);
        animationRef.current = timeline;
        return cleanup;
      }

      const timeline = gsap.timeline({
        onComplete: () => {
          if (animationRef.current !== timeline) return;
          animationRef.current = null;
          hasEnteredRef.current = false;
          setIsPresent(false);
        }
      });
      timeline
        .to(panel, { autoAlpha: 0, y: 8, scale: 0.99, duration: MODAL_EXIT_DURATION, ease: "power1.in", overwrite: "auto" }, 0)
        .to(backdrop, { autoAlpha: 0, duration: MODAL_EXIT_DURATION, ease: "power1.in", overwrite: "auto" }, 0);
      animationRef.current = timeline;
      return cleanup;
    },
    { dependencies: [isPresent, open], scope: scopeRef }
  );

  return isPresent;
}
