import type { DrawFolder, DrawJob, UploadedImage } from "../types";
import { createId, nowIso } from "./storage/helpers";

/** 文件夹备份文件格式标识，用于校验导入文件类型。 */
export const FOLDER_BACKUP_FORMAT = "aidraw-folder-backup";
/** 当前备份格式版本；结构变更时递增并保留旧版本兼容。 */
export const FOLDER_BACKUP_VERSION = 1;
/** 崩溃页导出的全量救灾备份格式标识。 */
export const EMERGENCY_BACKUP_FORMAT = "aidraw-emergency-backup";
export const EMERGENCY_BACKUP_VERSION = 1;

/** 导出/导入的文件夹备份数据结构（JSON 序列化后落盘为 .json 文件）。 */
export type FolderBackup = {
  /** 固定格式标识，防止导入无关文件。 */
  format: typeof FOLDER_BACKUP_FORMAT;
  /** 格式版本号。 */
  version: typeof FOLDER_BACKUP_VERSION;
  /** 导出时间（ISO 字符串）。 */
  exportedAt: string;
  /** 来源应用名。 */
  appName: string;
  /** JSON 备份只保存媒体引用，不包含图片/视频二进制原文件。 */
  media: {
    binariesIncluded: false;
    mode: "remote-urls-only";
  };
  /** 被导出的文件夹（保留原始 id 仅供展示，导入时会重新生成）。 */
  folder: DrawFolder;
  /** 文件夹内的全部任务。 */
  jobs: DrawJob[];
  /** 文件夹素材库中的全部记录。 */
  uploadedImages: UploadedImage[];
};

/** 导入预处理后的完整数据包，可直接写入 IndexedDB。 */
export type ImportedFolderPackage = {
  folder: DrawFolder;
  jobs: DrawJob[];
  uploadedImages: UploadedImage[];
};

/** 崩溃保护页导出的全量数据包；导入时按文件夹拆分并保留现有数据。 */
export type EmergencyBackup = {
  format: typeof EMERGENCY_BACKUP_FORMAT;
  version: typeof EMERGENCY_BACKUP_VERSION;
  exportedAt: string;
  reason: "crash-rescue";
  securityNotice: string;
  error: string;
  folders: DrawFolder[];
  jobs: DrawJob[];
  uploadedImages: UploadedImage[];
  settings: unknown[];
};

const stripCredentialFields = (job: DrawJob): DrawJob => {
  const {
    credentialId: _credentialId,
    credentialProviderId: _credentialProviderId,
    providerBaseUrl: _providerBaseUrl,
    ...rest
  } = job;
  return rest;
};

/**
 * 构建文件夹备份对象（不落盘，由调用方序列化为 JSON）。
 * @param folder - 要导出的文件夹
 * @param jobs - 文件夹内的任务列表
 * @param uploadedImages - 素材库记录列表
 */
export const buildFolderBackup = (
  folder: DrawFolder,
  jobs: DrawJob[],
  uploadedImages: UploadedImage[]
): FolderBackup => ({
  format: FOLDER_BACKUP_FORMAT,
  version: FOLDER_BACKUP_VERSION,
  exportedAt: nowIso(),
  appName: "AIDraw",
  media: {
    binariesIncluded: false,
    mode: "remote-urls-only"
  },
  folder,
  jobs: jobs.map(stripCredentialFields),
  uploadedImages
});

