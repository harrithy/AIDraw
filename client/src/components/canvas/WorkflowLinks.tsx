import { memo } from "react";
import type { CanvasBounds, CanvasLink } from "../../lib/canvasVisibility";

/**
 * 工作流连接线组件（SVG 图层）
 * 在任务卡片之间绘制带箭头的贝塞尔连接线，表示工作流的执行顺序
 * 只绘制与缓冲视口相交的原始连线，并将 SVG 图层限制在缓冲视口内。
 * @param links - 保留原始索引和相邻关系的可见连线
 * @param bounds - 未缩放的画布坐标范围
 */
export const WorkflowLinks = memo(function WorkflowLinks({
  links,
  bounds
}: {
  links: CanvasLink[];
  bounds: CanvasBounds;
}) {
  if (!links.length) return null;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;

  return (
    <svg
      className="workflow-links"
      aria-hidden="true"
      focusable="false"
      style={{ left: bounds.left, top: bounds.top, width, height }}
      viewBox={`${bounds.left} ${bounds.top} ${width} ${height}`}
    >
      <defs>
        {/* 箭头标记定义——画在所有连线末端 */}
        <marker
          id="workflow-arrow"
          markerWidth="13"
          markerHeight="13"
          refX="11"
          refY="6.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 1 1 L 12 6.5 L 1 12 z" />
        </marker>
      </defs>
      {/* 相邻卡片两两连线 */}
      {links.map(({ from, to, index, path }) => {
        return (
          <path
            key={`${from.job.id}-${to.job.id}`}
            className="workflow-link"
            data-link-index={index}
            data-from-job-id={from.job.id}
            data-to-job-id={to.job.id}
            d={path}
            markerEnd="url(#workflow-arrow)"
          />
        );
      })}
    </svg>
  );
});
