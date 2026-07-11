import type { DrawJob, DrawMode } from "../types";

/**
 * 任务状态到中文标签的映射
 * 使用 Record 类型确保所有状态都有对应的标签
 */
export const statusLabel: Record<DrawJob["status"], string> = {
  pending: "等待中",
  running: "绘制中",
  completed: "已完成",
  failed: "失败"
};

/**
 * 绘图模式到中文标签的映射
 */
export const modeLabel: Record<DrawMode, string> = {
  "text-to-image": "文生图",
  "image-to-image": "图生图"
};
