import type { DrawFolder, DrawJob } from "../../types";
import type { StoredSettings } from "../providers/types";

const DB_NAME = "aidraw-frontend";
// IndexedDB 不支持降级打开；该版本必须不低于已发布到用户浏览器的版本。
const DB_VERSION = 4;
const LEGACY_STATE_STORE = "state";
const LEGACY_STATE_KEY = "app-state";

export const FOLDER_STORE = "folders";
export const JOB_STORE = "jobs";
export const SETTINGS_STORE = "settings";
export const UPLOADED_IMAGE_STORE = "uploadedImages";

let dbPromise: Promise<IDBDatabase> | null = null;

/** 将旧版单体 state 数据迁移到独立的 IndexedDB object store。 */
const migrateLegacyState = async (db: IDBDatabase) => {
  if (!db.objectStoreNames.contains(LEGACY_STATE_STORE)) return;

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [FOLDER_STORE, JOB_STORE, SETTINGS_STORE, LEGACY_STATE_STORE],
      "readwrite"
    );
    const stateStore = transaction.objectStore(LEGACY_STATE_STORE);
    const stateReq = stateStore.get(LEGACY_STATE_KEY);

    stateReq.onsuccess = () => {
      const oldState = stateReq.result as
        | {
            folders?: DrawFolder[];
            jobs?: DrawJob[];
            settings?: StoredSettings;
          }
        | undefined;
      if (!oldState) return;

      const folderStore = transaction.objectStore(FOLDER_STORE);
      for (const folder of oldState.folders ?? []) folderStore.put(folder);

      const jobStore = transaction.objectStore(JOB_STORE);
      for (const job of oldState.jobs ?? []) jobStore.put(job);

      if (oldState.settings) {
        transaction.objectStore(SETTINGS_STORE).put(oldState.settings, "imageProvider");
      }
      stateStore.delete(LEGACY_STATE_KEY);
    };
    stateReq.onerror = () => reject(stateReq.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

/** 打开数据库、创建表并执行兼容旧版本的数据迁移。 */
export const openDb = () => {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion === 0) {
        db.createObjectStore(FOLDER_STORE, { keyPath: "id" });
        const jobStore = db.createObjectStore(JOB_STORE, { keyPath: "id" });
        jobStore.createIndex("folderId", "folderId", { unique: false });
        db.createObjectStore(SETTINGS_STORE);
      } else if (oldVersion === 1) {
        if (!db.objectStoreNames.contains(FOLDER_STORE)) {
          db.createObjectStore(FOLDER_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(JOB_STORE)) {
          const jobStore = db.createObjectStore(JOB_STORE, { keyPath: "id" });
          jobStore.createIndex("folderId", "folderId", { unique: false });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
      }

      if (oldVersion < 4 && !db.objectStoreNames.contains(UPLOADED_IMAGE_STORE)) {
        const imageStore = db.createObjectStore(UPLOADED_IMAGE_STORE, { keyPath: "id" });
        imageStore.createIndex("folderId", "folderId", { unique: false });
        imageStore.createIndex("folderIdCreatedAt", ["folderId", "createdAt"], { unique: false });
      }
    };

    request.onsuccess = async () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      try {
        await migrateLegacyState(db);
        resolve(db);
      } catch (error) {
        db.close();
        dbPromise = null;
        reject(error);
      }
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 打开失败"));
  });

  return dbPromise;
};
