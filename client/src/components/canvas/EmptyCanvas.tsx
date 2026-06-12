import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Loader2, WandSparkles } from "lucide-react";
import { useRef } from "react";
import { prefersReducedMotion } from "../../lib/motion";

export function EmptyCanvas({ isLoading }: { isLoading: boolean }) {
  const emptyRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const emptyCanvas = emptyRef.current;
      if (!emptyCanvas) return;

      const icon = emptyCanvas.querySelector<HTMLElement>(".empty-canvas-icon");

      gsap.fromTo(
        emptyCanvas,
        { y: 12, scale: 0.985, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.36, ease: "power3.out", clearProps: "transform,visibility" }
      );
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
