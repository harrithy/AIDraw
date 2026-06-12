import { getConnectionPath, type PositionedJob } from "../../lib/canvas";

export function WorkflowLinks({ positionedJobs }: { positionedJobs: PositionedJob[] }) {
  if (positionedJobs.length < 2) return null;

  return (
    <svg className="workflow-links" aria-hidden="true" focusable="false">
      <defs>
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
      {positionedJobs.slice(0, -1).map((item, index) => {
        const next = positionedJobs[index + 1];
        return (
          <path
            key={`${item.job.id}-${next.job.id}`}
            className="workflow-link"
            d={getConnectionPath(item, next)}
            markerEnd="url(#workflow-arrow)"
          />
        );
      })}
    </svg>
  );
}
