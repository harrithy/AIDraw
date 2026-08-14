import type { DrawJob, GeneratedAsset } from "../types";
import { getDuomiCapability } from "./duomiCapabilities";
import { getJobAssetKind, getJobOutputImages } from "./jobImages";
import { getProviderForJob, getRequiredApiProvider } from "./providers/providerRegistry";
import type { ProviderTaskResult } from "./providers/types";
import { JOB_STORE, openDb } from "./storage/database";
import { ensureJob, updateOwnedJob } from "./storage/entities";
import { nowIso, sortJobs } from "./storage/helpers";
import { getSettings } from "./storage/settings";
import { broadcastStateUpdate } from "./storage/stateSync";

export const MAX_CONCURRENT_JOBS = 30;
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

const normalizeSucceededAssets = (
  result: Extract<ProviderTaskResult, { state: "succeeded" }>,
  job: DrawJob
): GeneratedAsset[] => {
  const assets = (result.assets ?? []).filter(
    (asset) => Boolean(asset.url?.trim()) || Boolean(asset.text?.trim()) || asset.data !== undefined
  );
  if (assets.length > 0) return assets;
  return result.imageUrl?.trim()
    ? [{
        kind: getJobAssetKind(job, result.imageUrl),
        url: result.imageUrl.trim()
      }]
    : [];
};

