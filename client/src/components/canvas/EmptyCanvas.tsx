import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Loader2, WandSparkles } from "lucide-react";
import { useRef } from "react";
import { prefersReducedMotion } from "../../lib/motion";

/**
 * 空画布占位组件
 * 当文件夹中没有任务时展示，引导用户开始创建
 * 加载中显示旋转图标，空闲时显示魔法棒图标并上下浮动
 * @param isLoading - 是否正在加载数据
 */
export function EmptyCanvas({ isLoading }: { isLoading: boolean }) {
  const emptyRef = useRef<HTMLDivElement | null>(null);

  // 空画布入场动画 + 图标浮动
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const emptyCanvas = emptyRef.current;
      if (!emptyCanvas) return;

      const icon = emptyCanvas.querySelector<HTMLElement>(".empty-canvas-icon");

      // 画布淡入 + 微弹效果
      gsap.fromTo(
        emptyCanvas,
        { y: 12, scale: 0.985, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.36, ease: "power3.out", clearProps: "transform,visibility" }
      );
      // 图标持续上下浮动（sine 缓动，无限循环往复）
      if (icon) {
        gsap.to(icon, {
          y: -5,
          duration: 1.35,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true
        });
      }
    },
    { dependencies: [isLoading], scope: emptyRef }
  );

  return (
    <div ref={emptyRef} className="empty-canvas">
      <div className="empty-canvas-icon">
        {isLoading ? <Loader2 className="spin" size={28} /> : <WandSparkles size={30} />}
      </div>
      <h2>{isLoading ? "正在加载画布" : "画布还没有图片"}</h2>
      <p>在底部输入提示词开始绘制，也可以直接粘贴图片作为参考。</p>
    </div>
  );
}
