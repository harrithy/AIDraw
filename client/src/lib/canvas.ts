import type { DrawJob } from "../types";

/** 卡片标准宽度（px） */
export const CARD_WIDTH = 316;
/** 卡片标准高度（px） */
export const CARD_HEIGHT = 356;
/** 卡片之间的横向间距（px） */
export const CARD_GAP_X = 96;
/** 新建卡片默认 X 坐标 */
export const DEFAULT_CARD_X = 318;
/** 新建卡片默认 Y 坐标 */
export const DEFAULT_CARD_Y = 150;
/** 画布内边距（防止卡片贴边） */
export const BOARD_PADDING = 240;

/** 卡片横向占位：左右各 12px 内边距 + 左右各 1px 边框 */
const CARD_HORIZONTAL_CHROME = 26;
/** 卡片非图片区域的固定高度（标题栏 + 状态栏等 chrome） */
const CARD_VERTICAL_CHROME = 64;
/** 卡片最小宽度（防止太窄） */
const CARD_MIN_WIDTH = 236;
/** 横版图片的标准展示宽度 */
const LANDSCAPE_IMAGE_WIDTH = 320;
/** 方形图片的标准展示尺寸 */
const SQUARE_IMAGE_SIZE = 292;
/** 竖版图片的标准展示高度 */
const PORTRAIT_IMAGE_HEIGHT = 376;
/** 图片最小展示宽度 */
const MIN_IMAGE_WIDTH = 196;
/** 图片最小展示高度 */
const MIN_IMAGE_HEIGHT = 158;

/**
 * 限制值在 [min, max] 区间内
 * @param value - 原始值
 * @param min - 下限
 * @param max - 上限
 */
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * 计算任务的宽高比
 * 无有效尺寸时默认返回 1（正方形），并限制在 0.25 ~ 4 之间防止极端比例
 * @param job - 带有 width/height 的任务对象
 * @returns 约束后的宽高比
 */
const getJobRatio = (job: Pick<DrawJob, "width" | "height">) => {
  if (Number.isFinite(job.width) && Number.isFinite(job.height) && job.width > 0 && job.height > 0) {
    return clamp(job.width / job.height, 0.25, 4);
  }

  return 1;
};

/**
 * 🃏 任务卡片尺寸信息
 * 根据图像的宽高比动态计算卡片和图片的展示尺寸
 */
export type JobCardSize = {
  /** 卡片总宽度（含内边距） */
  cardWidth: number;
  /** 卡片总高度（含标题栏等 chrome） */
  cardHeight: number;
  /** 图片展示宽度 */
  imageWidth: number;
  /** 图片展示高度 */
  imageHeight: number;
  /** 原始宽高比 */
  ratio: number;
};

/**
 * 根据任务的图像尺寸计算卡片布局
 * 横版图片 -> 宽度优先；竖版图片 -> 高度优先；方形 -> 固定尺寸
 * 通过限制最小宽高防止极端比例导致卡片变形
 * @param job - 带有 width/height 的任务对象
 * @returns 卡片和图片的尺寸信息
 */
export const getJobCardSize = (job: Pick<DrawJob, "width" | "height">): JobCardSize => {
  const ratio = getJobRatio(job);
  let imageWidth = SQUARE_IMAGE_SIZE;
  let imageHeight = SQUARE_IMAGE_SIZE;

  // 横版图片（ratio > 1.05）：宽度固定 320px，高度按比例缩小
  if (ratio > 1.05) {
    imageWidth = LANDSCAPE_IMAGE_WIDTH;
    imageHeight = imageWidth / ratio;
    // 保证最小高度，防止图片过扁
    if (imageHeight < MIN_IMAGE_HEIGHT) {
      imageHeight = MIN_IMAGE_HEIGHT;
      imageWidth = imageHeight * ratio;
    }
  }
  // 竖版图片（ratio < 0.95）：高度固定 376px，宽度按比例计算
  else if (ratio < 0.95) {
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
    cardWidth: Math.round(Math.max(CARD_MIN_WIDTH, roundedImageWidth + CARD_HORIZONTAL_CHROME)),
    cardHeight: Math.round(roundedImageHeight + CARD_VERTICAL_CHROME),
    imageWidth: roundedImageWidth,
    imageHeight: roundedImageHeight,
    ratio
  };
};

/**
 * 画布上已定位的任务卡片
 */
export type PositionedJob = {
  /** 原始任务数据 */
  job: DrawJob;
  /** 在任务列表中的索引 */
  index: number;
  /** 画布 X 坐标 */
  x: number;
  /** 画布 Y 坐标 */
  y: number;
  /** 计算出的卡片尺寸 */
  cardSize: JobCardSize;
};

export const getPositionedJobs = (jobs: DrawJob[]): PositionedJob[] => {
  let nextDefaultX = DEFAULT_CARD_X;
  let nextDefaultY = DEFAULT_CARD_Y;

  return jobs.map((job, index) => {
    const cardSize = getJobCardSize(job);
    const hasCustomPosition =
      job.hasCustomPosition && Number.isFinite(job.posX) && Number.isFinite(job.posY);
    const positionedJob: PositionedJob = {
      job,
      index,
      x: hasCustomPosition ? job.posX : nextDefaultX,
      y: hasCustomPosition ? job.posY : nextDefaultY,
      cardSize
    };

    nextDefaultX = positionedJob.x + cardSize.cardWidth + CARD_GAP_X;
    nextDefaultY = positionedJob.y;
    return positionedJob;
  });
};

/**
 * 计算新卡片的默认画布位置
 * 按列表顺序横向排列，每个卡片间距 CARD_GAP_X
 * @param index - 卡片在列表中的索引
 * @param jobs - 前置任务列表（用于累计宽度偏移）
 * @returns 默认的 { x, y } 坐标
 */
export const getDefaultCardPosition = (index: number, jobs: DrawJob[] = []) => {
  let nextX = DEFAULT_CARD_X;
  let nextY = DEFAULT_CARD_Y;

  for (let i = 0; i < index && i < jobs.length; i++) {
    const job = jobs[i];
    const cardSize = getJobCardSize(job);
    const hasCustomPosition =
      job.hasCustomPosition && Number.isFinite(job.posX) && Number.isFinite(job.posY);
    
    const currentX = hasCustomPosition ? job.posX : nextX;
    const currentY = hasCustomPosition ? job.posY : nextY;

    nextX = currentX + cardSize.cardWidth + CARD_GAP_X;
    nextY = currentY;
  }

  return {
    x: nextX,
    y: nextY
  };
};

/**
 * 计算两张卡片之间的 SVG 连接线路径
 * 从 from 卡片底部中心 -> to 卡片顶部中心，绘制贝塞尔曲线
 * @param from - 起始卡片
 * @param to - 目标卡片
 * @returns SVG path 的 d 属性值
 */
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
