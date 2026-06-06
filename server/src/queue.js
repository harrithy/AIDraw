import {
  listJobsByStatus,
  resetInterruptedJobs,
  setJobStatus
} from "./db.js";
import { generateDrawing } from "./imageProvider.js";

const MAX_CONCURRENT = 10;
let runningCount = 0;
const activeJobs = new Set();

const startJob = async (job) => {
  runningCount += 1;
  activeJobs.add(job.id);
  setJobStatus(job.id, {
    status: "running",
    errorMessage: null,
    startedAt: new Date().toISOString()
  });

  try {
    const latestJob = { ...job, status: "running" };
    const outputImageUrl = await generateDrawing(latestJob);
    setJobStatus(job.id, {
      status: "completed",
      outputImageUrl,
      errorMessage: null,
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    setJobStatus(job.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "绘图任务失败",
      completedAt: new Date().toISOString()
    });
  } finally {
    activeJobs.delete(job.id);
    runningCount -= 1;
    processQueue();
  }
};

export const processQueue = () => {
  const slots = MAX_CONCURRENT - runningCount;
  if (slots <= 0) return;

  const pendingJobs = listJobsByStatus("pending").slice(0, slots);
  pendingJobs.forEach((job) => {
    if (!activeJobs.has(job.id)) {
      void startJob(job);
    }
  });
};

export const initializeQueue = () => {
  resetInterruptedJobs();
  processQueue();
};

export const getQueueStats = () => ({
  maxConcurrent: MAX_CONCURRENT,
  running: runningCount,
  pending: listJobsByStatus("pending").length
});