/** 构建可由普通导入入口恢复的全量救灾备份。 */
export const buildEmergencyBackup = ({
  folders,
  jobs,
  uploadedImages,
  settings,
  error
}: {
  folders: DrawFolder[];
  jobs: DrawJob[];
  uploadedImages: UploadedImage[];
  settings: unknown[];
  error: string;
}): EmergencyBackup => ({
  format: EMERGENCY_BACKUP_FORMAT,
  version: EMERGENCY_BACKUP_VERSION,
  exportedAt: nowIso(),
  reason: "crash-rescue",
  securityNotice: "Sensitive API credentials (apiKey / savedApiKeys) have been automatically stripped for security.",
  error,
  folders,
  jobs: jobs.map(stripCredentialFields),
  uploadedImages,
  settings
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 校验并解析导入的 JSON 数据。
 * 结构与版本不匹配时抛出带中文说明的 Error。
 * @param raw - JSON.parse 后的未知数据
 */
export const parseFolderBackup = (raw: unknown): FolderBackup => {
  if (!isRecord(raw)) throw new Error("导入失败：文件内容不是有效的对象");
  if (raw.format !== FOLDER_BACKUP_FORMAT) {
    throw new Error("导入失败：不是 AIDraw 文件夹备份文件");
  }
  if ((raw as { version?: unknown }).version !== FOLDER_BACKUP_VERSION) {
    throw new Error(`导入失败：备份文件版本不受支持（当前仅支持 v${FOLDER_BACKUP_VERSION}）`);
  }
  const folderRaw = raw.folder;
  if (!isRecord(folderRaw) || typeof folderRaw.name !== "string" || !folderRaw.name.trim()) {
    throw new Error("导入失败：备份文件缺少有效的文件夹信息");
  }

  const jobs = Array.isArray(raw.jobs)
    ? raw.jobs.filter((job): job is DrawJob => isRecord(job) && typeof job.prompt === "string")
    : [];
  const uploadedImages = Array.isArray(raw.uploadedImages)
    ? raw.uploadedImages.filter(
        (image): image is UploadedImage => isRecord(image) && typeof image.url === "string"
      )
    : [];

  return {
    format: FOLDER_BACKUP_FORMAT,
    version: FOLDER_BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : nowIso(),
    appName: typeof raw.appName === "string" ? raw.appName : "AIDraw",
    media: {
      binariesIncluded: false,
      mode: "remote-urls-only"
    },
    folder: folderRaw as unknown as DrawFolder,
    jobs,
    uploadedImages
  };
};

/**
 * 解析普通单文件夹备份或崩溃页全量备份，统一转换为可逐个导入的文件夹备份列表。
 * 全量备份中的设置已脱敏且不会覆盖当前设置，仅恢复文件夹、任务和素材记录。
 */
export const parseImportBackups = (raw: unknown): FolderBackup[] => {
  if (isRecord(raw) && raw.format === FOLDER_BACKUP_FORMAT) {
    return [parseFolderBackup(raw)];
  }
  if (!isRecord(raw) || raw.format !== EMERGENCY_BACKUP_FORMAT) {
    throw new Error("导入失败：不是 AIDraw 文件夹或紧急救灾备份文件");
  }
  if (raw.version !== EMERGENCY_BACKUP_VERSION) {
    throw new Error(`导入失败：紧急备份版本不受支持（当前仅支持 v${EMERGENCY_BACKUP_VERSION}）`);
  }

  const folders = Array.isArray(raw.folders)
    ? raw.folders.filter(
        (folder): folder is DrawFolder =>
          isRecord(folder) && typeof folder.id === "string" && typeof folder.name === "string" && Boolean(folder.name.trim())
      )
    : [];
  if (folders.length === 0) throw new Error("导入失败：紧急备份中没有有效的文件夹");

  const jobs = Array.isArray(raw.jobs)
    ? raw.jobs.filter(
        (job): job is DrawJob =>
          isRecord(job) && typeof job.folderId === "string" && typeof job.prompt === "string"
      )
    : [];
  const uploadedImages = Array.isArray(raw.uploadedImages)
    ? raw.uploadedImages.filter(
        (image): image is UploadedImage =>
          isRecord(image) && typeof image.folderId === "string" && typeof image.url === "string"
      )
    : [];
  const exportedAt = typeof raw.exportedAt === "string" ? raw.exportedAt : nowIso();

  return folders.map((folder) => ({
    format: FOLDER_BACKUP_FORMAT,
    version: FOLDER_BACKUP_VERSION,
    exportedAt,
    appName: "AIDraw",
    media: { binariesIncluded: false, mode: "remote-urls-only" },
    folder,
    jobs: jobs.filter((job) => job.folderId === folder.id).map(stripCredentialFields),
    uploadedImages: uploadedImages.filter((image) => image.folderId === folder.id)
  }));
};

/** 为导入的文件夹生成不与现有文件夹重名的名称。 */
const uniqueFolderName = (name: string, existingNames: Set<string>) => {
  const base = name.trim() || "导入的文件夹";
  if (!existingNames.has(base)) return base;

  let index = 1;
  while (existingNames.has(`${base} (导入${index})`)) index += 1;
  return `${base} (导入${index})`;
};

/** 导入时禁止保留的运行时字段；远程任务无法跨浏览器恢复，避免误导或意外计费。 */
const stripImportFields = <T extends Record<string, unknown>>(job: T): Partial<T> => {
  const {
    provider: _provider,
    credentialId: _credentialId,
    credentialProviderId: _credentialProviderId,
    providerBaseUrl: _providerBaseUrl,
    remoteTaskId: _remoteTaskId,
    remoteTaskIds: _remoteTaskIds,
    remoteStatus: _remoteStatus,
    queryUrl: _queryUrl,
    submitTime: _submitTime,
    startedAt: _startedAt,
    queueOwnerId: _queueOwnerId,
    leaseExpiresAt: _leaseExpiresAt,
    ...rest
  } = job;
  return rest as Partial<T>;
};

/**
 * 把备份转换为可写入 IndexedDB 的导入数据包：
 * - 生成全新的文件夹 ID、任务 ID 和素材 ID，避免与现有数据冲突；
 * - 所有引用（folderId）统一重映射到新文件夹；
 * - 清除跨浏览器无效的运行时/远程任务字段；
 * - 备份中的 pending/running 任务改为 failed（避免导入后自动重新提交产生费用），
 *   保留 completed/failed 原状，用户可点击「继续」主动重绘；
 * - 文件夹名称与现有名称重复时自动追加 " (导入N)" 后缀。
 *
 * @param backup - 已解析的备份对象
 * @param existingFolderNames - 当前数据库中的全部文件夹名称
 */
export const prepareFolderImport = (
  backup: FolderBackup,
  existingFolderNames: string[]
): ImportedFolderPackage => {
  const folderId = createId();
  const now = nowIso();
  const folder: DrawFolder = {
    id: folderId,
    name: uniqueFolderName(backup.folder.name, new Set(existingFolderNames)),
    canvasZoom:
      typeof backup.folder.canvasZoom === "number" && Number.isFinite(backup.folder.canvasZoom)
        ? Math.min(Math.max(backup.folder.canvasZoom, 0.55), 1.8)
        : 1,
    canvasPanX: Number.isFinite(backup.folder.canvasPanX) ? backup.folder.canvasPanX : 0,
    canvasPanY: Number.isFinite(backup.folder.canvasPanY) ? backup.folder.canvasPanY : 0,
    createdAt: backup.folder.createdAt || now,
    updatedAt: backup.folder.updatedAt || now
  };

  const jobs: DrawJob[] = backup.jobs.map((job) => {
    const sanitized = stripImportFields(job as unknown as Record<string, unknown>) as unknown as DrawJob;
    const keepStatus = job.status === "completed" || job.status === "failed";
    return {
      ...sanitized,
      id: createId(),
      folderId,
      status: keepStatus ? job.status : "failed",
      errorMessage: keepStatus
        ? sanitized.errorMessage
        : "备份导入：为避免自动提交产生费用，任务已重置为失败，请点击「继续」重新生成。"
    };
  });

  const uploadedImages: UploadedImage[] = backup.uploadedImages.map((image) => ({
    ...image,
    id: createId(),
    folderId
  }));

  return { folder, jobs, uploadedImages };
};
