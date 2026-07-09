import type { DrawJob } from "../types";

export const CARD_WIDTH = 316;
export const CARD_HEIGHT = 356;
export const CARD_GAP_Y = 96;
export const DEFAULT_CARD_X = 318;
export const DEFAULT_CARD_Y = 150;
export const BOARD_PADDING = 240;

const CARD_HORIZONTAL_PADDING = 24;
const CARD_VERTICAL_CHROME = 64;
const CARD_MIN_WIDTH = 236;
const LANDSCAPE_IMAGE_WIDTH = 320;
const SQUARE_IMAGE_SIZE = 292;
const PORTRAIT_IMAGE_HEIGHT = 376;
const MIN_IMAGE_WIDTH = 196;
const MIN_IMAGE_HEIGHT = 158;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getJobRatio = (job: Pick<DrawJob, "width" | "height">) => {
  if (Number.isFinite(job.width) && Number.isFinite(job.height) && job.width > 0 && job.height > 0) {
    return clamp(job.width / job.height, 0.25, 4);
  }

  return 1;
};

export type JobCardSize = {
  cardWidth: number;
  cardHeight: number;
  imageWidth: number;
  imageHeight: number;
  ratio: number;
};

export const getJobCardSize = (job: Pick<DrawJob, "width" | "height">): JobCardSize => {
  const ratio = getJobRatio(job);
  let imageWidth = SQUARE_IMAGE_SIZE;
  let imageHeight = SQUARE_IMAGE_SIZE;

  if (ratio > 1.05) {
    imageWidth = LANDSCAPE_IMAGE_WIDTH;
    imageHeight = imageWidth / ratio;
    if (imageHeight < MIN_IMAGE_HEIGHT) {
      imageHeight = MIN_IMAGE_HEIGHT;
      imageWidth = imageHeight * ratio;
    }
  } else if (ratio < 0.95) {
    imageHeight = PORTRAIT_IMAGE_HEIGHT;
    imageWidth = imageHeight * ratio;
    if (imageWidth < MIN_IMAGE_WIDTH) {
      imageWidth = MIN_IMAGE_WIDTH;
      imageHeight = imageWidth / ratio;
    }
  }

  const roundedImageWidth = Math.round(imageWidth);
  const roundedImageHeight = Math.round(imageHeight);

  return {
    cardWidth: Math.round(Math.max(CARD_MIN_WIDTH, roundedImageWidth + CARD_HORIZONTAL_PADDING)),
    cardHeight: Math.round(roundedImageHeight + CARD_VERTICAL_CHROME),
    imageWidth: roundedImageWidth,
    imageHeight: roundedImageHeight,
    ratio
  };
};

export type PositionedJob = {
  job: DrawJob;
  index: number;
  x: number;
  y: number;
  cardSize: JobCardSize;
};

export const getDefaultCardPosition = (index: number, jobs: DrawJob[] = []) => {
  const yOffset = jobs.slice(0, index).reduce((offset, job) => offset + getJobCardSize(job).cardHeight + CARD_GAP_Y, 0);

  return {
    x: DEFAULT_CARD_X,
    y: DEFAULT_CARD_Y + yOffset
  };
};

export const getConnectionPath = (from: PositionedJob, to: PositionedJob) => {
  const fromSize = from.cardSize;
  const toSize = to.cardSize;
  const fromCenter = {
    x: from.x + fromSize.cardWidth / 2,
    y: from.y + fromSize.cardHeight / 2
  };
  const toCenter = {
    x: to.x + toSize.cardWidth / 2,
    y: to.y + toSize.cardHeight / 2
  };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    const towardRight = dx >= 0;
    const start = {
      x: from.x + (towardRight ? fromSize.cardWidth : 0),
      y: fromCenter.y
    };
    const end = {
      x: to.x + (towardRight ? 0 : toSize.cardWidth),
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
    y: from.y + (towardBottom ? fromSize.cardHeight : 0)
  };
  const end = {
    x: toCenter.x,
    y: to.y + (towardBottom ? 0 : toSize.cardHeight)
  };
  const distance = Math.abs(end.y - start.y);
  const handle = Math.min(Math.max(32, distance * 0.46), Math.max(1, distance / 2));
  const startHandleY = start.y + (towardBottom ? handle : -handle);
  const endHandleY = end.y - (towardBottom ? handle : -handle);
  return `M ${start.x} ${start.y} C ${start.x} ${startHandleY}, ${end.x} ${endHandleY}, ${end.x} ${end.y}`;
};
