import { describe, expect, it } from "vitest";
import type { DrawFolder, DrawJob } from "../types";
import { getGeneratedImageStats } from "./generatedImageStats";

/** 用完整任务字段模拟旧图片结果和新资产结果，避免依赖真实生成接口。 */
const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "completed",
  prompt: "测试图片",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  count: 1,
  thinking: "standard",
  model: "gpt-image-2",
  orderIndex: 0,
  posX: 0,
  posY: 0,
  createdAt: "2026-11-03T00:00:00.000Z",
  updatedAt: "2026-11-03T00:00:00.000Z",
  ...overrides
});

/** 所有测试均包含空文件夹，保证其数量为零且参与总览。 */
const folders: DrawFolder[] = ["folder-1", "folder-2", "empty-folder"].map((id) => ({
  id,
  name: id,
  canvasZoom: 1,
  canvasPanX: 0,
  canvasPanY: 0,
  createdAt: "2026-11-03T00:00:00.000Z",
  updatedAt: "2026-11-03T00:00:00.000Z"
}));

describe("全部文件夹生成图片统计", () => {
  it("汇总各文件夹的真实图片数量，包含历史版本而不使用任务请求数量", () => {
    const stats = getGeneratedImageStats(folders, [
      makeJob({
        count: 8,
        outputImageUrls: ["https://example.com/old.png"],
        outputImageUrl: "https://example.com/new.png"
      }),
      makeJob({ id: "job-2", folderId: "folder-2", outputImageUrl: "https://example.com/other.png" })
    ]);
    expect(stats.total).toBe(3);
    expect([...stats.byFolderId]).toEqual([["folder-1", 2], ["folder-2", 1], ["empty-folder", 0]]);
  });

  it("合并当前资产和历史字段，清理空值并在同一任务内去重", () => {
    const stats = getGeneratedImageStats(folders, [makeJob({
      outputImageUrl: " https://example.com/current.png ",
      outputImageUrls: ["", " https://example.com/old.png ", "https://example.com/old.png", "https://example.com/current.png"],
      outputAssets: [
        { kind: "image", url: "https://example.com/current.png" },
        { kind: "image", url: " https://example.com/second.png " },
        { kind: "image", url: " " },
        { kind: "image" }
      ]
    })]);
    expect(stats.total).toBe(3);
  });

  it("支持只有资产列表的多图结果，排除混合结果中的视频、音频和文件", () => {
    const stats = getGeneratedImageStats(folders, [makeJob({
      outputKind: "mixed",
      outputImageUrl: "https://example.com/download.png",
      outputAssets: [
        { kind: "image", url: "https://example.com/image-1" },
        { kind: "image", url: "https://example.com/image-2" },
        { kind: "video", url: "https://example.com/download.png" },
        { kind: "audio", url: "https://example.com/audio" },
        { kind: "file", url: "https://example.com/file.png" }
      ]
    })]);
    expect(stats.total).toBe(2);
  });

  it("排除旧视频、音频、文本结果以及上传的参考图", () => {
    const stats = getGeneratedImageStats(folders, [
      makeJob({ outputImageUrl: "https://example.com/video.mp4?token=1" }),
      makeJob({ outputImageUrl: "https://example.com/music.mp3" }),
      makeJob({ outputKind: "video", outputImageUrl: "https://example.com/download" }),
      makeJob({ outputKind: "text", outputText: "生成文本" }),
      makeJob({ inputImageUrl: "https://example.com/reference.png", inputImageUrls: ["https://example.com/reference-2.png"] })
    ]);
    expect(stats.total).toBe(0);
  });

  it("重绘运行中或失败时仍统计已保存的图片，无结果的任务不增加数量", () => {
    const stats = getGeneratedImageStats(folders, [
      makeJob({ status: "running", outputImageUrls: ["https://example.com/old.png"] }),
      makeJob({ status: "failed", outputImageUrl: "https://example.com/retained.png" }),
      makeJob({ status: "failed" }),
      makeJob({ status: "pending", count: 8 }),
      makeJob({ status: "completed" })
    ]);
    expect(stats.total).toBe(2);
  });

  it("不同任务返回同一 URL 时分别计数", () => {
    const stats = getGeneratedImageStats(folders, [
      makeJob({ outputImageUrl: "https://example.com/shared.png" }),
      makeJob({ id: "job-2", folderId: "folder-2", outputImageUrl: "https://example.com/shared.png" })
    ]);
    expect(stats.total).toBe(2);
    expect(stats.byFolderId.get("folder-1")).toBe(1);
    expect(stats.byFolderId.get("folder-2")).toBe(1);
  });

  it("只统计现有文件夹，删除任务或文件夹后重新计算数量", () => {
    const jobs = [
      makeJob({ outputImageUrl: "https://example.com/one.png" }),
      makeJob({ id: "job-2", folderId: "folder-2", outputImageUrl: "https://example.com/two.png" }),
      makeJob({ id: "orphan", folderId: "deleted-folder", outputImageUrl: "https://example.com/deleted.png" })
    ];
    expect(getGeneratedImageStats(folders, jobs).total).toBe(2);
    expect(getGeneratedImageStats(folders, jobs.slice(1)).total).toBe(1);
    expect(getGeneratedImageStats(folders.filter((folder) => folder.id !== "folder-2"), jobs).total).toBe(1);
    expect(getGeneratedImageStats([], jobs).total).toBe(0);
  });
});
