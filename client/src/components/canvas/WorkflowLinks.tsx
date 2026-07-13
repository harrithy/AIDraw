import { memo } from "react";
import { getConnectionPath, type PositionedJob } from "../../lib/canvas";

/**
 * 工作流连接线组件（SVG 图层）
 * 在任务卡片之间绘制带箭头的贝塞尔连接线，表示工作流的执行顺序
 * 少于 2 张卡片时不渲染（没有连线必要）
 * 纯 SVG 方案比 Canvas 2D 更省资源，且能用 CSS 控制样式
 * @param positionedJobs - 已定位的任务卡片列表
 */
export const WorkflowLinks = memo(function WorkflowLinks({
  positionedJobs
}: {
  positionedJobs: PositionedJob[];
}) {
  if (positionedJobs.length < 2) return null;

  return (
    <svg className="workflow-links" aria-hidden="true" focusable="false">
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
      {positionedJobs.slice(0, -1).map((item, index) => {
        const next = positionedJobs[index + 1];
        return (
          <path
            key={`${item.job.id}-${next.job.id}`}
            className="workflow-link"
            data-link-index={index}
            data-from-job-id={item.job.id}
            data-to-job-id={next.job.id}
            d={getConnectionPath(item, next)}
            markerEnd="url(#workflow-arrow)"
          />
        );
      })}
    </svg>
  );
});
