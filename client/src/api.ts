import type {
  CreateJobPayload,
  DrawFolder,
  DrawJob,
  HealthPayload,
  ImageProviderSettings,
  UpdateImageProviderSettingsPayload
} from "./types";

const DB_NAME = "aidraw-frontend";
const DB_VERSION = 1;
const STATE_STORE = "state";
const STATE_KEY = "app-state";
const MAX_CONCURRENT = 10;
const DEFAULT_BASE_URL = "https://nowcoding.ai/v1";
const DEFAULT_MODEL = "gpt-image-2";

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

const nowIso = () => new Date().toISOString();

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

  // 浏览器刷新后无法继续旧的 fetch，重置未完成的运行任务。
  let changed = false;
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

  if (!stored || changed) await writeStateRecord(stateCache);
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

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });

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

const simulateDrawing = async (job: DrawJob) => {
  await new Promise((resolve) => window.setTimeout(resolve, 1100 + Math.floor(Math.random() * 900)));

  const width = Math.min(Math.max(job.width, 256), 1024);
  const height = Math.min(Math.max(job.height, 256), 1024);
  const palette = paletteFromPrompt(job.prompt);
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

const normalizeBase64 = (value: unknown) => {
  const raw = String(value ?? "").trim();
  const marker = ";base64,";
  const markerIndex = raw.indexOf(marker);
  return markerIndex >= 0 ? raw.slice(markerIndex + marker.length) : raw;
};

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const extractBase64Image = (payload: unknown) => {
  const data = payload as {
    data?: Array<{ b64_json?: string; b64Json?: string }>;
    output?: Array<{ b64_json?: string; b64Json?: string }>;
    b64_json?: string;
    b64Json?: string;
  };
  const candidates = [
    data?.data?.[0]?.b64_json,
    data?.data?.[0]?.b64Json,
    data?.output?.[0]?.b64_json,
    data?.output?.[0]?.b64Json,
    data?.b64_json,
    data?.b64Json
  ];
  const b64 = candidates.find((value) => typeof value === "string" && value.trim());
  if (!b64) throw new Error("Nowcoding response did not include b64_json");
  return normalizeBase64(b64);
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  const data = payload as { error?: { message?: string }; message?: string } | null;
  return data?.error?.message ?? data?.message ?? fallback;
};

const callNowcodingGeneration = async (job: DrawJob, settings: StoredSettings) => {
  const baseUrl = settings.baseUrl.replace(/\/+$/, "");

  try {
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: job.model || settings.model || DEFAULT_MODEL,
        prompt: job.prompt.trim(),
        size: "auto",
        n: 1,
        thinking: job.thinking || "high",
        response_format: "b64_json"
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `Nowcoding image generation failed with HTTP ${response.status}`));
    }

    const b64 = extractBase64Image(payload);
    return `data:image/png;base64,${b64}`;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("浏览器直连 Nowcoding 失败：可能是 CORS 限制、网络不可达，或 Base URL 无法从浏览器访问");
    }
    throw error;
  }
};

const callNowcodingEdit = async (job: DrawJob, settings: StoredSettings) => {
  const baseUrl = settings.baseUrl.replace(/\/+$/, "");
  const inputImages = job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [];
  if (inputImages.length === 0) throw new Error("图生图需要先添加参考图片");

  try {
    const body = new FormData();
    body.set("model", job.model || settings.model || DEFAULT_MODEL);
    body.set("prompt", job.prompt.trim());
    body.set("size", "auto");
    body.set("n", "1");
    body.set("thinking", job.thinking || "high");
    body.set("response_format", "b64_json");

    const imageBlobs = await Promise.all(inputImages.map((imageUrl) => dataUrlToBlob(imageUrl)));
    imageBlobs.forEach((blob, index) => {
      const extension = blob.type.split("/")[1] || "png";
      body.append("image[]", blob, `reference-${index + 1}.${extension}`);
    });

    const response = await fetch(`${baseUrl}/images/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`
      },
      body
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `Nowcoding image edit failed with HTTP ${response.status}`));
    }

    const b64 = extractBase64Image(payload);
    return `data:image/png;base64,${b64}`;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("浏览器直连 Nowcoding 图生图失败：可能是 CORS 限制、网络不可达，或 Base URL 无法从浏览器访问");
    }
    throw error;
  }
};

