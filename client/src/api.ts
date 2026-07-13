import type {
  CreateJobPayload,
  DrawSize,
  DrawFolder,
  DrawJob,
  HealthPayload,
  ImageProviderId,
  ImageProviderSettings,
  NanoImageSize,
  UpdateImageProviderSettingsPayload
} from "./types";
import { getJobOutputImages } from "./lib/jobImages";
import {
  GPT_IMAGE_MODEL,
  MAX_NANO_BANANA_REFERENCE_IMAGES,
  isNanoBananaModel,
  supportsNanoBananaImageSize
} from "./lib/imageModels";
import { DuomiProvider } from "./lib/providers/DuomiProvider";
import { NanoBananaProvider } from "./lib/providers/NanoBananaProvider";
import { MockProvider, dimensionsFromSize } from "./lib/providers/MockProvider";
import type { ImageModelProvider, StoredSettings } from "./lib/providers/types";

const DB_NAME = "aidraw-frontend";
const DB_VERSION = 2;
const STATE_STORE = "state";
const STATE_KEY = "app-state";
const MAX_CONCURRENT = 10;
const DEFAULT_BASE_URL = "https://duomiapi.com";
const DEFAULT_MODEL = GPT_IMAGE_MODEL;
const DEFAULT_SIZE: DrawSize = "auto";
const DEFAULT_NANO_IMAGE_SIZE: NanoImageSize = "4K";

const IMAGE_UPLOAD_BASE_URL = "https://image.harrio.xyz";
const IMAGE_UPLOAD_PROXY_PATH = "/image-upload/upload";
const TASK_TIMEOUT_MINUTES = 30;
const TASK_TIMEOUT_MS = TASK_TIMEOUT_MINUTES * 60 * 1000;
const TASK_POLL_INTERVAL_MS = 10 * 1000;
const JOB_LEASE_MS = 90 * 1000;

const MIN_IMAGE_SIDE = 16;
const MAX_IMAGE_SIDE = 3840;
const MIN_IMAGE_PIXELS = 655360;
const MAX_IMAGE_PIXELS = 8294400;

const presetSizeOptions = new Set<string>([
  "auto",
  "1024x1024",
  "1792x1024",
  "1024x1792",
  "1:1",
  "3:2",
  "2:3",
  "16:9",
  "9:16",
  "1:2",
  "2:1",
  "4:3",
  "3:4",
  "5:4",
  "4:5",
  "21:9"
]);

const isValidCustomSize = (width: number, height: number) => {
  const pixels = width * height;
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= MIN_IMAGE_SIDE &&
    height >= MIN_IMAGE_SIDE &&
    width <= MAX_IMAGE_SIDE &&
    height <= MAX_IMAGE_SIDE &&
    width % 16 === 0 &&
    height % 16 === 0 &&
    pixels >= MIN_IMAGE_PIXELS &&
    pixels <= MAX_IMAGE_PIXELS
  );
};

const normalizeSize = (value: unknown): DrawSize => {
  const size = String(value ?? "").trim() as DrawSize;
  if (presetSizeOptions.has(size)) return size;

  const customSize = /^(\d+)x(\d+)$/.exec(size);
  if (!customSize) return DEFAULT_SIZE;

  const width = Number(customSize[1]);
  const height = Number(customSize[2]);
  return isValidCustomSize(width, height) ? `${width}x${height}` : DEFAULT_SIZE;
};

const normalizeNanoImageSize = (value: unknown): NanoImageSize => {
  if (value === "1K" || value === "2K" || value === "4K") return value;
  return DEFAULT_NANO_IMAGE_SIZE;
};

const isRemoteImageUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const assertDuomiImageUrls = (imageUrls: string[]) => {
  const hasInvalidImage = imageUrls.some((imageUrl) => !isRemoteImageUrl(imageUrl));
  if (hasInvalidImage) {
    throw new Error("参考图只支持公网 http(s) 图片 URL，不能直接发送本地图片或 data URL");
  }
};

let dbPromise: Promise<IDBDatabase> | null = null;
const activeJobs = new Set<string>();
const queueOwnerId = typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const syncChannel = typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel("aidraw-state-sync")
  : null;

