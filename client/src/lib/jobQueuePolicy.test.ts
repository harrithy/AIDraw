import { describe, expect, it } from "vitest";
import type { DrawJob } from "../types";
import {
  DEFAULT_TASK_TIMEOUT_MINUTES,
  getJobFailureDisposition,
  getTaskTimeoutMinutes,
  LONG_TASK_TIMEOUT_MINUTES
} from "./jobQueuePolicy";

const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "running",
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
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
  ...overrides
});

describe("getTaskTimeoutMinutes", () => {
  it("普通图片任务保持 30 分钟", () => {
    expect(getTaskTimeoutMinutes(makeJob())).toBe(DEFAULT_TASK_TIMEOUT_MINUTES);
  });

  it("视频模型和长耗时能力使用 120 分钟", () => {
    expect(getTaskTimeoutMinutes(makeJob({ model: "kling-v3" }))).toBe(LONG_TASK_TIMEOUT_MINUTES);
    expect(getTaskTimeoutMinutes(makeJob({ outputKind: "audio" }))).toBe(LONG_TASK_TIMEOUT_MINUTES);
    expect(getTaskTimeoutMinutes(makeJob({ outputKind: "file" }))).toBe(LONG_TASK_TIMEOUT_MINUTES);
  });
});

describe("getJobFailureDisposition", () => {
  it("远端明确返回错误时记录为终态，不允许继续轮询旧 ID", () => {
    expect(
      getJobFailureDisposition({
        hasRemoteTask: true,
        terminalRemoteError: true,
        submissionUnknown: false
      })
    ).toEqual({ remoteStatus: "error", canResumeRemote: false });
  });

  it("只有查询中断时才允许恢复远程任务", () => {
    expect(
      getJobFailureDisposition({
        hasRemoteTask: true,
        terminalRemoteError: false,
        submissionUnknown: false
      })
    ).toEqual({ remoteStatus: "tracking_interrupted", canResumeRemote: true });
  });

  it("没有远程 ID 且提交结果未知时保持防重复提交保护", () => {
    expect(
      getJobFailureDisposition({
        hasRemoteTask: false,
        terminalRemoteError: false,
        submissionUnknown: true
      })
    ).toEqual({ remoteStatus: "submission_unknown", canResumeRemote: false });
  });
});
