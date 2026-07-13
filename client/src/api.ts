import type {
  CreateJobPayload,
  DrawSize,
  DrawFolder,
  DrawJob,
  HealthPayload,
  ImageProviderSettings,
  NanoImageSize,
  UpdateImageProviderSettingsPayload
} from "./types";
import { getJobOutputImages } from "./lib/jobImages";
import {
  GPT_IMAGE_MODEL,
  MAX_NANO_BANANA_REFERENCE_IMAGES,
  NANO_BANANA_MODEL,
  isNanoBananaModel,
  supportsNanoBananaImageSize
} from "./lib/imageModels";

const DB_NAME = "aidraw-frontend";
const DB_VERSION = 1;
const STATE_STORE = "state";
const STATE_KEY = "app-state";
const MAX_CONCURRENT = 10;
const LEGACY_DEFAULT_BASE_URL = "https://nowcoding.ai/v1";
const DEFAULT_BASE_URL = "https://duomiapi.com";
const DEFAULT_MODEL = GPT_IMAGE_MODEL;
const DEFAULT_SIZE: DrawSize = "auto";
const DEFAULT_NANO_IMAGE_SIZE: NanoImageSize = "4K";
const DUOMI_API_PREFIX = "/v1";
const NANO_BANANA_API_PREFIX = "/api/gemini";
const IMAGE_UPLOAD_BASE_URL = "https://image.harrio.xyz";
const IMAGE_UPLOAD_PROXY_PATH = "/image-upload/upload";
const TASK_POLL_INTERVAL_MS = 10 * 1000;
const TASK_TIMEOUT_MINUTES = 30;
const TASK_TIMEOUT_MS = TASK_TIMEOUT_MINUTES * 60 * 1000;
const REQUEST_TIMEOUT_MS = 60 * 1000;

type StoredSettings = {
  baseUrl: string;
  model: string;
  apiKey: string;
};

type StoredState = {
  version: 1;
  folders: DrawFolder[];
  jobs: DrawJob[];
  settings: StoredSettings;
};

let dbPromise: Promise<IDBDatabase> | null = null;
let stateCache: StoredState | null = null;
const activeJobs = new Set<string>();

/**
 * 创建 ISO 时间戳字符串（当前时间）
 */
const nowIso = () => new Date().toISOString();

/**
 * 生成唯一 ID
 * 优先使用 crypto.randomUUID()（现代浏览器原生支持），
 * 不支持时回退到时间戳 + 随机字符串组合
 */
const createId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const openDb = () => {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 打开失败"));
  });

  return dbPromise;
};

const readStateRecord = async () => {
  const db = await openDb();
  return new Promise<StoredState | null>((resolve, reject) => {
    const transaction = db.transaction(STATE_STORE, "readonly");
    const request = transaction.objectStore(STATE_STORE).get(STATE_KEY);

    request.onsuccess = () => resolve((request.result as StoredState | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("读取本地数据失败"));
  });
};

const writeStateRecord = async (state: StoredState) => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STATE_STORE, "readwrite");
    const request = transaction.objectStore(STATE_STORE).put(state, STATE_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("保存本地数据失败"));
  });
};

const defaultState = (): StoredState => ({
  version: 1,
  folders: [],
  jobs: [],
  settings: {
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    apiKey: ""
  }
});

const loadState = async () => {
  if (stateCache) return stateCache;

  const stored = await readStateRecord();
  stateCache = stored ?? defaultState();
  let changed = !stored;

  if (stateCache.settings.baseUrl === LEGACY_DEFAULT_BASE_URL) {
    stateCache.settings.baseUrl = DEFAULT_BASE_URL;
    changed = true;
  }

  // 浏览器刷新后无法继续旧的 fetch，重置未完成的运行任务。
  stateCache.jobs = stateCache.jobs.map((job) => {
    if (job.status !== "running") return job;
    changed = true;
    return {
      ...job,
      status: "pending",
      startedAt: undefined,
      updatedAt: nowIso()
    };
  });

  if (changed) await writeStateRecord(stateCache);
  return stateCache;
};

