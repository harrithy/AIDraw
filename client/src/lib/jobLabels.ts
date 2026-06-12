import type { DrawJob, DrawMode } from "../types";

export const statusLabel: Record<DrawJob["status"], string> = {
  pending: "等待中",
  running: "绘制中",
  completed: "已完成",
  failed: "失败"
};

export const modeLabel: Record<DrawMode, string> = {
  "text-to-image": "文生图",
  "image-to-image": "图生图"
};
