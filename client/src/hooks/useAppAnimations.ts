import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { RefObject, useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";
import type { DrawJob } from "../types";

type UseAppAnimationsParams = {
  appRef: RefObject<HTMLElement | null>;
  jobs: DrawJob[];
  jobAnimationKey: string;
  leftOpen: boolean;
  notice: string;
};

export function useAppAnimations({
  appRef,
  jobs,
  jobAnimationKey,
  leftOpen,
  notice
}: UseAppAnimationsParams) {
  const animatedJobIdsRef = useRef<Set<string>>(new Set());
  const animatedJobStatusRef = useRef<Map<string, DrawJob["status"]>>(new Map());
  const panelToggleStateRef = useRef({ hasMounted: false, leftOpen });

  useEffect(() => {
    const shell = appRef.current;
    if (!shell) return;

    const panels = Array.from(shell.querySelectorAll<HTMLElement>(".left-panel"));
    if (panels.length === 0) return;

    gsap.killTweensOf(panels);
    gsap.set(panels, { clearProps: "transform,opacity,visibility" });
  }, [appRef, leftOpen]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const timeline = gsap.timeline({
        defaults: { duration: 0.56, ease: "power3.out" }
      });
      const animateIn = (selector: string, vars: gsap.TweenVars, position?: gsap.Position) => {
        const targets = gsap.utils.toArray<HTMLElement>(selector);
        if (targets.length > 0) {
          timeline.from(targets, vars, position);
        }
      };

      animateIn(".canvas-stage", { autoAlpha: 0, duration: 0.36, ease: "power1.out", clearProps: "opacity,visibility" });
      animateIn(".left-panel.open > *", { y: 10, autoAlpha: 0, stagger: 0.04, clearProps: "transform,opacity,visibility" }, "<0.08");
      animateIn(".floating-toolbar", { y: -12, autoAlpha: 0, clearProps: "transform,opacity,visibility" }, "<0.08");
      animateIn(".dock-toggle", { scale: 0.86, autoAlpha: 0, stagger: 0.05, clearProps: "transform,opacity,visibility" }, "<0.05");
      animateIn(".metric", { y: -10, autoAlpha: 0, stagger: 0.06, clearProps: "transform,opacity,visibility" }, "<0.04");
    },
    { scope: appRef }
  );

  useGSAP(
    () => {
      const previous = panelToggleStateRef.current;
      const openedLeft = previous.hasMounted && leftOpen && !previous.leftOpen;
      panelToggleStateRef.current = { hasMounted: true, leftOpen };

      if (prefersReducedMotion()) return;

      const animatePanelChildren = (selector: string, x: number) => {
        const targets = gsap.utils.toArray<HTMLElement>(selector);
        if (targets.length === 0) return;

        gsap.fromTo(
          targets,
          { x, autoAlpha: 0 },
          {
            x: 0,
            autoAlpha: 1,
            duration: 0.32,
            ease: "power3.out",
            stagger: 0.035,
            clearProps: "transform,visibility"
          }
        );
      };

      if (openedLeft) animatePanelChildren(".left-panel.open > *", -12);
    },
    { dependencies: [leftOpen], scope: appRef }
  );

  useGSAP(
    () => {
      const shell = appRef.current;
      if (!shell) return;

      const knownJobIds = animatedJobIdsRef.current;
      const knownStatuses = animatedJobStatusRef.current;
      const nextJobIds = new Set(jobs.map((job) => job.id));
      const cardElements = Array.from(shell.querySelectorAll<HTMLElement>(".job-card"));
      const cardByJobId = new Map(cardElements.map((card) => [card.dataset.jobId, card]));
      const enteringCards: HTMLElement[] = [];
      const changedCards: HTMLElement[] = [];

      jobs.forEach((job) => {
        const card = cardByJobId.get(job.id);
        if (!card) return;

        if (!knownJobIds.has(job.id)) {
          enteringCards.push(card);
        } else if (knownStatuses.get(job.id) !== job.status) {
          changedCards.push(card);
        }

        knownJobIds.add(job.id);
        knownStatuses.set(job.id, job.status);
      });

      for (const jobId of Array.from(knownJobIds)) {
        if (!nextJobIds.has(jobId)) {
          knownJobIds.delete(jobId);
          knownStatuses.delete(jobId);
        }
      }

      if (prefersReducedMotion()) return;

      if (enteringCards.length > 0) {
        gsap.fromTo(
          enteringCards,
          { y: 24, scale: 0.97, autoAlpha: 0 },
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.5,
            ease: "back.out(1.45)",
            stagger: 0.07,
            clearProps: "transform,visibility"
          }
        );
      }

      if (changedCards.length > 0) {
        const changedImages = changedCards
          .map((card) => card.querySelector<HTMLElement>(".job-image"))
          .filter((element): element is HTMLElement => Boolean(element));

        gsap.fromTo(
          changedCards,
          { borderColor: "rgba(47, 118, 96, 0.52)" },
          {
            borderColor: "var(--line)",
            duration: 0.7,
            ease: "power2.out",
            clearProps: "borderColor"
          }
        );

        gsap.fromTo(
          changedImages,
          { scale: 0.985, filter: "brightness(1.12)" },
          {
            scale: 1,
            filter: "brightness(1)",
            duration: 0.7,
            ease: "power2.out",
            clearProps: "transform,filter"
          }
        );
      }
    },
    { dependencies: [jobAnimationKey], scope: appRef }
  );

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const noticeLines = gsap.utils.toArray<HTMLElement>(".notice-line");
      if (noticeLines.length === 0) return;

      gsap.fromTo(noticeLines, { y: 6, autoAlpha: 0.72 }, { y: 0, autoAlpha: 1, duration: 0.26, ease: "power2.out", clearProps: "transform,visibility" });
    },
    { dependencies: [notice], scope: appRef }
  );
}
