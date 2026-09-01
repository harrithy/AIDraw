import { describe, expect, it } from "vitest";
import type { DrawJob } from "../types";
import { getJobRetryMode } from "./jobRetry";

const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "failed",
  prompt: "prompt",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  count: 1,
  thinking: "medium",
  model: "gpt-image-2",
  orderIndex: 0,
  posX: 0,
  posY: 0,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  ...overrides
});

describe("getJobRetryMode", () => {
  it("已有单个或多个远程 ID 时只恢复追踪", () => {
    expect(getJobRetryMode(makeJob({ remoteTaskId: "remote-1" }))).toBe("resume_remote");
    expect(getJobRetryMode(makeJob({ remoteTaskIds: ["remote-1", "remote-2"] }))).toBe(
      "resume_remote"
    );
  });

  it("远程任务明确失败后即使保留旧 ID 也重新提交", () => {
    expect(
      getJobRetryMode(makeJob({ remoteStatus: "error", remoteTaskId: "failed-remote-1" }))
    ).toBe("resubmit");
    expect(
      getJobRetryMode(
        makeJob({ remoteStatus: "error", remoteTaskIds: ["failed-remote-1", "failed-remote-2"] })
      )
    ).toBe("resubmit");
  });

  it("提交结果未知且没有远程 ID 时阻止自动重提", () => {
    expect(getJobRetryMode(makeJob({ remoteStatus: "submission_unknown" }))).toBe(
      "blocked_unknown_submission"
    );
  });

  it("没有可恢复远程任务时允许重新提交", () => {
    expect(getJobRetryMode(makeJob({ remoteStatus: "error" }))).toBe("resubmit");
    expect(getJobRetryMode(makeJob({ status: "completed" }))).toBe("resubmit");
  });
});