const saveState = async () => {
  if (!stateCache) return;
  await writeStateRecord(stateCache);
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

const getNextOrderIndex = (state: StoredState, folderId: string) =>
  state.jobs
    .filter((job) => job.folderId === folderId)
    .reduce((max, job) => Math.max(max, job.orderIndex), -1) + 1;

const ensureFolder = (state: StoredState, folderId: string) => {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) throw new Error("文件夹不存在");
  return folder;
};

const ensureJob = (state: StoredState, jobId: string) => {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) throw new Error("任务不存在");
  return job;
};

const updateJob = async (jobId: string, patch: Partial<DrawJob>) => {
  const state = await loadState();
  state.jobs = state.jobs.map((job) =>
    job.id === jobId
      ? {
          ...job,
          ...patch,
          updatedAt: nowIso()
        }
      : job
  );
  await saveState();
  return ensureJob(state, jobId);
};

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
    throw new Error("多米API的参考图只支持公网 http(s) 图片 URL，不能直接发送本地图片或 data URL");
  }
};

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");

const hashText = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const paletteFromPrompt = (prompt: string) => {
  const hash = hashText(prompt);
  const hueA = hash % 360;
  const hueB = (hueA + 74 + (hash % 40)) % 360;
  const hueC = (hueA + 176 + (hash % 80)) % 360;

  return {
    a: `hsl(${hueA}, 70%, 46%)`,
    b: `hsl(${hueB}, 62%, 58%)`,
    c: `hsl(${hueC}, 68%, 30%)`
  };
};

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

