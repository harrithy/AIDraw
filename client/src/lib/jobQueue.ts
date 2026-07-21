import type { DrawJob } from "../types";
import { getJobOutputImages } from "./jobImages";
import { getProvider, getRequiredApiProvider, resolveProviderId } from "./providers/providerRegistry";
import { JOB_STORE, openDb } from "./storage/database";
import { ensureJob, updateOwnedJob } from "./storage/entities";
import { nowIso, sortJobs } from "./storage/helpers";
import { getSettings } from "./storage/settings";
import { broadcastStateUpdate } from "./storage/stateSync";

export const MAX_CONCURRENT_JOBS = 10;
const TASK_TIMEOUT_MINUTES = 30;
const TASK_TIMEOUT_MS = TASK_TIMEOUT_MINUTES * 60 * 1000;
const TASK_POLL_INTERVAL_MS = 10 * 1000;
const JOB_LEASE_MS = 90 * 1000;

const activeJobs = new Set<string>();
const queueOwnerId =
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

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

/** 提交单个任务并持续轮询远程平台，直到任务结束或超时。 */
const executeJobBackground = async (job: DrawJob) => {
  try {
    while (true) {
      let freshJob = await ensureJob(job.id);
      if (freshJob.status !== "running" || freshJob.queueOwnerId !== queueOwnerId) return;
      if (isTaskTimedOut(freshJob)) {
        throw new Error(`任务轮询超时，已等待 ${TASK_TIMEOUT_MINUTES} 分钟`);
      }

      const renewedJob = await updateOwnedJob(
        job.id,
        queueOwnerId,
        { leaseExpiresAt: leaseExpiryIso() },
        false
      );
      if (!renewedJob) return;
      freshJob = renewedJob;

      const settings = await getSettings();
      const providerId = resolveProviderId(freshJob, settings);
      if (providerId !== "mock" && !settings.apiKey) {
        throw new Error("恢复远程任务需要原 API Key，请重新配置后再继续");
      }

      const requiredApiProvider = getRequiredApiProvider(providerId);
      if (requiredApiProvider && settings.providerId !== requiredApiProvider) {
        throw new Error(
          `该任务需要 ${requiredApiProvider === "grsai" ? "Grsai" : "多米API"} 的 API Key，请切换后重试`
        );
      }
      const provider = getProvider(providerId);

      let taskId = freshJob.remoteTaskId;
      if (!taskId) {
        const preparedJob = await updateOwnedJob(job.id, queueOwnerId, {
          provider: providerId,
          remoteStatus: "submitting",
          submitTime: freshJob.submitTime || nowIso(),
          leaseExpiresAt: leaseExpiryIso()
        });
        if (!preparedJob) return;

        const createdTask = await provider.createTask(preparedJob, settings);
        const submittedJob = await updateOwnedJob(job.id, queueOwnerId, {
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
        const waitingJob = await updateOwnedJob(job.id, queueOwnerId, {
          remoteStatus: result.state,
          leaseExpiresAt: leaseExpiryIso()
        });
        if (!waitingJob) return;
        await delay(TASK_POLL_INTERVAL_MS);
        continue;
      }
      if (result.state === "error") throw new Error(result.errorMessage);

      const latestJob = await ensureJob(job.id);
      await updateOwnedJob(job.id, queueOwnerId, {
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
    await updateOwnedJob(job.id, queueOwnerId, {
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

/** 在全局队列锁内恢复孤儿任务并领取新的待处理任务。 */
const runQueueLocked = async () => {
  const db = await openDb();
  const claimedJobs: DrawJob[] = [];
  const changedFolderIds = new Set<string>();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    const store = transaction.objectStore(JOB_STORE);
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
          if (job.queueOwnerId === queueOwnerId && !activeJobs.has(job.id)) claimedJobs.push(job);
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

      const slots = Math.max(0, MAX_CONCURRENT_JOBS - runningCount);
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

/** 触发队列调度；支持 Web Locks 时可避免多个标签页同时抢占任务。 */
export const processQueue = async () => {
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
