import type { DrawJob } from "../types";

export type JobRetryMode = "resume_remote" | "resubmit" | "blocked_unknown_submission";

/** 决定重试是否只能续查远程任务，避免把一次重试变成第二次付费提交。 */
export const getJobRetryMode = (job: DrawJob): JobRetryMode => {
  // 远端已经明确进入错误终态时，旧 ID 不可能再产出结果，必须重新提交生成请求。
  if (job.status === "failed" && job.remoteStatus === "error") {
    return "resubmit";
  }
  if (job.status === "failed" && (job.remoteTaskId || job.remoteTaskIds?.length)) {
    return "resume_remote";
  }
  if (job.status === "failed" && job.remoteStatus === "submission_unknown") {
    return "blocked_unknown_submission";
  }
  return "resubmit";
};
