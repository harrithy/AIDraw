export type DragState = {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
};

export type CardDragState = {
  jobId: string;
  startX: number;
  startY: number;
  posX: number;
  posY: number;
};

export type ThinkingValue = "high" | "medium" | "low";
