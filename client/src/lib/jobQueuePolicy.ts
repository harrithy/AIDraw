import type { DrawJob } from "../types";
import { isVideoModel } from "./imageModels";

export const DEFAULT_TASK_TIMEOUT_MINUTES = 30;
export const LONG_TASK_TIMEOUT_MINUTES = 120;

/** 视频、音频、文件及混合输出通常比单图耗时更久，使用更宽松的追踪窗口。 */
export const getTaskTimeoutMinutes = (job: DrawJob) =>
  isVideoModel(job.model) ||
  job.category === "video" ||
  job.category === "music" ||
  job.outputKind === "video" ||
  job.outputKind === "audio" ||
  job.outputKind === "file" ||
  job.outputKind === "mixed"
    ? LONG_TASK_TIMEOUT_MINUTES
    : DEFAULT_TASK_TIMEOUT_MINUTES;
