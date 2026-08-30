import type { DrawJob } from "../types";

export type JobRetryMode = "resume_remote" | "resubmit" | "blocked_unknown_submission";

/** 决定重试是否只能续查远程任务，避免把一次重试变成第二次付费提交。 */
export const getJobRetryMode = (job: DrawJob): JobRetryMode => {
  if (job.status === "failed" && (job.remoteTaskId || job.remoteTaskIds?.length)) {
    return "resume_remote";
  }
  if (job.status === "failed" && job.remoteStatus === "submission_unknown") {
    return "blocked_unknown_submission";
  }
  return "resubmit";
};
