import type { DrawJob } from "../types";

export const CARD_WIDTH = 280;
export const CARD_HEIGHT = 356;
export const CARD_GAP_Y = 96;
export const DEFAULT_CARD_X = 318;
export const DEFAULT_CARD_Y = 150;
export const BOARD_PADDING = 240;

export type PositionedJob = {
  job: DrawJob;
  index: number;
  x: number;
  y: number;
};

export const getDefaultCardPosition = (index: number) => ({
  x: DEFAULT_CARD_X,
  y: DEFAULT_CARD_Y + index * (CARD_HEIGHT + CARD_GAP_Y)
});

export const getConnectionPath = (from: PositionedJob, to: PositionedJob) => {
  const fromCenter = {
    x: from.x + CARD_WIDTH / 2,
    y: from.y + CARD_HEIGHT / 2
  };
  const toCenter = {
    x: to.x + CARD_WIDTH / 2,
    y: to.y + CARD_HEIGHT / 2
  };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    const towardRight = dx >= 0;
    const start = {
      x: from.x + (towardRight ? CARD_WIDTH : 0),
      y: fromCenter.y
    };
    const end = {
      x: to.x + (towardRight ? 0 : CARD_WIDTH),
      y: toCenter.y
    };
    const distance = Math.abs(end.x - start.x);
    const handle = Math.min(Math.max(32, distance * 0.46), Math.max(1, distance / 2));
    const startHandleX = start.x + (towardRight ? handle : -handle);
    const endHandleX = end.x - (towardRight ? handle : -handle);
    return `M ${start.x} ${start.y} C ${startHandleX} ${start.y}, ${endHandleX} ${end.y}, ${end.x} ${end.y}`;
  }

  const towardBottom = dy >= 0;
  const start = {
    x: fromCenter.x,
    y: from.y + (towardBottom ? CARD_HEIGHT : 0)
  };
  const end = {
    x: toCenter.x,
    y: to.y + (towardBottom ? 0 : CARD_HEIGHT)
  };
  const distance = Math.abs(end.y - start.y);
  const handle = Math.min(Math.max(32, distance * 0.46), Math.max(1, distance / 2));
  const startHandleY = start.y + (towardBottom ? handle : -handle);
  const endHandleY = end.y - (towardBottom ? handle : -handle);
  return `M ${start.x} ${start.y} C ${start.x} ${startHandleY}, ${end.x} ${endHandleY}, ${end.x} ${end.y}`;
};
