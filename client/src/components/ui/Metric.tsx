import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { prefersReducedMotion } from "../../lib/motion";

/** Metric 组件的 Props 类型 */
type MetricProps = {
  label: string;
  value: string;
};

/**
 * 数值指标展示组件。
 * 数值变化时触发 GSAP 缩放弹跳动画，提升数据更新的视觉反馈。
 */
export function Metric({ label, value }: MetricProps) {
  const metricRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedRef = useRef(false);

  useGSAP(
    () => {
      if (!hasAnimatedRef.current) {
        hasAnimatedRef.current = true;
        return;
      }
      if (prefersReducedMotion()) return;
      const metric = metricRef.current;
      if (!metric) return;

      const valueTarget = metric.querySelector<HTMLElement>(".metric-value");

      gsap.fromTo(
        metric,
        { y: -3, scale: 1.025 },
        {
          y: 0,
          scale: 1,
          duration: 0.24,
          ease: "power2.out",
          clearProps: "transform",
        },
      );
      if (valueTarget) {
        gsap.fromTo(
          valueTarget,
          { color: "var(--green-dark)" },
          {
            color: "var(--ink)",
            duration: 0.38,
            ease: "power1.out",
            clearProps: "color",
          },
        );
      }
    },
    { dependencies: [value], scope: metricRef },
  );

  return (
    <div ref={metricRef} className="metric">
      <strong className="metric-value">{value}</strong>
      <span>{label}</span>
    </div>
  );
}
