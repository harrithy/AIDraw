import type { DrawFolder, DrawJob } from "../../types";
import { FOLDER_STORE, JOB_STORE, openDb } from "./database";
import { nowIso } from "./helpers";
import { broadcastStateUpdate } from "./stateSync";

/**
 * 按 ID 查询文件夹，不存在时抛出错误。
 * 用于需要确保文件夹一定存在的场景（如创建任务前校验所属文件夹）。
 * @param folderId - 文件夹 ID
 * @throws 文件夹不存在时抛出 Error
 */
export const ensureFolder = async (folderId: string): Promise<DrawFolder> => {
  const db = await openDb();
  return new Promise<DrawFolder>((resolve, reject) => {
    const transaction = db.transaction(FOLDER_STORE, "readonly");
    const req = transaction.objectStore(FOLDER_STORE).get(folderId);
    req.onsuccess = () => {
      if (!req.result) reject(new Error("文件夹不存在"));
      else resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
};

/**
 * 按 ID 查询任务，不存在时抛出错误。
 * @param jobId - 任务 ID
 * @throws 任务不存在时抛出 Error
 */
export const ensureJob = async (jobId: string): Promise<DrawJob> => {
  const db = await openDb();
  return new Promise<DrawJob>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readonly");
    const req = transaction.objectStore(JOB_STORE).get(jobId);
    req.onsuccess = () => {
      if (!req.result) reject(new Error("任务不存在"));
      else resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
};

/**
 * 局部更新任务字段（PATCH 语义），自动更新 updatedAt 时间戳。
 * 更新完成后广播状态变更通知，触发其他标签页同步。
 * @param jobId - 任务 ID
 * @param patch - 需要更新的字段（只传变更部分即可）
 * @returns 更新后的完整任务对象
 * @throws 任务不存在时抛出 Error
 */
export const updateJob = async (jobId: string, patch: Partial<DrawJob>): Promise<DrawJob> => {
  const db = await openDb();
  return new Promise<DrawJob>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    const store = transaction.objectStore(JOB_STORE);
    const getReq = store.get(jobId);

    getReq.onsuccess = () => {
      const job = getReq.result as DrawJob | undefined;
      if (!job) {
        reject(new Error("任务不存在"));
        return;
      }
      const updated: DrawJob = { ...job, ...patch, updatedAt: nowIso() };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    transaction.oncomplete = () => {
      const folderId = getReq.result?.folderId;
      if (folderId) broadcastStateUpdate(folderId);
    };
  });
};

/** 只有仍由指定标签页持有租约的运行中任务才允许更新。 */
export const updateOwnedJob = async (
  jobId: string,
  queueOwnerId: string,
  patch: Partial<DrawJob>,
  broadcast = true
): Promise<DrawJob | null> => {
  const db = await openDb();
  return new Promise<DrawJob | null>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    const store = transaction.objectStore(JOB_STORE);
    const getReq = store.get(jobId);
    let updated: DrawJob | null = null;

    getReq.onsuccess = () => {
      const job = getReq.result as DrawJob | undefined;
      if (!job || job.queueOwnerId !== queueOwnerId || job.status !== "running") return;
      updated = { ...job, ...patch, updatedAt: nowIso() };
      store.put(updated);
    };
    getReq.onerror = () => reject(getReq.error);
    transaction.oncomplete = () => {
      if (updated && broadcast) broadcastStateUpdate(updated.folderId);
      resolve(updated);
    };
    transaction.onerror = () => reject(transaction.error);
  });
};