/** 提交单个任务并持续轮询远程平台，直到任务结束或超时。 */
export const executeJobBackground = async (job: DrawJob) => {
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
      const { providerId, provider } = getProviderForJob(freshJob, settings);
      if (providerId !== "mock" && !settings.apiKey) {
        throw new Error("恢复远程任务需要原 API Key，请重新配置后再继续");
      }

      const requiredApiProvider = getRequiredApiProvider(providerId);
      if (requiredApiProvider && settings.providerId !== requiredApiProvider) {
        throw new Error(
          `该任务需要 ${requiredApiProvider === "grsai" ? "Grsai" : "多米API"} 的 API Key，请切换后重试`
        );
      }
      let taskId = freshJob.remoteTaskId;
      let immediateResult: ProviderTaskResult | undefined;
      if (!taskId) {
        const preparedJob = await updateOwnedJob(job.id, queueOwnerId, {
          provider: providerId,
          remoteStatus: "submitting",
          submitTime: freshJob.submitTime || nowIso(),
          leaseExpiresAt: leaseExpiryIso()
        });
        if (!preparedJob) return;

        const createdTask = await provider.createTask(preparedJob, settings);
        const remoteTaskIds = createdTask.taskIds?.length
          ? createdTask.taskIds
          : createdTask.taskId
            ? [createdTask.taskId]
            : [];
        const submittedJob = await updateOwnedJob(job.id, queueOwnerId, {
          remoteTaskId: createdTask.taskId,
          remoteTaskIds,
          queryUrl: createdTask.queryUrl,
          provider: providerId,
          remoteStatus: createdTask.result?.state ?? "pending",
          leaseExpiresAt: leaseExpiryIso()
        });
        if (!submittedJob) return;

        // 同步接口在 createTask 内就返回最终结果，立即完成保存，避免刷新页面丢失结果。
        if (createdTask.result?.state === "succeeded") {
          const syncAssets = normalizeSucceededAssets(createdTask.result, submittedJob);
          const syncPrimaryAsset = syncAssets.find(
            (asset) => asset.kind === "image" || asset.kind === "video"
          );
          const syncPrimaryUrl = syncPrimaryAsset?.url?.trim();
          await updateOwnedJob(job.id, queueOwnerId, {
            status: "completed",
            remoteStatus: "succeeded",
            outputImageUrl: syncPrimaryUrl ?? submittedJob.outputImageUrl,
            outputImageUrls: syncPrimaryUrl
              ? [...getJobOutputImages(submittedJob), syncPrimaryUrl]
              : submittedJob.outputImageUrls,
            outputAssets: syncAssets,
            outputText: createdTask.result.text?.trim() || undefined,
            outputData: createdTask.result.data,
            errorMessage: undefined,
            completedAt: nowIso(),
            queueOwnerId: undefined,
            leaseExpiresAt: undefined
          });
          return;
        }

        freshJob = submittedJob;
        taskId = createdTask.taskId;
        immediateResult = createdTask.result;
      } else if (job.capabilityId && getDuomiCapability(job.capabilityId)?.query.strategy === "none") {
        // 同步能力任务恢复：结果只在 createTask 时返回，无法通过 queryTask 补查。
        if (
          freshJob.outputAssets?.length ||
          freshJob.outputText !== undefined ||
          freshJob.outputData !== undefined
        ) {
          await updateOwnedJob(job.id, queueOwnerId, {
            status: "completed",
            remoteStatus: "succeeded",
            completedAt: nowIso(),
            queueOwnerId: undefined,
            leaseExpiresAt: undefined
          });
          return;
        }
        throw new Error("同步任务的结果未保存成功，为避免重复计费请重新提交该能力任务");
      }

      const taskIds = freshJob.remoteTaskIds?.length ? freshJob.remoteTaskIds : taskId ? [taskId] : [];
      let results: ProviderTaskResult[];
      const partialErrors: string[] = [];
      if (immediateResult || taskIds.length <= 1) {
        // 单任务保持原有语义：查询抛异常或返回 error 状态时直接失败。
        results = immediateResult
          ? [immediateResult]
          : await Promise.all(taskIds.map((id) => provider.queryTask(id, freshJob, settings)));
        const failedResult = results.find((result) => result.state === "error");
        if (failedResult?.state === "error") throw new Error(failedResult.errorMessage);
      } else {
        // 多任务逐个容忍失败：只要仍有成功或进行中的任务就继续正常流程。
        const settled = await Promise.allSettled(
          taskIds.map((id) => provider.queryTask(id, freshJob, settings))
        );
        results = [];
        for (const item of settled) {
          if (item.status === "rejected") {
            partialErrors.push(item.reason instanceof Error ? item.reason.message : String(item.reason));
          } else if (item.value.state === "error") {
            partialErrors.push(item.value.errorMessage);
          } else {
            results.push(item.value);
          }
        }
        const hasUsableResult = results.some(
          (result) =>
            result.state === "succeeded" || result.state === "pending" || result.state === "running"
        );
        if (!hasUsableResult) {
          throw new Error(
            partialErrors.length > 0 ? partialErrors.join("；") : "远程任务已结束，但没有可保存的结果"
          );
        }
      }
      if (results.some((result) => result.state === "pending" || result.state === "running")) {
        const remoteStatus = results.some((result) => result.state === "running") ? "running" : "pending";
        const waitingJob = await updateOwnedJob(job.id, queueOwnerId, {
          remoteStatus,
          leaseExpiresAt: leaseExpiryIso()
        });
        if (!waitingJob) return;
        await delay(TASK_POLL_INTERVAL_MS);
        continue;
      }

      const succeededResults = results.filter(
        (result): result is Extract<typeof result, { state: "succeeded" }> => result.state === "succeeded"
      );
      if (succeededResults.length === 0) throw new Error("远程任务已结束，但没有可保存的结果");
      const assets = succeededResults.flatMap((result) => normalizeSucceededAssets(result, freshJob));
      const primaryAsset = assets.find((asset) => asset.kind === "image" || asset.kind === "video");
      const primaryUrl = primaryAsset?.url?.trim();
      const text = succeededResults.map((result) => result.text?.trim()).filter(Boolean).join("\n\n") || undefined;
      const data = succeededResults.length === 1
        ? succeededResults[0]?.data
        : succeededResults.map((result) => result.data).filter((value) => value !== undefined);
      // 部分任务失败时把失败消息一并保存，无失败时保持原数据形态不变。
      const savedData = partialErrors.length > 0 ? { results: data, partialErrors } : data;

      const latestJob = await ensureJob(job.id);
      await updateOwnedJob(job.id, queueOwnerId, {
        status: "completed",
        remoteStatus: "succeeded",
        outputImageUrl: primaryUrl ?? latestJob.outputImageUrl,
        outputImageUrls: primaryUrl ? [...getJobOutputImages(latestJob), primaryUrl] : latestJob.outputImageUrls,
        outputAssets: assets,
        outputText: text,
        outputData: savedData,
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

        if (!job.remoteTaskId && !job.remoteTaskIds?.length) {
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