const generateDrawing = async (job: DrawJob) => {
  const state = await loadState();
  const settings = state.settings;

  if (settings.apiKey) {
    if (job.mode === "image-to-image") return callNowcodingEdit(job, settings);
    return callNowcodingGeneration(job, settings);
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
    await updateJob(job.id, {
      status: "completed",
      outputImageUrl,
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

export const api = {
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
        textToImage: state.settings.apiKey ? "nowcoding" : "mock",
        imageToImage: state.settings.apiKey ? "nowcoding" : "mock",
        hasNowcodingKey: Boolean(state.settings.apiKey),
        nowcodingBaseUrl: state.settings.baseUrl || DEFAULT_BASE_URL,
        nowcodingModel: state.settings.model || DEFAULT_MODEL,
        apiKeyMasked: maskSecret(state.settings.apiKey),
        usesSavedConfig: Boolean(state.settings.apiKey || state.settings.baseUrl || state.settings.model)
      }
    };
  },

  listFolders: async () => {
    const state = await loadState();
    return sortFolders(state.folders);
  },

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

  listJobs: async (folderId: string) => {
    const state = await loadState();
    ensureFolder(state, folderId);
    return sortJobs(state.jobs.filter((job) => job.folderId === folderId));
  },

  createJobs: async (folderId: string, payload: CreateJobPayload) => {
    const state = await loadState();
    const folder = ensureFolder(state, folderId);
    const prompt = payload.prompt.trim();
    const inputImageUrls = payload.inputImageUrls?.length
      ? payload.inputImageUrls
      : payload.inputImageUrl
        ? [payload.inputImageUrl]
        : [];
    const mode = inputImageUrls.length > 0 ? "image-to-image" : "text-to-image";
    if (!prompt) throw new Error("提示词不能为空");
    if (!["text-to-image", "image-to-image"].includes(payload.mode)) throw new Error("绘图模式无效");

    const count = Math.min(Math.max(Math.floor(payload.count || 1), 1), 8);
    const width = Math.min(Math.max(payload.width || 1024, 256), 1024);
    const height = Math.min(Math.max(payload.height || 1024, 256), 1024);
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
        count: 1,
        strength: payload.strength,
        thinking: payload.thinking || "high",
        model: payload.model || state.settings.model || DEFAULT_MODEL,
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

  retryJob: async (jobId: string) => {
    const state = await loadState();
    const job = ensureJob(state, jobId);
    if (!["completed", "failed"].includes(job.status)) {
      throw new Error("Only completed or failed jobs can be redrawn");
    }

    const updated = await updateJob(jobId, {
      status: "pending",
      outputImageUrl: undefined,
      errorMessage: undefined,
      startedAt: undefined,
      completedAt: undefined
    });
    void processQueue();
    return updated;
  },

  updateJobPosition: async (jobId: string, posX: number, posY: number) =>
    updateJob(jobId, {
      posX,
      posY,
      hasCustomPosition: true
    }),

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

  uploadImage: async (file: File) => ({
    url: await fileToDataUrl(file),
    originalName: file.name
  }),

  getImageProviderSettings: async (): Promise<ImageProviderSettings> => {
    const state = await loadState();
    return {
      baseUrl: state.settings.baseUrl || DEFAULT_BASE_URL,
      model: state.settings.model || DEFAULT_MODEL,
      hasApiKey: Boolean(state.settings.apiKey),
      apiKeyMasked: maskSecret(state.settings.apiKey)
    };
  },

  updateImageProviderSettings: async (payload: UpdateImageProviderSettingsPayload): Promise<ImageProviderSettings> => {
    const state = await loadState();

    if (payload.baseUrl !== undefined) {
      const baseUrl = payload.baseUrl.trim();
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
