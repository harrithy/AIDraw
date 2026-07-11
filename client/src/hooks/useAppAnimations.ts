import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { RefObject, useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";
import type { DrawJob } from "../types";

/**
 * 应用全局动画 Hook 的参数
 */
type UseAppAnimationsParams = {
  /** 应用根元素的 ref */
  appRef: RefObject<HTMLElement | null>;
  /** 当前任务列表 */
  jobs: DrawJob[];
  /** 任务动画依赖 key——当任务状态/图片变化时触发动画 */
  jobAnimationKey: string;
  /** 左侧面板是否打开 */
  leftOpen: boolean;
  /** 当前通知消息文本 */
  notice: string;
};

/**
 * 应用全局入场和状态变化动画
 *
 * 管理四类动画：
 * 1. 首次加载入场 — 画布、工具栏、指标等元素淡入
 * 2. 面板展开 — 面板子元素滑入动画
 * 3. 任务状态变化 — 新卡片弹入 + 已完成卡片闪烁提示
 * 4. 通知消息 — 通知行淡入
 *
 * 每个 useGSAP 独立管理生命周期，互不干扰
 *
 * @param params - 动画参数
 */
export function useAppAnimations({
  appRef,
  jobs,
  jobAnimationKey,
  leftOpen,
  notice
}: UseAppAnimationsParams) {
  // 追踪已动画过的任务 ID，避免重复播放入场动画
  const animatedJobIdsRef = useRef<Set<string>>(new Set());
  // 追踪任务状态变化——状态变了才触发状态切换动画
  const animatedJobStatusRef = useRef<Map<string, DrawJob["status"]>>(new Map());
  // 面板开关状态——用于判断是"打开"还是"首次挂载"
  const panelToggleStateRef = useRef({ hasMounted: false, leftOpen });

  // 面板切换时，清除之前可能残留的 GSAP tweens
  useEffect(() => {
    const shell = appRef.current;
    if (!shell) return;

    const panels = Array.from(shell.querySelectorAll<HTMLElement>(".left-panel"));
    if (panels.length === 0) return;

    gsap.killTweensOf(panels);
    gsap.set(panels, { clearProps: "transform,opacity,visibility" });
  }, [appRef, leftOpen]);

  // ─── 首次加载入场动画 ───
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const timeline = gsap.timeline({
        defaults: { duration: 0.56, ease: "power3.out" }
      });
      /** 辅助函数：选择器匹配到的元素逐一入场，无匹配时跳过 */
      const animateIn = (selector: string, vars: gsap.TweenVars, position?: gsap.Position) => {
        const targets = gsap.utils.toArray<HTMLElement>(selector);
        if (targets.length > 0) {
          timeline.from(targets, vars, position);
        }
      };

      // 按视觉层级顺序入场：画布 → 面板 → 工具栏 → 按钮 → 指标
      animateIn(".canvas-stage", { autoAlpha: 0, duration: 0.36, ease: "power1.out", clearProps: "opacity,visibility" });
      animateIn(".left-panel.open > *", { y: 10, autoAlpha: 0, stagger: 0.04, clearProps: "transform,opacity,visibility" }, "<0.08");
      animateIn(".floating-toolbar", { y: -12, autoAlpha: 0, clearProps: "transform,opacity,visibility" }, "<0.08");
      animateIn(".dock-toggle", { scale: 0.86, autoAlpha: 0, stagger: 0.05, clearProps: "transform,opacity,visibility" }, "<0.05");
      animateIn(".metric", { y: -10, autoAlpha: 0, stagger: 0.06, clearProps: "transform,opacity,visibility" }, "<0.04");
    },
    { scope: appRef }
  );

  // ─── 面板展开动画 ───
  useGSAP(
    () => {
      const previous = panelToggleStateRef.current;
      // 只有"已挂载过 + 从关闭到打开"才播放滑入动画，首次渲染不算
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

  // ─── 任务卡片状态变化动画 ───
  useGSAP(
    () => {
      const shell = appRef.current;
      if (!shell) return;

      const knownJobIds = animatedJobIdsRef.current;
      const knownStatuses = animatedJobStatusRef.current;
      const nextJobIds = new Set(jobs.map((job) => job.id));
      const cardElements = Array.from(shell.querySelectorAll<HTMLElement>(".job-card"));
      const cardByJobId = new Map(cardElements.map((card) => [card.dataset.jobId, card]));

      // 分类：新卡片 vs 状态变化卡片
      const enteringCards: HTMLElement[] = [];
      const changedCards: HTMLElement[] = [];

      jobs.forEach((job) => {
        const card = cardByJobId.get(job.id);
        if (!card) return;

        if (!knownJobIds.has(job.id)) {
          enteringCards.push(card);            // 新出现的卡片
        } else if (knownStatuses.get(job.id) !== job.status) {
          changedCards.push(card);             // 状态变化（如 running → completed）
        }

        knownJobIds.add(job.id);
        knownStatuses.set(job.id, job.status);
      });

      // 清理已删除的任务追踪
      for (const jobId of Array.from(knownJobIds)) {
        if (!nextJobIds.has(jobId)) {
          knownJobIds.delete(jobId);
          knownStatuses.delete(jobId);
        }
      }

      if (prefersReducedMotion()) return;

      // 新卡片：弹入动画（back.out 弹性曲线）
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

      // 状态变化卡片：短暂的高亮闪烁（绿色边框 + 亮度提升）
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

  // ─── 通知消息淡入动画 ───
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
