import type { DrawFolder } from "../../types";
import {
  FOLDER_STORE,
  JOB_STORE,
  openDb,
  UPLOADED_IMAGE_STORE
} from "../storage/database";
import { createId, nowIso, sortFolders } from "../storage/helpers";
import { broadcastStateUpdate } from "../storage/stateSync";

export const foldersApi = {
  listFolders: async (): Promise<DrawFolder[]> => {
    const db = await openDb();
    return new Promise<DrawFolder[]>((resolve, reject) => {
      const transaction = db.transaction(FOLDER_STORE, "readonly");
      const req = transaction.objectStore(FOLDER_STORE).getAll();
      req.onsuccess = () => resolve(sortFolders(req.result || []));
      req.onerror = () => reject(req.error);
    });
  },

  createFolder: async (name: string): Promise<DrawFolder> => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("文件夹名称不能为空");

    const db = await openDb();
    const now = nowIso();
    const folder: DrawFolder = {
      id: createId(),
      name: trimmedName,
      canvasZoom: 1,
      canvasPanX: 0,
      canvasPanY: 0,
      createdAt: now,
      updatedAt: now
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(FOLDER_STORE, "readwrite");
      const req = transaction.objectStore(FOLDER_STORE).add(folder);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    broadcastStateUpdate("");
    return folder;
  },

  updateFolder: async (
    id: string,
    patch: Partial<Pick<DrawFolder, "name" | "canvasZoom" | "canvasPanX" | "canvasPanY">>
  ): Promise<DrawFolder> => {
    const db = await openDb();
    const updated = await new Promise<DrawFolder>((resolve, reject) => {
      const transaction = db.transaction(FOLDER_STORE, "readwrite");
      const store = transaction.objectStore(FOLDER_STORE);
      const getReq = store.get(id);
      let nextFolder: DrawFolder | null = null;

      getReq.onsuccess = () => {
        const folder = getReq.result as DrawFolder | undefined;
        if (!folder) return;
        nextFolder = { ...folder, ...patch, updatedAt: nowIso() };
        store.put(nextFolder);
      };
      getReq.onerror = () => reject(getReq.error);
      transaction.oncomplete = () => {
        if (nextFolder) resolve(nextFolder);
        else reject(new Error("文件夹不存在"));
      };
      transaction.onerror = () => reject(transaction.error);
    });
    broadcastStateUpdate(id);
    return updated;
  },

  deleteFolder: async (id: string): Promise<void> => {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        [FOLDER_STORE, JOB_STORE, UPLOADED_IMAGE_STORE],
        "readwrite"
      );
      const folderStore = transaction.objectStore(FOLDER_STORE);
      const jobStore = transaction.objectStore(JOB_STORE);
      const imageStore = transaction.objectStore(UPLOADED_IMAGE_STORE);
      const folderReq = folderStore.get(id);
      let folderExists = true;

      folderReq.onsuccess = () => {
        if (!folderReq.result) {
          folderExists = false;
          return;
        }
        folderStore.delete(id);

        const jobKeysReq = jobStore.index("folderId").getAllKeys(id);
        jobKeysReq.onsuccess = () => {
          for (const jobKey of jobKeysReq.result) jobStore.delete(jobKey);
        };

        const imageKeysReq = imageStore.index("folderId").getAllKeys(id);
        imageKeysReq.onsuccess = () => {
          for (const imageKey of imageKeysReq.result) imageStore.delete(imageKey);
        };
      };
      folderReq.onerror = () => reject(folderReq.error);
      transaction.oncomplete = () => {
        if (folderExists) resolve();
        else reject(new Error("文件夹不存在"));
      };
      transaction.onerror = () => reject(transaction.error);
    });
    broadcastStateUpdate(id);
  }
};
