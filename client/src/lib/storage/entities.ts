import type { DrawFolder, DrawJob } from "../../types";
import { FOLDER_STORE, JOB_STORE, openDb } from "./database";
import { nowIso } from "./helpers";
import { broadcastStateUpdate } from "./stateSync";

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