const nanoAspectRatios = new Set<DrawSize>([
  "auto",
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
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

const normalizeNanoAspectRatio = (value: unknown): DrawSize => {
  const size = String(value ?? "").trim() as DrawSize;
  return nanoAspectRatios.has(size) ? size : DEFAULT_SIZE;
};

const normalizeNanoImageSize = (value: unknown): NanoImageSize => {
  if (value === "1K" || value === "2K" || value === "4K") return value;
  return DEFAULT_NANO_IMAGE_SIZE;
};

const dimensionsFromSize = (size: DrawSize) => {
  const fixedSize = /^(\d+)x(\d+)$/.exec(size);
  if (fixedSize) {
    const rawWidth = Number(fixedSize[1]);
    const rawHeight = Number(fixedSize[2]);
    const ratio = rawWidth / rawHeight;
    if (ratio >= 1) return { width: 1024, height: Math.round(1024 / ratio) };
    return { width: Math.round(1024 * ratio), height: 1024 };
  }

  const ratioSize = /^(\d+):(\d+)$/.exec(size);
  if (ratioSize) {
    const rawWidth = Number(ratioSize[1]);
    const rawHeight = Number(ratioSize[2]);
    const ratio = rawWidth / rawHeight;
    if (ratio >= 1) return { width: 1024, height: Math.round(1024 / ratio) };
    return { width: Math.round(1024 * ratio), height: 1024 };
  }

  return { width: 1024, height: 1024 };
};

const simulateDrawing = async (job: DrawJob) => {
  await new Promise((resolve) => window.setTimeout(resolve, 1100 + Math.floor(Math.random() * 900)));

  const { width, height } = dimensionsFromSize(normalizeSize(job.size));
  const palette = paletteFromPrompt(`${job.prompt}-${Date.now()}-${Math.random()}`);
  const modeLabel = job.mode === "image-to-image" ? "图生图" : "文生图";
  const prompt = escapeXml(job.prompt || "Untitled prompt");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${palette.a}"/>
      <stop offset="52%" stop-color="${palette.b}"/>
      <stop offset="100%" stop-color="${palette.c}"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.2"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" filter="url(#grain)" opacity="0.28"/>
  <circle cx="${width * 0.22}" cy="${height * 0.2}" r="${Math.min(width, height) * 0.24}" fill="rgba(255,255,255,0.2)"/>
  <circle cx="${width * 0.82}" cy="${height * 0.76}" r="${Math.min(width, height) * 0.32}" fill="rgba(0,0,0,0.18)"/>
  <path d="M ${width * 0.06} ${height * 0.75} C ${width * 0.26} ${height * 0.48}, ${width * 0.42} ${height * 0.94}, ${width * 0.62} ${height * 0.55} S ${width * 0.84} ${height * 0.4}, ${width * 0.96} ${height * 0.28}" fill="none" stroke="rgba(255,255,255,0.42)" stroke-width="${Math.max(6, width * 0.018)}" stroke-linecap="round"/>
  <rect x="${width * 0.08}" y="${height * 0.08}" width="${width * 0.84}" height="${height * 0.84}" rx="24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
  <text x="${width * 0.1}" y="${height * 0.18}" fill="white" font-family="Georgia, serif" font-size="${Math.max(24, width * 0.06)}" font-weight="700">${modeLabel}</text>
  <text x="${width * 0.1}" y="${height * 0.28}" fill="rgba(255,255,255,0.88)" font-family="Segoe UI, sans-serif" font-size="${Math.max(14, width * 0.03)}">Browser mock output</text>
  <foreignObject x="${width * 0.1}" y="${height * 0.38}" width="${width * 0.78}" height="${height * 0.28}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font: 600 ${Math.max(15, width * 0.032)}px 'Segoe UI', sans-serif; color: white; line-height: 1.35; word-break: break-word;">
      ${prompt}
    </div>
  </foreignObject>
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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

type DuomiCreateTaskResponse = {
  id?: string;
  task_id?: string;
  taskId?: string;
  data?: {
    id?: string;
    task_id?: string;
    taskId?: string;
  };
};

type DuomiTaskResponse = {
  id?: string;
  state?: string;
  data?: {
    images?: Array<{
      url?: string;
      file_name?: string;
    }>;
    description?: string;
  };
  progress?: number;
  error?: {
    message?: string;
  };
  message?: string;
};

type NanoBananaCreateTaskResponse = {
  code?: number;
  msg?: string;
  data?: {
    task_id?: string;
  };
};

type NanoBananaTaskResponse = {
  code?: number;
  msg?: string;
  data?: {
    task_id?: string;
    state?: "pending" | "running" | "succeeded" | "error";
    data?: {
      images?: Array<{
        url?: string;
        file_name?: string;
      }>;
      description?: string;
    };
    msg?: string;
    status?: string;
    action?: string;
  };
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getConfiguredBaseUrl = (settings: StoredSettings) =>
  (settings.baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");

const getDuomiEndpoint = (settings: StoredSettings, path: string) => {
  const configuredBaseUrl = getConfiguredBaseUrl(settings);
  const versionedBaseUrl = configuredBaseUrl.endsWith(DUOMI_API_PREFIX)
    ? configuredBaseUrl
    : `${configuredBaseUrl}${DUOMI_API_PREFIX}`;
  return `${versionedBaseUrl}${path}`;
};

const getNanoBananaEndpoint = (settings: StoredSettings, path: string) => {
  const configuredBaseUrl = getConfiguredBaseUrl(settings);
  const apiRoot = configuredBaseUrl.endsWith(DUOMI_API_PREFIX)
    ? configuredBaseUrl.slice(0, -DUOMI_API_PREFIX.length)
    : configuredBaseUrl;
  return `${apiRoot}${NANO_BANANA_API_PREFIX}${path}`;
};

const normalizeQuality = (value: DrawJob["thinking"]) => {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "high";
};

const fetchJson = async <T>(url: string, init: RequestInit, context: string) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `${context}失败：HTTP ${response.status}`));
    }
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${context}超时，请稍后重试`);
    }
    if (error instanceof TypeError) {
      throw new Error("浏览器直连多米API失败：可能是 CORS 限制、网络不可达，或 Base URL 无法从浏览器访问");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const extractTaskId = (payload: DuomiCreateTaskResponse | null) => {
  const taskId = payload?.id ?? payload?.task_id ?? payload?.taskId ?? payload?.data?.id ?? payload?.data?.task_id ?? payload?.data?.taskId;
  if (!taskId) throw new Error("多米API未返回任务 id");
  return taskId;
};

const extractTaskImageUrl = (payload: DuomiTaskResponse | null) => {
  const imageUrl = payload?.data?.images?.find((image) => typeof image.url === "string" && image.url.trim())?.url;
  if (!imageUrl) throw new Error("多米API任务已完成，但未返回图片地址");
  return imageUrl;
};

const assertNanoBananaSuccess = (
  payload: NanoBananaCreateTaskResponse | NanoBananaTaskResponse | null,
  context: string
) => {
  if (payload?.code !== 200) {
    throw new Error(getErrorMessage(payload, `${context}失败`));
  }
};

const extractNanoBananaTaskImageUrl = (payload: NanoBananaTaskResponse | null) => {
  const imageUrl = payload?.data?.data?.images?.find(
    (image) => typeof image.url === "string" && image.url.trim()
  )?.url;
  if (!imageUrl) throw new Error("NANO-BANANA 任务已完成，但未返回图片地址");
  return imageUrl;
};

const createDuomiTask = async (job: DrawJob, settings: StoredSettings) => {
  const inputImages = job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [];
  if (inputImages.length > 0) assertDuomiImageUrls(inputImages);

  const requestBody: Record<string, unknown> = {
    model: job.model || settings.model || DEFAULT_MODEL,
    prompt: job.prompt.trim(),
    size: normalizeSize(job.size),
    quality: normalizeQuality(job.thinking),
    oversea: false
  };

  if (inputImages.length > 0) {
    requestBody.image = inputImages;
  }

  const payload = await fetchJson<DuomiCreateTaskResponse>(
    getDuomiEndpoint(settings, "/images/generations"),
    {
      method: "POST",
      headers: {
        Authorization: settings.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    },
    "提交多米API图片生成任务"
  );

  return extractTaskId(payload);
};

const waitForDuomiTaskResult = async (taskId: string, settings: StoredSettings) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= TASK_TIMEOUT_MS) {
    const payload = await fetchJson<DuomiTaskResponse>(
      getDuomiEndpoint(settings, `/tasks/${encodeURIComponent(taskId)}`),
      {
        method: "GET",
        headers: {
          Authorization: settings.apiKey
        }
      },
      "查询多米API异步结果"
    );

    if (payload?.state === "succeeded") return extractTaskImageUrl(payload);
    if (payload?.state === "error") {
      throw new Error(getErrorMessage(payload, `多米API任务失败：${taskId}`));
    }

    await delay(TASK_POLL_INTERVAL_MS);
  }

  throw new Error(`多米API任务查询超时，已等待 ${TASK_TIMEOUT_MINUTES} 分钟`);
};

const callDuomiGeneration = async (job: DrawJob, settings: StoredSettings) => {
  const taskId = await createDuomiTask(job, settings);
  return waitForDuomiTaskResult(taskId, settings);
};

const createNanoBananaTask = async (job: DrawJob, settings: StoredSettings) => {
  const inputImages = job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [];
  if (inputImages.length > MAX_NANO_BANANA_REFERENCE_IMAGES) {
    throw new Error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
  }
  if (inputImages.length > 0) assertDuomiImageUrls(inputImages);

  const requestBody: Record<string, unknown> = {
    model: job.model || NANO_BANANA_MODEL,
    prompt: job.prompt.trim()
  };
  if (supportsNanoBananaImageSize(job.model)) {
    requestBody.image_size = normalizeNanoImageSize(job.imageSize);
  }
  const aspectRatio = normalizeNanoAspectRatio(job.size);
  if (aspectRatio !== "auto") requestBody.aspect_ratio = aspectRatio;

  const endpointPath = inputImages.length > 0 ? "/nano-banana-edit" : "/nano-banana";
  if (inputImages.length > 0) {
    requestBody.image_urls = inputImages;
  } else {
    requestBody.oversea = false;
  }

  const payload = await fetchJson<NanoBananaCreateTaskResponse>(
    getNanoBananaEndpoint(settings, endpointPath),
    {
      method: "POST",
      headers: {
        Authorization: settings.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    },
    inputImages.length > 0 ? "提交 NANO-BANANA 图生图任务" : "提交 NANO-BANANA 文生图任务"
  );

  assertNanoBananaSuccess(payload, "提交 NANO-BANANA 任务");
  const taskId = payload?.data?.task_id;
  if (!taskId) throw new Error("NANO-BANANA 未返回任务 id");
  return taskId;
};

const waitForNanoBananaTaskResult = async (taskId: string, settings: StoredSettings) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= TASK_TIMEOUT_MS) {
    const payload = await fetchJson<NanoBananaTaskResponse>(
      getNanoBananaEndpoint(settings, `/nano-banana/${encodeURIComponent(taskId)}`),
      {
        method: "GET",
        headers: {
          Authorization: settings.apiKey
        }
      },
      "查询 NANO-BANANA 任务状态"
    );

    assertNanoBananaSuccess(payload, "查询 NANO-BANANA 任务状态");
    const taskState = payload?.data?.state;
    if (taskState === "succeeded") return extractNanoBananaTaskImageUrl(payload);
    if (taskState === "error") {
      throw new Error(payload?.data?.msg?.trim() || getErrorMessage(payload, `NANO-BANANA 任务失败：${taskId}`));
    }
    if (taskState !== "pending" && taskState !== "running") {
      throw new Error("NANO-BANANA 查询结果缺少有效的任务状态");
    }

    await delay(TASK_POLL_INTERVAL_MS);
  }

  throw new Error(`NANO-BANANA 任务查询超时，已等待 ${TASK_TIMEOUT_MINUTES} 分钟`);
};

const callNanoBananaGeneration = async (job: DrawJob, settings: StoredSettings) => {
  const taskId = await createNanoBananaTask(job, settings);
  return waitForNanoBananaTaskResult(taskId, settings);
};

const generateDrawing = async (job: DrawJob) => {
  const state = await loadState();
  const settings = state.settings;

  if (settings.apiKey) {
    if (isNanoBananaModel(job.model)) return callNanoBananaGeneration(job, settings);
    return callDuomiGeneration(job, settings);
  }

  return simulateDrawing(job);
};

const startJob = async (job: DrawJob) => {
  activeJobs.add(job.id);
  await updateJob(job.id, {
    status: "running",
    errorMessage: undefined,
    startedAt: nowIso()
  });

  try {
    const outputImageUrl = await generateDrawing({ ...job, status: "running" });
    const latestState = await loadState();
    const latestJob = ensureJob(latestState, job.id);
    await updateJob(job.id, {
      status: "completed",
      outputImageUrl,
      outputImageUrls: [...getJobOutputImages(latestJob), outputImageUrl],
      errorMessage: undefined,
      completedAt: nowIso()
    });
  } catch (error) {
    await updateJob(job.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "绘图任务失败",
      completedAt: nowIso()
    });
  } finally {
    activeJobs.delete(job.id);
    void processQueue();
  }
};

const processQueue = async () => {
  const state = await loadState();
  const runningCount = state.jobs.filter((job) => job.status === "running").length;
  const slots = MAX_CONCURRENT - runningCount;
  if (slots <= 0) return;

  const pendingJobs = sortJobs(state.jobs.filter((job) => job.status === "pending")).slice(0, slots);
  pendingJobs.forEach((job) => {
    if (!activeJobs.has(job.id)) void startJob(job);
  });
};

/**
 * 前端 API 层 — 所有数据操作和业务逻辑的统一入口
 *
 * 实现方案：使用 IndexedDB 作为本地持久化存储 + 浏览器内模拟后端逻辑
 * 对上层组件暴露与远程 API 一致的 Promise 接口，方便将来切换到真实后端
 *
 * 关键设计决策：
 * - 纯前端实现：所有"多米API"调用在前端完成，服务端仅作为反向代理
 * - 主动轮询：定时检查 pending 任务，逐个提交到绘图 API
 * - Mock 模式：未配置 API Key 时用 SVG 占位图模拟生成结果
 */
export const api = {
  /**
   * 健康检查 — 返回队列状态和 API 配置信息
   * 同时触发队列处理（检查是否有 pending 任务可以开始执行）
   * @returns 服务健康状态、队列统计、图像服务配置
   */
  health: async (): Promise<HealthPayload> => {
    const state = await loadState();
    void processQueue();

    return {
      ok: true,
      queue: {
        maxConcurrent: MAX_CONCURRENT,
        running: state.jobs.filter((job) => job.status === "running").length,
        pending: state.jobs.filter((job) => job.status === "pending").length
      },
      imageProvider: {
        textToImage: state.settings.apiKey ? "duomi" : "mock",
        imageToImage: state.settings.apiKey ? "duomi" : "mock",
        hasDuomiKey: Boolean(state.settings.apiKey),
        duomiBaseUrl: state.settings.baseUrl || DEFAULT_BASE_URL,
        duomiModel: state.settings.model || DEFAULT_MODEL,
        apiKeyMasked: maskSecret(state.settings.apiKey),
        usesSavedConfig: Boolean(state.settings.apiKey || state.settings.baseUrl || state.settings.model)
      }
    };
  },

  /**
   * 列出所有文件夹，按创建时间倒序排列
   */
  listFolders: async () => {
    const state = await loadState();
    return sortFolders(state.folders);
  },

  /**
   * 创建新文件夹
   * @param name - 文件夹名称（会自动 trim）
   * @returns 新创建的文件夹对象
   */
  createFolder: async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("文件夹名称不能为空");

    const state = await loadState();
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

    state.folders = [folder, ...state.folders];
    await saveState();
    return folder;
  },

  /**
   * 更新文件夹属性（名称或画布状态）
   * @param id - 文件夹 ID
   * @param patch - 要更新的字段（部分更新）
   * @returns 更新后的文件夹对象
   */
  updateFolder: async (
    id: string,
    patch: Partial<Pick<DrawFolder, "name" | "canvasZoom" | "canvasPanX" | "canvasPanY">>
  ) => {
    const state = await loadState();
    const folder = ensureFolder(state, id);
    const updated: DrawFolder = {
      ...folder,
      ...patch,
      updatedAt: nowIso()
    };

    state.folders = state.folders.map((item) => (item.id === id ? updated : item));
    await saveState();
    return updated;
  },

  /**
   * 删除文件夹及其下的所有任务
   * @param id - 文件夹 ID
   */
  deleteFolder: async (id: string) => {
    const state = await loadState();
    ensureFolder(state, id);
    state.folders = state.folders.filter((item) => item.id !== id);
    state.jobs = state.jobs.filter((job) => job.folderId !== id);
    await saveState();
  },

  /**
   * 列出指定文件夹下的所有任务，按 orderIndex 排序
   * @param folderId - 文件夹 ID
   */
  listJobs: async (folderId: string) => {
    const state = await loadState();
    ensureFolder(state, folderId);
    return sortJobs(state.jobs.filter((job) => job.folderId === folderId));
  },

  /**
   * 批量创建绘图任务
   * 当配置了 API Key 且使用图生图模式时，会校验参考图 URL 是否为公网可访问地址
   * 创建后自动触发队列处理
   * @param folderId - 目标文件夹 ID
   * @param payload - 任务创建参数
   * @returns 新创建的任务列表
   */
  createJobs: async (folderId: string, payload: CreateJobPayload) => {
    const state = await loadState();
    const folder = ensureFolder(state, folderId);
    const prompt = payload.prompt.trim();
    const inputImageUrls = payload.inputImageUrls?.length
      ? payload.inputImageUrls
      : payload.inputImageUrl
        ? [payload.inputImageUrl]
        : [];
    if (state.settings.apiKey && inputImageUrls.length > 0) assertDuomiImageUrls(inputImageUrls);

    const mode = inputImageUrls.length > 0 ? "image-to-image" : "text-to-image";
    if (!prompt) throw new Error("提示词不能为空");
    if (!["text-to-image", "image-to-image"].includes(payload.mode)) throw new Error("绘图模式无效");

    const count = Math.min(Math.max(Math.floor(payload.count || 1), 1), 8);
    const size = normalizeSize(payload.size);
    const { width, height } = dimensionsFromSize(size);
    const model = payload.model || state.settings.model || DEFAULT_MODEL;
    if (isNanoBananaModel(model) && inputImageUrls.length > MAX_NANO_BANANA_REFERENCE_IMAGES) {
      throw new Error(`NANO-BANANA 最多支持 ${MAX_NANO_BANANA_REFERENCE_IMAGES} 张参考图`);
    }
    const now = nowIso();
    const created: DrawJob[] = [];
    const baseOrderIndex = getNextOrderIndex(state, folder.id);

    for (let index = 0; index < count; index += 1) {
      const job: DrawJob = {
        id: createId(),
        folderId: folder.id,
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
      state.jobs.push(job);
    }

    await saveState();
    void processQueue();
    return created;
  },

  /**
   * 重试已完成或失败的任务——将其状态重置为 pending 并重新加入队列
   * @param jobId - 任务 ID
   * @returns 更新后的任务对象
   */
  retryJob: async (jobId: string) => {
    const state = await loadState();
    const job = ensureJob(state, jobId);
    if (!["completed", "failed"].includes(job.status)) {
      throw new Error("Only completed or failed jobs can be redrawn");
    }

    const updated = await updateJob(jobId, {
      status: "pending",
      errorMessage: undefined,
      startedAt: undefined,
      completedAt: undefined
    });
    void processQueue();
    return updated;
  },

  /**
   * 更新任务在画布上的拖拽位置
   * @param jobId - 任务 ID
   * @param posX - 新的 X 坐标
   * @param posY - 新的 Y 坐标
   * @returns 更新后的任务对象
   */
  updateJobPosition: async (jobId: string, posX: number, posY: number) =>
    updateJob(jobId, {
      posX,
      posY,
      hasCustomPosition: true
    }),

  /**
   * 重新排列指定文件夹下的任务顺序
   * @param folderId - 文件夹 ID
   * @param orderedIds - 按新顺序排列的任务 ID 列表
   * @returns 排序后的任务列表
   */
  reorderJobs: async (folderId: string, orderedIds: string[]) => {
    const state = await loadState();
    ensureFolder(state, folderId);
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));

    state.jobs = state.jobs.map((job) =>
      job.folderId === folderId && orderMap.has(job.id)
        ? {
            ...job,
            orderIndex: orderMap.get(job.id) ?? job.orderIndex,
            updatedAt: nowIso()
          }
        : job
    );

    await saveState();
    return sortJobs(state.jobs.filter((job) => job.folderId === folderId));
  },

  /**
   * 上传图片到图床
   * @param file - 要上传的图片文件
   * @returns 包含远程 URL 和原始文件名的对象
   */
  uploadImage: async (file: File) => ({
    url: await uploadImageToHost(file),
    originalName: file.name
  }),

  /**
   * 获取图像服务的当前配置（供 UI 展示）
   * @returns API 设置信息（Key 已脱敏）
   */
  getImageProviderSettings: async (): Promise<ImageProviderSettings> => {
    const state = await loadState();
    return {
      baseUrl: state.settings.baseUrl || DEFAULT_BASE_URL,
      model: state.settings.model || DEFAULT_MODEL,
      hasApiKey: Boolean(state.settings.apiKey),
      apiKeyMasked: maskSecret(state.settings.apiKey)
    };
  },

  /**
   * 更新图像服务的 API 配置（Base URL / Model / API Key）
   * 会对 Base URL 做格式校验（必须是 http/https），
   * 传 clearApiKey=true 可以清除已保存的 API Key
   * @param payload - 要更新的配置字段（部分更新）
   * @returns 更新后的完整配置
   */
  updateImageProviderSettings: async (payload: UpdateImageProviderSettingsPayload): Promise<ImageProviderSettings> => {
    const state = await loadState();

    if (payload.baseUrl !== undefined) {
      const baseUrl = payload.baseUrl.trim() || DEFAULT_BASE_URL;
      try {
        const parsed = new URL(baseUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        throw new Error("Base URL is invalid");
      }
      state.settings.baseUrl = baseUrl || DEFAULT_BASE_URL;
    }

    if (payload.model !== undefined) {
      state.settings.model = payload.model.trim() || DEFAULT_MODEL;
    }

    if (payload.clearApiKey) {
      state.settings.apiKey = "";
    } else if (payload.apiKey?.trim()) {
      state.settings.apiKey = payload.apiKey.trim();
    }

    await saveState();
    return {
      baseUrl: state.settings.baseUrl || DEFAULT_BASE_URL,
      model: state.settings.model || DEFAULT_MODEL,
      hasApiKey: Boolean(state.settings.apiKey),
      apiKeyMasked: maskSecret(state.settings.apiKey)
    };
  }
};
