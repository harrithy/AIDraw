import type { DrawJob, GeneratedAsset } from "../types";
import { getDuomiCapability } from "./duomiCapabilities";
import { resolveJobSettings } from "./jobCredentials";
import { getJobAssetKind, getJobOutputImages } from "./jobImages";
import { getTaskTimeoutMinutes } from "./jobQueuePolicy";
import { getProviderForJob, getRequiredApiProvider } from "./providers/providerRegistry";
import type { ProviderTaskResult } from "./providers/types";
import { JOB_STORE, openDb } from "./storage/database";
import { ensureJob, updateOwnedJob } from "./storage/entities";
import { nowIso, sortJobs } from "./storage/helpers";
import { getSettings } from "./storage/settings";
import { broadcastStateUpdate } from "./storage/stateSync";

export const MAX_CONCURRENT_JOBS = 30;
const TASK_POLL_INTERVAL_MS = 10 * 1000;
const JOB_LEASE_MS = 90 * 1000;
const MAX_CONSECUTIVE_QUERY_FAILURES = 5;
const QUERY_RETRY_BASE_MS = 2 * 1000;
const QUERY_RETRY_MAX_MS = 30 * 1000;

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
  return (
    Number.isFinite(startedAtMs) &&
    Date.now() - startedAtMs > getTaskTimeoutMinutes(job) * 60 * 1000
  );
};

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const errorMessageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error || "远程任务查询失败");

const queryRetryDelay = (attempt: number) =>
  Math.min(QUERY_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), QUERY_RETRY_MAX_MS);

const isAmbiguousSubmissionError = (error: unknown) => {
  const message = errorMessageOf(error).toLowerCase();
  return ["超时", "网络", "cors", "failed to fetch", "network", "timeout", "aborted"].some(
    (keyword) => message.includes(keyword)
  );
};

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
  let consecutiveQueryFailures = 0;
  try {
    while (true) {
      let freshJob = await ensureJob(job.id);
      if (freshJob.status !== "running" || freshJob.queueOwnerId !== queueOwnerId) return;
      if (isTaskTimedOut(freshJob)) {
        throw new Error(`任务轮询超时，已等待 ${getTaskTimeoutMinutes(freshJob)} 分钟`);
      }

      const renewedJob = await updateOwnedJob(
        job.id,
        queueOwnerId,
        { leaseExpiresAt: leaseExpiryIso() },
        false
      );
      if (!renewedJob) return;
      freshJob = renewedJob;

      const currentSettings = await getSettings();
      const { providerId, provider } = getProviderForJob(freshJob, currentSettings);
      const requiredApiProvider = getRequiredApiProvider(providerId);
      const settings = resolveJobSettings(freshJob, currentSettings, requiredApiProvider);
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
      let results: ProviderTaskResult[] = [];
      let hasTerminalRemoteResult = false;
      const partialErrors: string[] = [];
      try {
        if (immediateResult || taskIds.length <= 1) {
          results = immediateResult
            ? [immediateResult]
            : await Promise.all(taskIds.map((id) => provider.queryTask(id, freshJob, settings)));
          consecutiveQueryFailures = 0;
          const failedResult = results.find((result) => result.state === "error");
          if (failedResult?.state === "error") {
            hasTerminalRemoteResult = true;
            throw new Error(failedResult.errorMessage);
          }
        } else {
          // 多任务逐个容忍失败：只要仍有成功或进行中的任务就继续正常流程。
          const settled = await Promise.allSettled(
            taskIds.map((id) => provider.queryTask(id, freshJob, settings))
          );
          results = [];
          const requestErrors: string[] = [];
          for (const item of settled) {
            if (item.status === "rejected") {
              requestErrors.push(errorMessageOf(item.reason));
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
          // 请求异常不等于远程任务失败；即使其他子任务已成功，也要继续查询以免丢失结果。
          if (requestErrors.length > 0) {
            throw new Error(requestErrors.join("；"));
          }
          consecutiveQueryFailures = 0;
          if (!hasUsableResult) {
            hasTerminalRemoteResult = partialErrors.length > 0;
            throw new Error(
              partialErrors.length > 0 ? partialErrors.join("；") : "远程任务已结束，但没有可保存的结果"
            );
          }
        }
      } catch (queryError) {
        // Provider 明确返回 error 状态属于任务终态，不应继续查询。
        if (hasTerminalRemoteResult) throw queryError;

        consecutiveQueryFailures += 1;
        if (consecutiveQueryFailures >= MAX_CONSECUTIVE_QUERY_FAILURES) throw queryError;

        const retryDelay = queryRetryDelay(consecutiveQueryFailures);
        const retryingJob = await updateOwnedJob(job.id, queueOwnerId, {
          remoteStatus: "tracking_retry",
          errorMessage: `远程状态查询暂时失败，正在第 ${consecutiveQueryFailures} 次重试：${errorMessageOf(queryError)}`,
          leaseExpiresAt: leaseExpiryIso()
        });
        if (!retryingJob) return;
        await delay(retryDelay);
        continue;
      }
      if (results.some((result) => result.state === "pending" || result.state === "running")) {
        const remoteStatus = results.some((result) => result.state === "running") ? "running" : "pending";
        const waitingJob = await updateOwnedJob(job.id, queueOwnerId, {
          remoteStatus,
          errorMessage: undefined,
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
    const latestJob = await ensureJob(job.id).catch(() => undefined);
    const hasRemoteTask = Boolean(latestJob?.remoteTaskId || latestJob?.remoteTaskIds?.length);
    const submissionUnknown =
      !hasRemoteTask && latestJob?.remoteStatus === "submitting" && isAmbiguousSubmissionError(error);
    const originalMessage = errorMessageOf(error);
    const errorMessage = hasRemoteTask
      ? `${originalMessage}。远程任务可能仍在运行，可点击重试恢复追踪，不会重新提交`
      : submissionUnknown
        ? `${originalMessage}。提交结果未知，为避免重复扣费已停止自动重试，请先到远程平台确认`
        : originalMessage;

    await updateOwnedJob(job.id, queueOwnerId, {
      status: "failed",
      remoteStatus: hasRemoteTask ? "tracking_interrupted" : submissionUnknown ? "submission_unknown" : "error",
      errorMessage,
      completedAt: nowIso(),
      queueOwnerId: undefined,
      leaseExpiresAt: undefined
    }).catch(() => undefined);
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
          const hasRemoteTask = Boolean(job.remoteTaskId || job.remoteTaskIds?.length);
          store.put({
            ...job,
            status: "failed",
            remoteStatus: hasRemoteTask ? "tracking_interrupted" : "submission_unknown",
            errorMessage: hasRemoteTask
              ? `任务轮询超时，已等待 ${getTaskTimeoutMinutes(job)} 分钟；远程任务可能仍在运行，可点击重试恢复追踪`
              : `任务提交状态未知，为避免重复计费未自动重试`,
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
