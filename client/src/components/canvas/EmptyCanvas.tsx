import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowRight, ImagePlus, Loader2, Shapes, Sparkles } from "lucide-react";
import { useRef } from "react";

type EmptyCanvasProps = {
  isLoading: boolean;
  hasFolder: boolean;
  onStart: () => void;
};

/** 空画布提供明确的下一步，装饰图形不参与无障碍阅读。 */
export function EmptyCanvas({ isLoading, hasFolder, onStart }: EmptyCanvasProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (isLoading) return;
    const media = gsap.matchMedia();
    // 只动画内部纸张和文字，保留空画布自身的居中定位变换。
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const timeline = gsap.timeline({ defaults: { duration: 0.65, ease: "power3.out", clearProps: "transform,opacity,visibility" } });
      timeline
        .from(".empty-art-back", { y: 26, rotation: 26, autoAlpha: 0 }, 0)
        .from(".empty-art-front", { y: 32, rotation: -20, scale: 0.86, autoAlpha: 0 }, 0.08)
        .from(".empty-art-spark", { y: 12, rotation: -15, scale: 0.5, autoAlpha: 0, ease: "back.out(1.6)" }, 0.22)
        .from(".empty-eyebrow, h2, p, .empty-start", { y: 18, autoAlpha: 0, stagger: 0.07, duration: 0.5 }, 0.16)
        .from(".empty-capabilities > span", { y: 10, autoAlpha: 0, stagger: 0.06, duration: 0.4 }, 0.42);
    }, contentRef);
    return () => media.revert();
  }, { dependencies: [isLoading], scope: contentRef, revertOnUpdate: true });

  return (
    <div ref={contentRef} className="empty-canvas">
      <div className="empty-art" aria-hidden="true">
        <div className="empty-art-back" />
        <div className="empty-art-front">
          <span className="art-sun" />
          <span className="art-hill art-hill-back" />
          <span className="art-hill art-hill-front" />
        </div>
        <div className="empty-art-spark">
          {isLoading ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} strokeWidth={1.5} />}
        </div>
      </div>
      <span className="empty-eyebrow">想象，从这里开始</span>
      <h2>{isLoading ? "正在准备你的画布" : "让灵感，慢慢成形。"}</h2>
      <p>{hasFolder
        ? "写下一段描述，或放入一张参考图。\n把脑海里的画面，变成眼前的作品。"
        : "一个想法，一片自由的画布。\n创建你的第一个文件夹，开启创作。"}</p>
      {!isLoading ? (
        <button type="button" className="empty-start" onClick={onStart}>
          {hasFolder ? "开始创作" : "创建第一个文件夹"}<ArrowRight size={16} />
        </button>
      ) : null}
      <div className="empty-capabilities">
        <span><Sparkles size={14} />文字生图</span>
        <span><ImagePlus size={14} />图片参考</span>
        <span><Shapes size={14} />多模态创作</span>
      </div>
    </div>
  );
}
