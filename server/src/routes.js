import express from "express";
import multer from "multer";
import { extname } from "node:path";
import { nanoid } from "nanoid";
import {
  createFolder,
  createJob,
  getFolder,
  getJob,
  getImageProviderSettings,
  getNextOrderIndex,
  listFolders,
  listJobsByFolder,
  originalsDir,
  reorderJobs,
  retryJob,
  updateFolder,
  updateImageProviderSettings,
  updateJobOrder,
  updateJobPosition
} from "./db.js";
import { getImageProviderStatus } from "./imageProvider.js";
import { getQueueStats, processQueue } from "./queue.js";

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, originalsDir);
    },
    filename: (_request, file, callback) => {
      const suffix = extname(file.originalname) || ".png";
      callback(null, `${nanoid(12)}${suffix}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const allowedThinking = new Set(["high", "medium", "low", "standard"]);

router.get("/health", (_request, response) => {
  response.json({
    ok: true,
    queue: getQueueStats(),
    imageProvider: getImageProviderStatus()
  });
});

router.get("/settings/image-provider", (_request, response) => {
  const settings = getImageProviderSettings();
  response.json({
    baseUrl: settings.baseUrl || "https://nowcoding.ai/v1",
    model: settings.model || "gpt-image-2",
    hasApiKey: settings.hasApiKey,
    apiKeyMasked: settings.apiKeyMasked
  });
});

router.patch("/settings/image-provider", (request, response) => {
  const baseUrl = request.body?.baseUrl;
  const model = request.body?.model;
  const apiKey = request.body?.apiKey;
  const clearApiKey = Boolean(request.body?.clearApiKey);

  if (baseUrl !== undefined) {
    try {
      const parsed = new URL(String(baseUrl));
      if (!["http:", "https:"].includes(parsed.protocol)) {
        response.status(400).json({ message: "Base URL must use http or https" });
        return;
      }
    } catch {
      response.status(400).json({ message: "Base URL is invalid" });
      return;
    }
  }

  const settings = updateImageProviderSettings({
    baseUrl,
    apiKey,
    model,
    clearApiKey
  });

  response.json({
    baseUrl: settings.baseUrl || "https://nowcoding.ai/v1",
    model: settings.model || "gpt-image-2",
    hasApiKey: settings.hasApiKey,
    apiKeyMasked: settings.apiKeyMasked
  });
});

router.get("/folders", (_request, response) => {
  response.json(listFolders());
});

router.post("/folders", (request, response) => {
  const name = String(request.body?.name ?? "").trim();
  if (!name) {
    response.status(400).json({ message: "文件夹名称不能为空" });
    return;
  }

  const now = new Date().toISOString();
  const folder = createFolder({ id: nanoid(12), name, now });
  response.status(201).json(folder);
});

router.get("/folders/:id", (request, response) => {
  const folder = getFolder(request.params.id);
  if (!folder) {
    response.status(404).json({ message: "文件夹不存在" });
    return;
  }
  response.json(folder);
});

router.patch("/folders/:id", (request, response) => {
  const folder = updateFolder(request.params.id, {
    name: request.body?.name,
    canvasZoom:
      request.body?.canvasZoom === undefined
        ? undefined
        : toNumber(request.body.canvasZoom, 1),
    canvasPanX:
      request.body?.canvasPanX === undefined
        ? undefined
        : toNumber(request.body.canvasPanX, 0),
    canvasPanY:
      request.body?.canvasPanY === undefined
        ? undefined
        : toNumber(request.body.canvasPanY, 0)
  });

  if (!folder) {
    response.status(404).json({ message: "文件夹不存在" });
    return;
  }
  response.json(folder);
});

router.get("/folders/:folderId/jobs", (request, response) => {
  const folder = getFolder(request.params.folderId);
  if (!folder) {
    response.status(404).json({ message: "文件夹不存在" });
    return;
  }
  response.json(listJobsByFolder(request.params.folderId));
});

router.post("/folders/:folderId/jobs", (request, response) => {
  const folder = getFolder(request.params.folderId);
  if (!folder) {
    response.status(404).json({ message: "文件夹不存在" });
    return;
  }

  const mode = request.body?.mode;
  const prompt = String(request.body?.prompt ?? "").trim();
  const width = Math.min(Math.max(toNumber(request.body?.width, 768), 256), 1024);
  const height = Math.min(Math.max(toNumber(request.body?.height, 768), 256), 1024);
  const count = Math.min(Math.max(Math.floor(toNumber(request.body?.count, 1)), 1), 8);
  const model = String(request.body?.model ?? "gpt-image-2").trim();
  const thinking = String(request.body?.thinking ?? "high").trim();
  const strength = toNumber(request.body?.strength, 0.55);
  const inputImageUrl = request.body?.inputImageUrl
    ? String(request.body.inputImageUrl)
    : undefined;

  if (!["text-to-image", "image-to-image"].includes(mode)) {
    response.status(400).json({ message: "绘图模式无效" });
    return;
  }

  if (!prompt) {
    response.status(400).json({ message: "提示词不能为空" });
    return;
  }

  if (mode === "image-to-image" && !inputImageUrl) {
    response.status(400).json({ message: "图生图需要先上传原图" });
    return;
  }

  if (!allowedThinking.has(thinking)) {
    response.status(400).json({ message: "Thinking must be high, medium, low, or standard" });
    return;
  }

  const now = new Date().toISOString();
  const created = [];

  for (let index = 0; index < count; index += 1) {
    created.push(
      createJob({
        id: nanoid(14),
        folderId: folder.id,
        mode,
        status: "pending",
        prompt,
        negativePrompt: "",
        inputImageUrl,
        width,
        height,
        count: 1,
        strength,
        thinking,
        model,
        orderIndex: getNextOrderIndex(folder.id),
        createdAt: now,
        updatedAt: now
      })
    );
  }

  processQueue();
  response.status(201).json(created);
});

router.get("/jobs/:jobId", (request, response) => {
  const job = getJob(request.params.jobId);
  if (!job) {
    response.status(404).json({ message: "任务不存在" });
    return;
  }
  response.json(job);
});

router.post("/jobs/:jobId/retry", (request, response) => {
  const existing = getJob(request.params.jobId);
  if (!existing) {
    response.status(404).json({ message: "Job not found" });
    return;
  }

  if (!["completed", "failed"].includes(existing.status)) {
    response.status(409).json({ message: "Only completed or failed jobs can be redrawn" });
    return;
  }

  const job = retryJob(request.params.jobId);
  processQueue();
  response.json(job);
});

/**
 * 🐱 更新卡片在画布上的自由拖拽位置
 * 主人拖完卡片后调用这个接口保存坐标喵~
 */
router.patch("/jobs/:jobId/position", (request, response) => {
  const posX = toNumber(request.body?.posX, 0);
  const posY = toNumber(request.body?.posY, 0);
  const hasCustomPosition = request.body?.hasCustomPosition !== false;

  const job = updateJobPosition(request.params.jobId, posX, posY, hasCustomPosition);
  if (!job) {
    response.status(404).json({ message: "任务不存在" });
    return;
  }
  response.json(job);
});

router.patch("/jobs/:jobId/order", (request, response) => {
  const orderIndex = Math.max(0, Math.floor(toNumber(request.body?.orderIndex, 0)));
  const job = updateJobOrder(request.params.jobId, orderIndex);
  if (!job) {
    response.status(404).json({ message: "任务不存在" });
    return;
  }
  response.json(job);
});

router.patch("/folders/:folderId/jobs/reorder", (request, response) => {
  const folder = getFolder(request.params.folderId);
  if (!folder) {
    response.status(404).json({ message: "文件夹不存在" });
    return;
  }

  const orderedIds = Array.isArray(request.body?.orderedIds)
    ? request.body.orderedIds.map(String)
    : [];

  if (orderedIds.length === 0) {
    response.status(400).json({ message: "排序列表不能为空" });
    return;
  }

  response.json(reorderJobs(folder.id, orderedIds));
});

router.post("/uploads/image", upload.single("image"), (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: "请选择图片文件" });
    return;
  }

  response.status(201).json({
    url: `/uploads/originals/${request.file.filename}`,
    originalName: request.file.originalname
  });
});

export default router;
