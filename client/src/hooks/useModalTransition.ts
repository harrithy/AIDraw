import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";

/** 模态框入场动画时长（秒） */
export const MODAL_ENTER_DURATION = 0.28;
/** 模态框退场动画时长（秒） */
export const MODAL_EXIT_DURATION = 0.2;

/**
 * 模态框动画 Hook 的参数
 */
type UseModalTransitionParams = {
  /** 模态框是否应该打开 */
  open: boolean;
  /** 模态框根元素的 ref（作为 GSAP scope） */
  scopeRef: RefObject<HTMLElement | null>;
  /** 背景遮罩元素的 ref */
  backdropRef: RefObject<HTMLElement | null>;
  /** 面板元素的 ref */
  panelRef: RefObject<HTMLElement | null>;
};

/**
 * 模态框入场/退场动画 Hook
 *
 * 处理弹出层的生命周期动画：
 * - 入场：遮罩淡入 + 面板从下方弹入（y: 10 -> 0, scale: 0.985 -> 1）
 * - 退场：面板收缩淡出 + 遮罩淡出 -> 动画完成后卸载 DOM
 * - `isPresent`：在退场动画播放期间保持 DOM 存在，动画结束后才卸载
 *
 * @param params - 动画参数
 * @returns `isPresent` — 模态框 DOM 是否应该仍然存在（退场动画期间为 true）
 */
export function useModalTransition({
  open,
  scopeRef,
  backdropRef,
  panelRef
}: UseModalTransitionParams) {
  /** 模态框 DOM 是否应该存在（退场动画完成前保持 true） */
  const [isPresent, setIsPresent] = useState(open);
  /** 当前动画的时间线引用（用于打断旧动画） */
  const animationRef = useRef<gsap.core.Timeline | null>(null);
  /** 是否已经播放过入场动画 */
  const hasEnteredRef = useRef(false);

  // open 变 true 时立即挂载 DOM，不等动画
  useLayoutEffect(() => {
    if (open) setIsPresent(true);
  }, [open]);

  useGSAP(
    () => {
      /** 清理函数：杀掉旧动画并重置状态 */
      const cleanup = () => {
        animationRef.current?.kill();
        animationRef.current = null;
        hasEnteredRef.current = false;
      };

      // 每次重跑前先清理旧动画，防止动画冲突
      animationRef.current?.kill();
      animationRef.current = null;

      if (!isPresent) return cleanup;

      const backdrop = backdropRef.current;
      const panel = panelRef.current;
      if (!backdrop || !panel) return cleanup;

      // 无障碍：用户偏好减少动画时直接切换状态
      if (prefersReducedMotion()) {
        gsap.set(backdrop, { autoAlpha: open ? 1 : 0 });
        gsap.set(panel, { autoAlpha: open ? 1 : 0, y: 0, scale: 1 });
        hasEnteredRef.current = open;
        if (!open) setIsPresent(false);
        return cleanup;
      }

      // ─── 入场动画 ───
      if (open) {
        // 首次入场：先 set 初始状态，再动画到目标
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

      // ─── 退场动画 ───
      const timeline = gsap.timeline({
        onComplete: () => {
          if (animationRef.current !== timeline) return;
          animationRef.current = null;
          hasEnteredRef.current = false;
          // 动画完成后才卸载 DOM，确保退场动画完整播放
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
