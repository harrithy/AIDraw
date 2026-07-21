import type { CreateJobPayload, DrawJob, DrawSize, NanoImageSize } from "../../types";
import {
  MAX_NANO_BANANA_REFERENCE_IMAGES,
  isGptImageVipModel,
  isNanoBananaModel,
  supportsNanoBananaImageSize
} from "../imageModels";
import { dimensionsFromSize } from "../imageDimensions";
import { processQueue } from "../jobQueue";
import { FOLDER_STORE, JOB_STORE, openDb } from "../storage/database";
import { ensureFolder, ensureJob, updateJob } from "../storage/entities";
import { createId, nowIso, sortJobs } from "../storage/helpers";
import { DEFAULT_MODEL, getSettings } from "../storage/settings";
import { broadcastStateUpdate } from "../storage/stateSync";
import { assertRemoteImageUrls, normalizeNanoImageSize, normalizeSize } from "./jobValidation";

export const jobsApi = {
  listJobs: async (folderId: string): Promise<DrawJob[]> => {
    const db = await openDb();
    await ensureFolder(folderId);
    return new Promise<DrawJob[]>((resolve, reject) => {
      const transaction = db.transaction(JOB_STORE, "readonly");
      const req = transaction.objectStore(JOB_STORE).index("folderId").getAll(folderId);
      req.onsuccess = () => resolve(sortJobs(req.result || []));
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
    if (settings.apiKey && settings.providerId === "duomi" && inputImageUrls.length > 0) {
      assertRemoteImageUrls(inputImageUrls);
    }

    const mode = inputImageUrls.length > 0 ? "image-to-image" : "text-to-image";
    if (!prompt) throw new Error("提示词不能为空");
    if (!["text-to-image", "image-to-image"].includes(payload.mode)) throw new Error("绘图模式无效");

    const count = Math.min(Math.max(Math.floor(payload.count || 1), 1), 8);
    const model = payload.model || settings.model || DEFAULT_MODEL;
    const maxAspectRatio = settings.providerId === "grsai" && isGptImageVipModel(model) ? 3 : undefined;
    const size = normalizeSize(payload.size, maxAspectRatio);
    const { width, height } = dimensionsFromSize(size);
    if (
      settings.providerId === "duomi" &&
      isNanoBananaModel(model) &&
      inputImageUrls.length > MAX_NANO_BANANA_REFERENCE_IMAGES
    ) {
      throw new Error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
    }

    const created: DrawJob[] = [];
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([FOLDER_STORE, JOB_STORE], "readwrite");
      const folderReq = transaction.objectStore(FOLDER_STORE).get(folderId);
      const jobStore = transaction.objectStore(JOB_STORE);
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
              imageSize: supportsNanoBananaImageSize(model)
                ? normalizeNanoImageSize(payload.imageSize)
                : undefined,
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

  regenerateJobWithEdits: async (
    jobId: string,
    edits: {
      prompt: string;
      model: string;
      size: DrawSize;
      thinking: "high" | "medium" | "low";
      imageSize?: NanoImageSize;
      inputImageUrls: string[];
    }
  ): Promise<DrawJob> => {
    const job = await ensureJob(jobId);
    if (!["completed", "failed"].includes(job.status)) {
      throw new Error("Only completed or failed jobs can be redrawn");
    }

    const prompt = edits.prompt.trim();
    if (!prompt) throw new Error("提示词不能为空");

    const inputImageUrls = edits.inputImageUrls.map((url) => url.trim()).filter(Boolean);
    const settings = await getSettings();
    if (settings.apiKey && settings.providerId === "duomi" && inputImageUrls.length > 0) {
      assertRemoteImageUrls(inputImageUrls);
    }

    const model = edits.model || settings.model || DEFAULT_MODEL;
    if (
      settings.providerId === "duomi" &&
      isNanoBananaModel(model) &&
      inputImageUrls.length > MAX_NANO_BANANA_REFERENCE_IMAGES
    ) {
      throw new Error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
    }

    const mode = inputImageUrls.length > 0 ? "image-to-image" : "text-to-image";
    const maxAspectRatio = settings.providerId === "grsai" && isGptImageVipModel(model) ? 3 : undefined;
    const size = normalizeSize(edits.size, maxAspectRatio);
    const { width, height } = dimensionsFromSize(size);

    const updated = await updateJob(jobId, {
      mode,
      prompt,
      inputImageUrl: inputImageUrls[0],
      inputImageUrls,
      width,
      height,
      size,
      strength: mode === "image-to-image" ? 0.55 : undefined,
      thinking: edits.thinking || "high",
      model,
      imageSize: supportsNanoBananaImageSize(model)
        ? normalizeNanoImageSize(edits.imageSize)
        : undefined,
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
    updateJob(jobId, { posX, posY, hasCustomPosition: true }),

  reorderJobs: async (folderId: string, orderedIds: string[]): Promise<DrawJob[]> => {
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    const db = await openDb();
    const updatedJobs = await new Promise<DrawJob[]>((resolve, reject) => {
      const transaction = db.transaction([FOLDER_STORE, JOB_STORE], "readwrite");
      const folderReq = transaction.objectStore(FOLDER_STORE).get(folderId);
      const jobStore = transaction.objectStore(JOB_STORE);
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
  }
};
