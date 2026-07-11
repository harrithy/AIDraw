/**
 * 🖱️ UI 交互状态类型
 * 画布拖拽 & 卡片拖拽的状态机定义，哼，搞得这么清楚是怕主人看不懂吗！
 */

/**
 * 画布拖拽状态
 * 记录用户拖拽画布时的起始位置和偏移量
 */
export type DragState = {
  /** 拖拽起始鼠标 X 坐标 */
  startX: number;
  /** 拖拽起始鼠标 Y 坐标 */
  startY: number;
  /** 拖拽起始画布 panX */
  panX: number;
  /** 拖拽起始画布 panY */
  panY: number;
};

/**
 * 卡片拖拽状态
 * 记录用户拖拽任务卡片时的起始鼠标位置和卡片坐标
 */
export type CardDragState = {
  /** 被拖拽的任务 ID */
  jobId: string;
  /** 拖拽起始鼠标 X 坐标 */
  startX: number;
  /** 拖拽起始鼠标 Y 坐标 */
  startY: number;
  /** 拖拽起始卡片位置 X */
  posX: number;
  /** 拖拽起始卡片位置 Y */
  posY: number;
};

/**
 * 推理深度级别
 * - `high`：深度思考，质量最高但耗时最长
 * - `medium`：平衡模式
 * - `low`：快速模式，适合预览
 */
export type ThinkingValue = "high" | "medium" | "low";
