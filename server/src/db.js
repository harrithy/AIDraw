import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const projectRoot = join(__dirname, "..");
export const dataDir = join(projectRoot, "data");
export const uploadsDir = join(dataDir, "uploads");
export const generatedDir = join(uploadsDir, "generated");
export const originalsDir = join(uploadsDir, "originals");

mkdirSync(generatedDir, { recursive: true });
mkdirSync(originalsDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "aidraw.sqlite"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    canvas_zoom REAL NOT NULL DEFAULT 1,
    canvas_pan_x REAL NOT NULL DEFAULT 0,
    canvas_pan_y REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    input_image_url TEXT,
    output_image_url TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    count INTEGER NOT NULL,
    strength REAL,
    thinking TEXT,
    model TEXT,
    order_index INTEGER NOT NULL,
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const ensureColumn = (tableName, columnName, definition) => {
  const exists = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((row) => row.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

ensureColumn("jobs", "thinking", "TEXT");

/**
 * 🐱 为 jobs 表添加画布自由拖拽所需的位置字段
 * 主人想要卡片随意拖动，人家就给你加上喵~
 */
ensureColumn("jobs", "pos_x", "REAL NOT NULL DEFAULT 0");
ensureColumn("jobs", "pos_y", "REAL NOT NULL DEFAULT 0");
ensureColumn("jobs", "has_custom_position", "INTEGER NOT NULL DEFAULT 0");

const getSetting = (key) => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  return row?.value ?? "";
};

const setSetting = (key, value) => {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, new Date().toISOString());
};

const maskSecret = (value) => {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const rowToFolder = (row) => ({
  id: row.id,
  name: row.name,
  canvasZoom: row.canvas_zoom,
  canvasPanX: row.canvas_pan_x,
  canvasPanY: row.canvas_pan_y,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const rowToJob = (row) => ({
  id: row.id,
  folderId: row.folder_id,
  mode: row.mode,
  status: row.status,
  prompt: row.prompt,
  negativePrompt: row.negative_prompt ?? "",
  inputImageUrl: row.input_image_url ?? undefined,
  outputImageUrl: row.output_image_url ?? undefined,
  width: row.width,
  height: row.height,
  count: row.count,
  strength: row.strength ?? undefined,
  thinking: row.thinking ?? "high",
  model: row.model ?? "",
  orderIndex: row.order_index,
  /**
   * 🐱 画布自由拖拽位置
   * posX/posY 是卡片左上角在画布坐标系中的坐标
   * 初始为 0，主人拖动后会自动保存喵~
   */
  posX: row.pos_x ?? 0,
  posY: row.pos_y ?? 0,
  hasCustomPosition: Boolean(row.has_custom_position),
  errorMessage: row.error_message ?? undefined,
  startedAt: row.started_at ?? undefined,
  completedAt: row.completed_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createFolder = ({ id, name, now }) => {
  db.prepare(`
    INSERT INTO folders (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(id, name, now, now);
  return getFolder(id);
};

export const listFolders = () =>
  db
    .prepare("SELECT * FROM folders ORDER BY created_at DESC")
    .all()
    .map(rowToFolder);

export const getFolder = (id) => {
  const row = db.prepare("SELECT * FROM folders WHERE id = ?").get(id);
  return row ? rowToFolder(row) : null;
};

export const updateFolder = (id, patch) => {
  const existing = getFolder(id);
  if (!existing) return null;

  const next = {
    name: patch.name ?? existing.name,
    canvasZoom: patch.canvasZoom ?? existing.canvasZoom,
    canvasPanX: patch.canvasPanX ?? existing.canvasPanX,
    canvasPanY: patch.canvasPanY ?? existing.canvasPanY,
    updatedAt: new Date().toISOString()
  };

  db.prepare(`
    UPDATE folders
    SET name = ?, canvas_zoom = ?, canvas_pan_x = ?, canvas_pan_y = ?, updated_at = ?
    WHERE id = ?
  `).run(
    next.name,
    next.canvasZoom,
    next.canvasPanX,
    next.canvasPanY,
    next.updatedAt,
    id
  );

  return getFolder(id);
};

export const getNextOrderIndex = (folderId) => {
  const row = db
    .prepare("SELECT COALESCE(MAX(order_index), -1) + 1 AS next_index FROM jobs WHERE folder_id = ?")
    .get(folderId);
  return row.next_index;
};

/**
 * 🐱 创建新的绘图任务
 * 新增 posX/posY 参数用于画布自由拖拽定位
 * 如果主人没指定位置，就用 (0, 0) 作为默认值喵~
 */
export const createJob = (job) => {
  db.prepare(`
    INSERT INTO jobs (
      id,
      folder_id,
      mode,
      status,
      prompt,
      negative_prompt,
      input_image_url,
      output_image_url,
      width,
      height,
      count,
      strength,
      thinking,
      model,
      order_index,
      pos_x,
      pos_y,
      has_custom_position,
      error_message,
      started_at,
      completed_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.id,
    job.folderId,
    job.mode,
    job.status,
    job.prompt,
    job.negativePrompt ?? null,
    job.inputImageUrl ?? null,
    job.outputImageUrl ?? null,
    job.width,
    job.height,
    job.count,
    job.strength ?? null,
    job.thinking ?? "high",
    job.model ?? null,
    job.orderIndex,
    job.posX ?? 0,
    job.posY ?? 0,
    job.hasCustomPosition ? 1 : 0,
    job.errorMessage ?? null,
    job.startedAt ?? null,
    job.completedAt ?? null,
    job.createdAt,
    job.updatedAt
  );
  return getJob(job.id);
};

export const getJob = (id) => {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  return row ? rowToJob(row) : null;
};

export const listJobsByFolder = (folderId) =>
  db
    .prepare("SELECT * FROM jobs WHERE folder_id = ? ORDER BY order_index ASC, created_at ASC")
    .all(folderId)
    .map(rowToJob);

export const listJobsByStatus = (status) =>
  db
    .prepare("SELECT * FROM jobs WHERE status = ? ORDER BY created_at ASC")
    .all(status)
    .map(rowToJob);

export const setJobStatus = (id, patch) => {
  const existing = getJob(id);
  if (!existing) return null;

  const next = {
    status: patch.status ?? existing.status,
    outputImageUrl: patch.outputImageUrl ?? existing.outputImageUrl,
    errorMessage: patch.errorMessage ?? existing.errorMessage,
    startedAt: patch.startedAt ?? existing.startedAt,
    completedAt: patch.completedAt ?? existing.completedAt,
    updatedAt: new Date().toISOString()
  };

  db.prepare(`
    UPDATE jobs
    SET status = ?,
        output_image_url = ?,
        error_message = ?,
        started_at = ?,
        completed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    next.status,
    next.outputImageUrl ?? null,
    next.errorMessage ?? null,
    next.startedAt ?? null,
    next.completedAt ?? null,
    next.updatedAt,
    id
  );

  return getJob(id);
};

export const updateJobOrder = (id, orderIndex) => {
  db.prepare(`
    UPDATE jobs
    SET order_index = ?, updated_at = ?
    WHERE id = ?
  `).run(orderIndex, new Date().toISOString(), id);
  return getJob(id);
};

/**
 * 🐱 更新卡片在画布上的自由拖拽位置
 * 主人每拖一次卡片，人家就会保存它的新坐标喵~
 * @param {string} id - 任务 ID
 * @param {number} posX - 画布坐标系中的 X 坐标
 * @param {number} posY - 画布坐标系中的 Y 坐标
 * @returns 更新后的任务对象，不存在则返回 null
 */
export const updateJobPosition = (id, posX, posY, hasCustomPosition = true) => {
  db.prepare(`
    UPDATE jobs
    SET pos_x = ?, pos_y = ?, has_custom_position = ?, updated_at = ?
    WHERE id = ?
  `).run(posX, posY, hasCustomPosition ? 1 : 0, new Date().toISOString(), id);
  return getJob(id);
};

export const retryJob = (id) => {
  db.prepare(`
    UPDATE jobs
    SET status = 'pending',
        output_image_url = NULL,
        error_message = NULL,
        started_at = NULL,
        completed_at = NULL,
        updated_at = ?
    WHERE id = ?
      AND status IN ('completed', 'failed')
  `).run(new Date().toISOString(), id);
  return getJob(id);
};

export const reorderJobs = (folderId, orderedIds) => {
  db.exec("BEGIN");
  try {
    orderedIds.forEach((id, index) => {
      db.prepare(`
        UPDATE jobs
        SET order_index = ?, updated_at = ?
        WHERE id = ? AND folder_id = ?
      `).run(index, new Date().toISOString(), id, folderId);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listJobsByFolder(folderId);
};

export const resetInterruptedJobs = () => {
  db.prepare(`
    UPDATE jobs
    SET status = 'pending',
        started_at = NULL,
        updated_at = ?
    WHERE status = 'running'
  `).run(new Date().toISOString());
};

export const getImageProviderSettings = () => {
  const apiKey = getSetting("nowcoding_api_key");
  return {
    baseUrl: getSetting("nowcoding_base_url"),
    apiKey,
    apiKeyMasked: maskSecret(apiKey),
    hasApiKey: Boolean(apiKey),
    model: getSetting("nowcoding_image_model")
  };
};

export const updateImageProviderSettings = ({ baseUrl, apiKey, model, clearApiKey }) => {
  if (baseUrl !== undefined) {
    setSetting("nowcoding_base_url", String(baseUrl).trim());
  }

  if (model !== undefined) {
    setSetting("nowcoding_image_model", String(model).trim());
  }

  if (clearApiKey) {
    setSetting("nowcoding_api_key", "");
  } else if (apiKey !== undefined && String(apiKey).trim()) {
    setSetting("nowcoding_api_key", String(apiKey).trim());
  }

  return getImageProviderSettings();
};
