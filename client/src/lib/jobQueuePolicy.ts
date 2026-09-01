import type { DrawJob } from "../types";
import { isVideoModel } from "./imageModels";

export const DEFAULT_TASK_TIMEOUT_MINUTES = 30;
export const LONG_TASK_TIMEOUT_MINUTES = 120;

export type JobFailureDisposition = {
  remoteStatus: "error" | "tracking_interrupted" | "submission_unknown";
  canResumeRemote: boolean;
};

/** 区分远端终态失败与本地追踪中断，避免错误任务继续轮询同一个远程 ID。 */
export const getJobFailureDisposition = ({
  hasRemoteTask,
  terminalRemoteError,
  submissionUnknown
}: {
  hasRemoteTask: boolean;
  terminalRemoteError: boolean;
  submissionUnknown: boolean;
}): JobFailureDisposition => {
  if (terminalRemoteError) return { remoteStatus: "error", canResumeRemote: false };
  if (hasRemoteTask) return { remoteStatus: "tracking_interrupted", canResumeRemote: true };
  if (submissionUnknown) return { remoteStatus: "submission_unknown", canResumeRemote: false };
  return { remoteStatus: "error", canResumeRemote: false };
};

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