const broadcastStateUpdate = (folderId: string) => {
  if (syncChannel) {
    syncChannel.postMessage({ type: "STATE_UPDATED", folderId });
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aidraw-state-update", { detail: { folderId } }));
  }
};

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data?.type === "STATE_UPDATED") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("aidraw-state-update", { detail: { folderId: event.data.folderId } }));
      }
    }
  };
}

const nowIso = () => new Date().toISOString();

const createId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const openDb = () => {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion === 0) {
        db.createObjectStore("folders", { keyPath: "id" });
        const jobStore = db.createObjectStore("jobs", { keyPath: "id" });
        jobStore.createIndex("folderId", "folderId", { unique: false });
        db.createObjectStore("settings");
      } else if (oldVersion === 1) {
        if (!db.objectStoreNames.contains("folders")) {
          db.createObjectStore("folders", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("jobs")) {
          const jobStore = db.createObjectStore("jobs", { keyPath: "id" });
          jobStore.createIndex("folderId", "folderId", { unique: false });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
      }
    };

    request.onsuccess = async () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      try {
        await migrateV1ToV2(db);
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

const migrateV1ToV2 = async (db: IDBDatabase) => {
  if (!db.objectStoreNames.contains(STATE_STORE)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(["folders", "jobs", "settings", STATE_STORE], "readwrite");
    const stateStore = transaction.objectStore(STATE_STORE);
    const stateReq = stateStore.get(STATE_KEY);

    stateReq.onsuccess = () => {
      const oldState = stateReq.result as {
        folders?: DrawFolder[];
        jobs?: DrawJob[];
        settings?: StoredSettings;
      } | undefined;
      if (!oldState) return;

      const folderStore = transaction.objectStore("folders");
      if (Array.isArray(oldState.folders)) {
        for (const folder of oldState.folders) {
          folderStore.put(folder);
        }
      }

      const jobStore = transaction.objectStore("jobs");
      if (Array.isArray(oldState.jobs)) {
        for (const job of oldState.jobs) {
          jobStore.put(job);
        }
      }

      if (oldState.settings) {
        transaction.objectStore("settings").put(oldState.settings, "imageProvider");
      }

      stateStore.delete(STATE_KEY);
    };
    stateReq.onerror = () => reject(stateReq.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

const getSettings = async (): Promise<StoredSettings> => {
  const db = await openDb();
  return new Promise<StoredSettings>((resolve, reject) => {
    const transaction = db.transaction("settings", "readonly");
    const req = transaction.objectStore("settings").get("imageProvider");
    req.onsuccess = () => {
      const result = req.result as StoredSettings | undefined;
      resolve(result || {
        baseUrl: DEFAULT_BASE_URL,
        model: DEFAULT_MODEL,
        apiKey: ""
      });
    };
    req.onerror = () => reject(req.error);
  });
};

const saveSettings = async (settings: StoredSettings) => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("settings", "readwrite");
    const req = transaction.objectStore("settings").put(settings, "imageProvider");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  broadcastStateUpdate("");
};

const maskSecret = (value: string) => {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const sortFolders = (folders: DrawFolder[]) =>
  [...folders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const sortJobs = (jobs: DrawJob[]) =>
  [...jobs].sort((a, b) => a.orderIndex - b.orderIndex || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const ensureFolder = async (folderId: string): Promise<DrawFolder> => {
  const db = await openDb();
  return new Promise<DrawFolder>((resolve, reject) => {
    const transaction = db.transaction("folders", "readonly");
    const req = transaction.objectStore("folders").get(folderId);
    req.onsuccess = () => {
      if (!req.result) reject(new Error("文件夹不存在"));
      else resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
};

const ensureJob = async (jobId: string): Promise<DrawJob> => {
  const db = await openDb();
  return new Promise<DrawJob>((resolve, reject) => {
    const transaction = db.transaction("jobs", "readonly");
    const req = transaction.objectStore("jobs").get(jobId);
    req.onsuccess = () => {
      if (!req.result) reject(new Error("任务不存在"));
      else resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
};

const updateJob = async (jobId: string, patch: Partial<DrawJob>): Promise<DrawJob> => {
  const db = await openDb();
  return new Promise<DrawJob>((resolve, reject) => {
    const transaction = db.transaction("jobs", "readwrite");
    const store = transaction.objectStore("jobs");
    const getReq = store.get(jobId);

    getReq.onsuccess = () => {
      const job = getReq.result as DrawJob | undefined;
      if (!job) {
        reject(new Error("任务不存在"));
        return;
      }
      const updated: DrawJob = {
        ...job,
        ...patch,
        updatedAt: nowIso()
      };
      const putReq = store.put(updated);
      putReq.onsuccess = () => {
        resolve(updated);
      };
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);

    transaction.oncomplete = () => {
      const folderId = getReq.result?.folderId;
      if (folderId) broadcastStateUpdate(folderId);
    };
  });
};

const updateOwnedJob = async (
  jobId: string,
  patch: Partial<DrawJob>,
  broadcast = true
): Promise<DrawJob | null> => {
  const db = await openDb();
  return new Promise<DrawJob | null>((resolve, reject) => {
    const transaction = db.transaction("jobs", "readwrite");
    const store = transaction.objectStore("jobs");
    const getReq = store.get(jobId);
    let updated: DrawJob | null = null;

    getReq.onsuccess = () => {
      const job = getReq.result as DrawJob | undefined;
      if (!job || job.queueOwnerId !== queueOwnerId || job.status !== "running") return;

      updated = {
        ...job,
        ...patch,
        updatedAt: nowIso()
      };
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

const leaseExpiryIso = () => new Date(Date.now() + JOB_LEASE_MS).toISOString();

const isLeaseActive = (job: DrawJob, now: number) => {
  const expiresAt = job.leaseExpiresAt ? new Date(job.leaseExpiresAt).getTime() : 0;
  return Number.isFinite(expiresAt) && expiresAt > now;
};

const isTaskTimedOut = (job: DrawJob) => {
  const startedAt = job.submitTime || job.startedAt;
  if (!startedAt) return false;
  const startedAtMs = new Date(startedAt).getTime();
  return Number.isFinite(startedAtMs) && Date.now() - startedAtMs > TASK_TIMEOUT_MS;
};

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

type ImageUploadResponse = Array<{
  src?: string;
  url?: string;
}>;

const extractUploadedImageUrl = (payload: ImageUploadResponse | null) => {
  const uploaded = payload?.find((item) => typeof item.src === "string" || typeof item.url === "string");
  const rawUrl = uploaded?.src ?? uploaded?.url;
  if (!rawUrl) throw new Error("图床上传成功，但未返回图片地址");
  return new URL(rawUrl, IMAGE_UPLOAD_BASE_URL).toString();
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  const data = payload as {
    error?: { code?: string; message?: string; type?: string };
    message?: string;
    msg?: string;
    data?: { description?: string; msg?: string };
  } | null;
  const message = [data?.error?.message, data?.message, data?.data?.msg, data?.data?.description, data?.msg].find(
    (value) => typeof value === "string" && value.trim()
  );
  const details = [data?.error?.code, data?.error?.type].filter(Boolean).join(" / ");
  if (message && details) return `${message}（${details}）`;
  return message ?? fallback;
};

const uploadImageToHost = async (file: File) => {
  const body = new FormData();
  body.append("file", file);

  try {
    const response = await fetch(IMAGE_UPLOAD_PROXY_PATH, {
      method: "POST",
      body
    });
    const payload = (await response.json().catch(() => null)) as ImageUploadResponse | null;
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `图床上传失败：HTTP ${response.status}`));
    }
    return extractUploadedImageUrl(payload);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("上传到图床失败：可能是网络不可达、CORS 限制，或 image.harrio.xyz 暂时不可用");
    }
    throw error;
  }
};

const isProviderId = (value: unknown): value is ImageProviderId =>
  value === "duomi" || value === "nano-banana" || value === "mock";

const resolveProviderId = (job: DrawJob, settings: StoredSettings): ImageProviderId => {
  if (isProviderId(job.provider)) return job.provider;
  if (job.remoteTaskId) return isNanoBananaModel(job.model) ? "nano-banana" : "duomi";
  if (!settings.apiKey) return "mock";
  return isNanoBananaModel(job.model) ? "nano-banana" : "duomi";
};

const getProvider = (providerId: ImageProviderId): ImageModelProvider => {
  if (providerId === "mock") return new MockProvider();
  if (providerId === "nano-banana") return new NanoBananaProvider();
  return new DuomiProvider();
};

const executeJobBackground = async (job: DrawJob) => {
  try {
    while (true) {
      let freshJob = await ensureJob(job.id);
      if (freshJob.status !== "running" || freshJob.queueOwnerId !== queueOwnerId) return;
      if (isTaskTimedOut(freshJob)) {
        throw new Error(`任务轮询超时，已等待 ${TASK_TIMEOUT_MINUTES} 分钟`);
      }

      const renewedJob = await updateOwnedJob(job.id, { leaseExpiresAt: leaseExpiryIso() }, false);
      if (!renewedJob) return;
      freshJob = renewedJob;

      const settings = await getSettings();
      const providerId = resolveProviderId(freshJob, settings);
      if (providerId !== "mock" && !settings.apiKey) {
        throw new Error("恢复远程任务需要原 API Key，请重新配置后再继续");
      }
      const provider = getProvider(providerId);

      let taskId = freshJob.remoteTaskId;
      if (!taskId) {
        const preparedJob = await updateOwnedJob(job.id, {
          provider: providerId,
          remoteStatus: "submitting",
          submitTime: freshJob.submitTime || nowIso(),
          leaseExpiresAt: leaseExpiryIso()
        });
        if (!preparedJob) return;

        const createdTask = await provider.createTask(preparedJob, settings);
        const submittedJob = await updateOwnedJob(job.id, {
          remoteTaskId: createdTask.taskId,
          queryUrl: createdTask.queryUrl,
          provider: providerId,
          remoteStatus: "pending",
          leaseExpiresAt: leaseExpiryIso()
        });
        if (!submittedJob) return;
        freshJob = submittedJob;
        taskId = createdTask.taskId;
      }

      const result = await provider.queryTask(taskId, freshJob, settings);
      if (result.state === "pending" || result.state === "running") {
        const waitingJob = await updateOwnedJob(job.id, {
          remoteStatus: result.state,
          leaseExpiresAt: leaseExpiryIso()
        });
        if (!waitingJob) return;
        await delay(TASK_POLL_INTERVAL_MS);
        continue;
      }
      if (result.state === "error") {
        throw new Error(result.errorMessage);
      }

      const latestJob = await ensureJob(job.id);
      await updateOwnedJob(job.id, {
        status: "completed",
        remoteStatus: "succeeded",
        outputImageUrl: result.imageUrl,
        outputImageUrls: [...getJobOutputImages(latestJob), result.imageUrl],
        errorMessage: undefined,
        completedAt: nowIso(),
        queueOwnerId: undefined,
        leaseExpiresAt: undefined
      });
      return;
    }
  } catch (error) {
    await updateOwnedJob(job.id, {
      status: "failed",
      remoteStatus: "error",
      errorMessage: error instanceof Error ? error.message : "绘图任务失败",
      completedAt: nowIso(),
      queueOwnerId: undefined,
      leaseExpiresAt: undefined
    });
  } finally {
    activeJobs.delete(job.id);
    void processQueue();
  }
};

const runQueueLocked = async () => {
  const db = await openDb();
  const claimedJobs: DrawJob[] = [];
  const changedFolderIds = new Set<string>();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("jobs", "readwrite");
    const store = transaction.objectStore("jobs");
    const getAllReq = store.getAll();

    getAllReq.onsuccess = () => {
      const jobs = (getAllReq.result || []) as DrawJob[];
      const now = Date.now();
      const timestamp = nowIso();
      let runningCount = 0;

      for (const job of jobs) {
        if (job.status !== "running") continue;

        if (isTaskTimedOut(job)) {
          store.put({
            ...job,
            status: "failed",
            remoteStatus: "error",
            errorMessage: `任务轮询超时，已等待 ${TASK_TIMEOUT_MINUTES} 分钟`,
            completedAt: timestamp,
            queueOwnerId: undefined,
            leaseExpiresAt: undefined,
            updatedAt: timestamp
          });
          changedFolderIds.add(job.folderId);
          continue;
        }

        if (isLeaseActive(job, now)) {
          runningCount += 1;
          if (job.queueOwnerId === queueOwnerId && !activeJobs.has(job.id)) {
            claimedJobs.push(job);
          }
          continue;
        }

        if (!job.remoteTaskId) {
          store.put({
            ...job,
            status: "failed",
            remoteStatus: "error",
            errorMessage: "任务提交状态未知，为避免重复计费未自动重试",
            completedAt: timestamp,
            queueOwnerId: undefined,
            leaseExpiresAt: undefined,
            updatedAt: timestamp
          });
          changedFolderIds.add(job.folderId);
          continue;
        }

        const recoveredJob: DrawJob = {
          ...job,
          startedAt: job.startedAt || timestamp,
          queueOwnerId,
          leaseExpiresAt: leaseExpiryIso(),
          updatedAt: timestamp
        };
        store.put(recoveredJob);
        claimedJobs.push(recoveredJob);
        changedFolderIds.add(job.folderId);
        runningCount += 1;
      }

      const slots = Math.max(0, MAX_CONCURRENT - runningCount);
      const pendingJobs = sortJobs(jobs.filter((job) => job.status === "pending")).slice(0, slots);
      for (const job of pendingJobs) {
        const claimedJob: DrawJob = {
          ...job,
          status: "running",
          errorMessage: undefined,
          startedAt: job.startedAt || timestamp,
          queueOwnerId,
          leaseExpiresAt: leaseExpiryIso(),
          updatedAt: timestamp
        };
        store.put(claimedJob);
        claimedJobs.push(claimedJob);
        changedFolderIds.add(job.folderId);
      }
    };
    getAllReq.onerror = () => reject(getAllReq.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  changedFolderIds.forEach((folderId) => broadcastStateUpdate(folderId));
  for (const job of claimedJobs) {
    if (activeJobs.has(job.id)) continue;
    activeJobs.add(job.id);
    void executeJobBackground(job);
  }
};

const processQueue = async () => {
  try {
    if (typeof navigator.locks?.request === "function") {
      await navigator.locks.request("aidraw-queue-lock", () => runQueueLocked());
    } else {
      await runQueueLocked();
    }
  } catch (error) {
    console.error("处理绘图队列失败", error);
  }
};

export const api = {
  health: async (): Promise<HealthPayload> => {
    const db = await openDb();
    await processQueue();

    const jobs = await new Promise<DrawJob[]>((resolve, reject) => {
      const transaction = db.transaction("jobs", "readonly");
      const req = transaction.objectStore("jobs").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const settings = await getSettings();

    return {
      ok: true,
      queue: {
        maxConcurrent: MAX_CONCURRENT,
        running: jobs.filter((job) => job.status === "running").length,
        pending: jobs.filter((job) => job.status === "pending").length
      },
      imageProvider: {
        textToImage: settings.apiKey ? "duomi" : "mock",
        imageToImage: settings.apiKey ? "duomi" : "mock",
        hasDuomiKey: Boolean(settings.apiKey),
        duomiBaseUrl: settings.baseUrl || DEFAULT_BASE_URL,
        duomiModel: settings.model || DEFAULT_MODEL,
        apiKeyMasked: maskSecret(settings.apiKey),
        usesSavedConfig: Boolean(settings.apiKey || settings.baseUrl || settings.model)
      }
    };
  },

  listFolders: async (): Promise<DrawFolder[]> => {
    const db = await openDb();
    return new Promise<DrawFolder[]>((resolve, reject) => {
      const transaction = db.transaction("folders", "readonly");
      const req = transaction.objectStore("folders").getAll();
      req.onsuccess = () => {
        resolve(sortFolders(req.result || []));
      };
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
      const transaction = db.transaction("folders", "readwrite");
      const req = transaction.objectStore("folders").add(folder);
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
      const transaction = db.transaction("folders", "readwrite");
      const store = transaction.objectStore("folders");
      const getReq = store.get(id);
      let nextFolder: DrawFolder | null = null;

      getReq.onsuccess = () => {
        const folder = getReq.result as DrawFolder | undefined;
        if (!folder) return;
        nextFolder = {
          ...folder,
          ...patch,
          updatedAt: nowIso()
        };
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
      const transaction = db.transaction(["folders", "jobs"], "readwrite");
      const folderStore = transaction.objectStore("folders");
      const jobStore = transaction.objectStore("jobs");
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
          for (const jobKey of jobKeysReq.result) {
            jobStore.delete(jobKey);
          }
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
  },

  listJobs: async (folderId: string): Promise<DrawJob[]> => {
    const db = await openDb();
    await ensureFolder(folderId);

    return new Promise<DrawJob[]>((resolve, reject) => {
      const transaction = db.transaction("jobs", "readonly");
      const index = transaction.objectStore("jobs").index("folderId");
      const req = index.getAll(folderId);
      req.onsuccess = () => {
        resolve(sortJobs(req.result || []));
      };
      req.onerror = () => reject(req.error);
    });
  },

  createJobs: async (folderId: string, payload: CreateJobPayload): Promise<DrawJob[]> => {
    const prompt = payload.prompt.trim();
    const inputImageUrls = payload.inputImageUrls?.length
      ? payload.inputImageUrls
      : payload.inputImageUrl
        ? [payload.inputImageUrl]
        : [];

    const settings = await getSettings();
    if (settings.apiKey && inputImageUrls.length > 0) assertDuomiImageUrls(inputImageUrls);

    const mode = inputImageUrls.length > 0 ? "image-to-image" : "text-to-image";
    if (!prompt) throw new Error("提示词不能为空");
    if (!["text-to-image", "image-to-image"].includes(payload.mode)) throw new Error("绘图模式无效");

    const count = Math.min(Math.max(Math.floor(payload.count || 1), 1), 8);
    const size = normalizeSize(payload.size);
    const { width, height } = dimensionsFromSize(size);
    const model = payload.model || settings.model || DEFAULT_MODEL;
    if (isNanoBananaModel(model) && inputImageUrls.length > MAX_NANO_BANANA_REFERENCE_IMAGES) {
      throw new Error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
    }

    const created: DrawJob[] = [];
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["folders", "jobs"], "readwrite");
      const folderReq = transaction.objectStore("folders").get(folderId);
      const jobStore = transaction.objectStore("jobs");
      let folderExists = true;

      folderReq.onsuccess = () => {
        if (!folderReq.result) {
          folderExists = false;
          return;
        }

        const folderJobsReq = jobStore.index("folderId").getAll(folderId);
        folderJobsReq.onsuccess = () => {
          const folderJobs = (folderJobsReq.result || []) as DrawJob[];
          const baseOrderIndex = folderJobs.reduce((max, job) => Math.max(max, job.orderIndex), -1) + 1;
          const now = nowIso();

          for (let index = 0; index < count; index += 1) {
            const job: DrawJob = {
              id: createId(),
              folderId,
              mode,
              status: "pending",
              prompt,
              negativePrompt: "",
              inputImageUrl: inputImageUrls[0],
              inputImageUrls,
              width,
              height,
              size,
              count: 1,
              strength: payload.strength,
              thinking: payload.thinking || "high",
              model,
              imageSize: supportsNanoBananaImageSize(model) ? normalizeNanoImageSize(payload.imageSize) : undefined,
              orderIndex: baseOrderIndex + index,
              posX: 0,
              posY: 0,
              hasCustomPosition: false,
              createdAt: now,
              updatedAt: now
            };

            created.push(job);
            jobStore.add(job);
          }
        };
      };
      folderReq.onerror = () => reject(folderReq.error);
      transaction.oncomplete = () => {
        if (folderExists) resolve();
        else reject(new Error("文件夹不存在"));
      };
      transaction.onerror = () => reject(transaction.error);
    });

    broadcastStateUpdate(folderId);
    void processQueue();
    return created;
  },

  retryJob: async (jobId: string): Promise<DrawJob> => {
    const job = await ensureJob(jobId);
    if (!["completed", "failed"].includes(job.status)) {
      throw new Error("Only completed or failed jobs can be redrawn");
    }

    const updated = await updateJob(jobId, {
      status: "pending",
      errorMessage: undefined,
      provider: undefined,
      remoteTaskId: undefined,
      remoteStatus: undefined,
      submitTime: undefined,
      queryUrl: undefined,
      queueOwnerId: undefined,
      leaseExpiresAt: undefined,
      startedAt: undefined,
      completedAt: undefined
    });
    void processQueue();
    return updated;
  },

  updateJobPosition: async (jobId: string, posX: number, posY: number): Promise<DrawJob> =>
    updateJob(jobId, {
      posX,
      posY,
      hasCustomPosition: true
    }),

  reorderJobs: async (folderId: string, orderedIds: string[]): Promise<DrawJob[]> => {
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    const db = await openDb();
    const updatedJobs = await new Promise<DrawJob[]>((resolve, reject) => {
      const transaction = db.transaction(["folders", "jobs"], "readwrite");
      const folderReq = transaction.objectStore("folders").get(folderId);
      const jobStore = transaction.objectStore("jobs");
      let folderExists = true;
      let nextJobs: DrawJob[] = [];

      folderReq.onsuccess = () => {
        if (!folderReq.result) {
          folderExists = false;
          return;
        }

        const jobsReq = jobStore.index("folderId").getAll(folderId);
        jobsReq.onsuccess = () => {
          nextJobs = ((jobsReq.result || []) as DrawJob[]).map((job) => {
            if (!orderMap.has(job.id)) return job;
            const updatedJob: DrawJob = {
              ...job,
              orderIndex: orderMap.get(job.id) ?? job.orderIndex,
              updatedAt: nowIso()
            };
            jobStore.put(updatedJob);
            return updatedJob;
          });
        };
      };
      folderReq.onerror = () => reject(folderReq.error);
      transaction.oncomplete = () => {
        if (folderExists) resolve(sortJobs(nextJobs));
        else reject(new Error("文件夹不存在"));
      };
      transaction.onerror = () => reject(transaction.error);
    });

    broadcastStateUpdate(folderId);
    return updatedJobs;
  },

  uploadImage: async (file: File) => ({
    url: await uploadImageToHost(file),
    originalName: file.name
  }),

  getImageProviderSettings: async (): Promise<ImageProviderSettings> => {
    const settings = await getSettings();
    return {
      baseUrl: settings.baseUrl || DEFAULT_BASE_URL,
      model: settings.model || DEFAULT_MODEL,
      hasApiKey: Boolean(settings.apiKey),
      apiKeyMasked: maskSecret(settings.apiKey)
    };
  },

  updateImageProviderSettings: async (payload: UpdateImageProviderSettingsPayload): Promise<ImageProviderSettings> => {
    const settings = await getSettings();

    if (payload.baseUrl !== undefined) {
      const baseUrl = payload.baseUrl.trim() || DEFAULT_BASE_URL;
      try {
        const parsed = new URL(baseUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        throw new Error("Base URL is invalid");
      }
      settings.baseUrl = baseUrl || DEFAULT_BASE_URL;
    }

    if (payload.model !== undefined) {
      settings.model = payload.model.trim() || DEFAULT_MODEL;
    }

    if (payload.clearApiKey) {
      settings.apiKey = "";
    } else if (payload.apiKey?.trim()) {
      settings.apiKey = payload.apiKey.trim();
    }

    await saveSettings(settings);
    return {
      baseUrl: settings.baseUrl || DEFAULT_BASE_URL,
      model: settings.model || DEFAULT_MODEL,
      hasApiKey: Boolean(settings.apiKey),
      apiKeyMasked: maskSecret(settings.apiKey)
    };
  }
};
