import type { DrawFolder, DrawJob, UploadedImage } from "../../types";
import type { FolderBackup, ImportedFolderPackage } from "../folderBackup";
import { buildFolderBackup, parseImportBackups, prepareFolderImport } from "../folderBackup";
import {
  FOLDER_STORE,
  JOB_STORE,
  openDb,
  UPLOADED_IMAGE_STORE
} from "../storage/database";
import { sortFolders, sortJobs, sortUploadedImages } from "../storage/helpers";
import { broadcastStateUpdate } from "../storage/stateSync";

/**
 * 在当前数据库事务中读取指定文件夹的导出数据（文件夹 + 任务 + 素材）。
 */
const readFolderData = async (folderId: string): Promise<ImportedFolderPackage> => {
  const db = await openDb();
  return new Promise<ImportedFolderPackage>((resolve, reject) => {
    const transaction = db.transaction(
      [FOLDER_STORE, JOB_STORE, UPLOADED_IMAGE_STORE],
      "readonly"
    );
    const folderReq = transaction.objectStore(FOLDER_STORE).get(folderId);
    let folder: DrawFolder | undefined;
    let jobs: DrawJob[] = [];
    let uploadedImages: UploadedImage[] = [];

    folderReq.onsuccess = () => {
      folder = folderReq.result as DrawFolder | undefined;
      if (!folder) return;

      const jobReq = transaction.objectStore(JOB_STORE).index("folderId").getAll(folderId);
      jobReq.onsuccess = () => {
        jobs = (jobReq.result || []) as DrawJob[];
        const imageReq = transaction
          .objectStore(UPLOADED_IMAGE_STORE)
          .index("folderId")
          .getAll(folderId);
        imageReq.onsuccess = () => {
          uploadedImages = (imageReq.result || []) as UploadedImage[];
        };
        imageReq.onerror = () => reject(imageReq.error);
      };
      jobReq.onerror = () => reject(jobReq.error);
    };
    folderReq.onerror = () => reject(folderReq.error);
    transaction.oncomplete = () => {
      if (!folder) {
        reject(new Error("文件夹不存在"));
        return;
      }
      resolve({
        folder,
        jobs: sortJobs(jobs),
        uploadedImages: sortUploadedImages(uploadedImages)
      });
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * 文件夹备份 API：导出当前文件夹为 JSON 备份、导入 JSON 备份为新文件夹。
 */
export const folderBackupApi = {
  /**
   * 读取当前文件夹及其全部任务、素材记录，构建备份对象。
   * @param folderId - 当前文件夹 ID
   */
  exportFolderBackup: async (folderId: string): Promise<FolderBackup> => {
    const { folder, jobs, uploadedImages } = await readFolderData(folderId);
    return buildFolderBackup(folder, jobs, uploadedImages);
  },

  /**
   * 导入文件夹备份：生成全新 ID 和防重名文件夹名，写入 IndexedDB 并广播刷新。
   * 不会覆盖任何现有数据。
   * @param raw - 备份 JSON 解析后的对象
   * @returns 新创建的文件夹列表；普通备份返回一项，紧急备份可返回多项
   */
  importFolderBackup: async (raw: unknown): Promise<DrawFolder[]> => {
    const backups = parseImportBackups(raw);
    const db = await openDb();

    const existingFolders = await new Promise<DrawFolder[]>((resolve, reject) => {
      const transaction = db.transaction(FOLDER_STORE, "readonly");
      const req = transaction.objectStore(FOLDER_STORE).getAll();
      req.onsuccess = () => resolve(sortFolders((req.result || []) as DrawFolder[]));
      req.onerror = () => reject(req.error);
    });

    const reservedNames = existingFolders.map((folder) => folder.name);
    const packages = backups.map((backup) => {
      const pkg = prepareFolderImport(backup, reservedNames);
      reservedNames.push(pkg.folder.name);
      return pkg;
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        [FOLDER_STORE, JOB_STORE, UPLOADED_IMAGE_STORE],
        "readwrite"
      );
      const folderStore = transaction.objectStore(FOLDER_STORE);
      const jobStore = transaction.objectStore(JOB_STORE);
      const imageStore = transaction.objectStore(UPLOADED_IMAGE_STORE);

      for (const pkg of packages) {
        folderStore.put(pkg.folder);
        for (const job of pkg.jobs) jobStore.put(job);
        for (const image of pkg.uploadedImages) imageStore.put(image);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("导入事务被中止"));
    });

    broadcastStateUpdate("");
    return packages.map((pkg) => pkg.folder);
  }
};
