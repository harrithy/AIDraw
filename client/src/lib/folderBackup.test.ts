import { describe, expect, it } from "vitest";
import type { DrawFolder, DrawJob, UploadedImage } from "../types";
import {
  buildFolderBackup,
  FOLDER_BACKUP_FORMAT,
  FOLDER_BACKUP_VERSION,
  parseFolderBackup,
  prepareFolderImport
} from "./folderBackup";

const makeFolder = (overrides: Partial<DrawFolder> = {}): DrawFolder => ({
  id: "folder-1",
  name: "测试文件夹",
  canvasZoom: 1,
  canvasPanX: 0,
  canvasPanY: 0,
  createdAt: "2026-06-25T07:02:00.000Z",
  updatedAt: "2026-06-25T07:02:00.000Z",
  ...overrides
});

const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "completed",
  prompt: "测试提示词",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  count: 1,
  thinking: "high",
  model: "gpt-image-2",
  orderIndex: 0,
  posX: 0,
  posY: 0,
  createdAt: "2026-06-25T07:02:00.000Z",
  updatedAt: "2026-06-25T07:02:00.000Z",
  ...overrides
});

const makeImage = (overrides: Partial<UploadedImage> = {}): UploadedImage => ({
  id: "image-1",
  folderId: "folder-1",
  url: "https://image.harrio.xyz/example.png",
  originalName: "参考图.png",
  mimeType: "image/png",
  byteSize: 1024,
  createdAt: "2026-06-25T07:02:00.000Z",
  ...overrides
});

describe("文件夹备份构建与解析", () => {
  it("构建的备份包含文件夹、任务与素材", () => {
    const backup = buildFolderBackup(makeFolder(), [makeJob()], [makeImage()]);
    expect(backup.format).toBe(FOLDER_BACKUP_FORMAT);
    expect(backup.version).toBe(FOLDER_BACKUP_VERSION);
    expect(backup.media).toEqual({ binariesIncluded: false, mode: "remote-urls-only" });
    expect(backup.jobs).toHaveLength(1);
    expect(backup.uploadedImages).toHaveLength(1);
  });

  it("导出时不携带任务凭据标识", () => {
    const backup = buildFolderBackup(
      makeFolder(),
      [makeJob({ credentialId: "cred-secret", credentialProviderId: "duomi", providerBaseUrl: "https://api.example.com" })],
      []
    );
    expect(backup.jobs[0]?.credentialId).toBeUndefined();
    expect(backup.jobs[0]?.credentialProviderId).toBeUndefined();
    expect(backup.jobs[0]?.providerBaseUrl).toBeUndefined();
  });

  it("非备份对象会被拒绝", () => {
    expect(() => parseFolderBackup(null)).toThrow("不是有效的对象");
    expect(() => parseFolderBackup({ version: 1 })).toThrow("不是 AIDraw 文件夹备份文件");
    expect(() =>
      parseFolderBackup({ format: FOLDER_BACKUP_FORMAT, version: FOLDER_BACKUP_VERSION })
    ).toThrow("缺少有效的文件夹信息");
    expect(() =>
      parseFolderBackup({ format: FOLDER_BACKUP_FORMAT, version: 999, folder: { name: "x" } })
    ).toThrow("版本不受支持");
  });

  it("会过滤掉缺少关键字段的任务和素材", () => {
    const parsed = parseFolderBackup({
      format: FOLDER_BACKUP_FORMAT,
      version: FOLDER_BACKUP_VERSION,
      folder: { name: "x" },
      jobs: [makeJob(), { id: "bad" }, "not-a-job"],
      uploadedImages: [makeImage(), { id: "bad" }]
    });
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.uploadedImages).toHaveLength(1);
  });

  it("JSON 序列化后可以完整往返", () => {
    const original = buildFolderBackup(makeFolder(), [makeJob({ status: "failed" })], [makeImage()]);
    const restored = parseFolderBackup(JSON.parse(JSON.stringify(original)));
    expect(restored.jobs[0]?.prompt).toBe("测试提示词");
    expect(restored.jobs[0]?.status).toBe("failed");
    expect(restored.folder.name).toBe("测试文件夹");
  });
});

describe("文件夹导入预处理", () => {
  it("生成全新 ID 并重映射 folderId，不修改原字段内容", () => {
    const backup = buildFolderBackup(makeFolder(), [makeJob(), makeJob({ id: "job-2" })], [makeImage()]);
    const pkg = prepareFolderImport(backup, []);

    expect(pkg.folder.id).not.toBe("folder-1");
    expect(pkg.jobs).toHaveLength(2);
    for (const job of pkg.jobs) {
      expect(job.id).not.toMatch(/^job-/);
      expect(job.folderId).toBe(pkg.folder.id);
    }
    expect(pkg.uploadedImages[0]?.folderId).toBe(pkg.folder.id);
    expect(pkg.uploadedImages[0]?.url).toBe("https://image.harrio.xyz/example.png");
  });

  it("completed 与 failed 任务保持状态，pending/running 改为 failed", () => {
    const backup = buildFolderBackup(
      makeFolder(),
      [
        makeJob({ status: "completed" }),
        makeJob({ id: "job-2", status: "failed" }),
        makeJob({ id: "job-3", status: "pending" }),
        makeJob({ id: "job-4", status: "running", remoteTaskId: "task-1" })
      ],
      []
    );
    const pkg = prepareFolderImport(backup, []);

    expect(pkg.jobs.map((job) => job.status)).toEqual(["completed", "failed", "failed", "failed"]);
    expect(pkg.jobs[2]?.errorMessage).toContain("备份导入");
    expect(pkg.jobs[3]?.remoteTaskId).toBeUndefined();
  });

  it("清除跨浏览器无效的远程任务字段", () => {
    const backup = buildFolderBackup(
      makeFolder(),
      [makeJob({ remoteTaskId: "task-1", remoteTaskIds: ["task-1"], queryUrl: "https://x" })],
      []
    );
    const pkg = prepareFolderImport(backup, []);
    expect(pkg.jobs[0]?.remoteTaskId).toBeUndefined();
    expect(pkg.jobs[0]?.remoteTaskIds).toBeUndefined();
    expect(pkg.jobs[0]?.queryUrl).toBeUndefined();
  });

  it("同名文件夹自动追加 (导入N) 后缀", () => {
    const backup = buildFolderBackup(makeFolder(), [], []);
    expect(prepareFolderImport(backup, []).folder.name).toBe("测试文件夹");
    expect(prepareFolderImport(backup, ["测试文件夹"]).folder.name).toBe("测试文件夹 (导入1)");
    expect(prepareFolderImport(backup, ["测试文件夹", "测试文件夹 (导入1)"]).folder.name).toBe(
      "测试文件夹 (导入2)"
    );
  });
});
