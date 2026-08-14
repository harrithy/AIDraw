import type { DrawJob, GeneratedAsset } from "../../types";
import { getDuomiCapability } from "../duomiCapabilities";
import type { CreatedProviderTask, ImageModelProvider, ProviderTaskResult, StoredSettings } from "./types";

const DEFAULT_BASE_URL = "https://duomiapi.com";
const REQUEST_TIMEOUT_MS = 60 * 1000;

type CapabilityJob = DrawJob & {
  capabilityId?: string;
  capabilityParams?: Record<string, unknown>;
};

type ExtendedTaskResult = ProviderTaskResult & {
  assets?: GeneratedAsset[];
  text?: string;
  data?: unknown;
};

type ExtendedCreatedTask = CreatedProviderTask & {
  taskIds?: string[];
  result?: ExtendedTaskResult;
};

type Capability = NonNullable<ReturnType<typeof getDuomiCapability>>;
type CapabilityAuth = Capability["auth"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asNonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const isBareTaskId = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:_[a-z0-9_-]+)?$/i.test(normalized) ||
    /^\d{8,}$/.test(normalized) ||
    /^(?:task|job|request)[_-][a-z0-9_-]{6,}$/i.test(normalized)
  );
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (!isRecord(payload)) return fallback;
  const error = isRecord(payload.error) ? payload.error : undefined;
  const data = isRecord(payload.data) ? payload.data : undefined;
  return (
    [error?.message, data?.task_status_msg, data?.message, data?.msg, data?.description, payload.message, payload.msg]
      .map(asNonEmptyString)
      .find(Boolean) ?? fallback
  );
};

const hasApiError = (payload: unknown) => {
  if (!isRecord(payload)) return false;
  if (payload.success === false) return true;
  if (payload.code === undefined || payload.code === null || payload.code === "") return false;
  const code = String(payload.code).toLowerCase();
  return code !== "0" && code !== "200" && code !== "success" && code !== "succeed";
};

const fetchJson = async (url: string, init: RequestInit, context: string) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(getErrorMessage(payload, `${context}失败：HTTP ${response.status}`));
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error(`${context}超时，请稍后重试`);
    if (error instanceof TypeError) {
      throw new Error("浏览器直连多米 API 失败：可能是 CORS 限制、网络不可达，或 Base URL 配置错误");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const getEndpoint = (settings: StoredSettings, path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  const configured = (settings.baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  // 多米同时使用 /api 与 /v1 路由，兼容用户误把站点根路径配成 .../v1；
  // 只剥 origin 直连 /v1 的形态，带子路径的配置（如 /api/v1）原样保留。
  const root = /^https?:\/\/[^/]+\/v1$/i.test(configured) ? configured.replace(/\/v1$/i, "") : configured;
  return `${root}/${path.replace(/^\/+/, "")}`;
};

const buildQueryUrl = (endpoint: string, values: Record<string, unknown>) => {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return url.toString();
};

const applyAuth = (
  auth: CapabilityAuth | undefined,
  apiKey: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
) => {
  if (!auth || auth.style === "none") return;
  if (auth.style === "key-body") {
    body[auth.name || "key"] = apiKey;
    return;
  }
  const headerName = auth.name || (auth.style === "key-header" ? "X-API-Key" : "Authorization");
  const prefix = auth.prefix?.trim() || (auth.style === "bearer" ? "Bearer" : undefined);
  headers[headerName] = prefix ? `${prefix} ${apiKey}` : apiKey;
};

const fillJobDefaults = (job: CapabilityJob, capability: Capability, values: Record<string, unknown>) => {
  const inputImages = job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [];
  const defaults: Record<string, unknown> = {
    prompt: job.prompt.trim(),
    negative_prompt: job.negativePrompt?.trim() || undefined,
    image: inputImages.length === 1 ? inputImages[0] : inputImages.length > 1 ? inputImages : undefined,
    image_urls: inputImages.length ? inputImages : undefined
  };
  for (const field of capability.fields) {
    if (values[field.key] === undefined && defaults[field.key] !== undefined) values[field.key] = defaults[field.key];
  }
};

const replacePathParams = (path: string, values: Record<string, unknown>, taskId?: string) =>
  path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const isTaskPlaceholder = key === "taskId" || key === "task_id" || key === "id";
    const value = isTaskPlaceholder ? taskId : values[key];
    if (value === undefined || value === null || value === "") throw new Error(`接口路径缺少参数：${key}`);
    if (!isTaskPlaceholder) delete values[key];
    return encodeURIComponent(String(value));
  });

const serializeBody = (contentType: Capability["create"]["contentType"], values: Record<string, unknown>) => {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  if (contentType === "application/json") return JSON.stringify(Object.fromEntries(entries));
  if (contentType === "application/x-www-form-urlencoded") {
    const body = new URLSearchParams();
    for (const [key, value] of entries) {
      body.set(key, typeof value === "object" && value !== null ? JSON.stringify(value) : String(value));
    }
    return body;
  }
  const body = new FormData();
  for (const [key, value] of entries) {
    if (value instanceof Blob) body.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) body.append(key, typeof item === "object" && item !== null ? JSON.stringify(item) : String(item));
    } else body.append(key, typeof value === "object" && value !== null ? JSON.stringify(value) : String(value));
  }
  return body;
};

const collectTaskIds = (payload: unknown) => {
  if (isBareTaskId(payload)) return [payload.trim()];
  if (!isRecord(payload)) return [];
  const data = payload.data;
  const candidates: unknown[] = [payload.task_id, payload.taskId, payload.id];
  if (isBareTaskId(data)) candidates.push(data);
  else if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === "string") candidates.push(item);
      else if (isRecord(item)) candidates.push(item.task_id, item.taskId, item.id);
    }
  } else if (isRecord(data)) candidates.push(data.task_id, data.taskId, data.id);
  return [...new Set(candidates.map(asNonEmptyString).filter((value): value is string => Boolean(value)))];
};

const normalizeState = (value: unknown): ProviderTaskResult["state"] | undefined => {
  if (value === undefined || value === null) return undefined;
  const state = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["0", "pending", "queued", "queue", "waiting", "wait", "created", "submitted"].includes(state)) return "pending";
  if (["1", "running", "processing", "in_progress", "generating"].includes(state)) return "running";
  if (["3", "succeeded", "succeed", "success", "completed", "complete", "finished", "done"].includes(state)) return "succeeded";
  if (["2", "failed", "fail", "error", "cancelled", "canceled", "rejected"].includes(state)) return "error";
  return undefined;
};

const getTaskState = (payload: unknown) => {
  if (!isRecord(payload)) return undefined;
  const data = isRecord(payload.data) ? payload.data : undefined;
  const nestedData = data && isRecord(data.data) ? data.data : undefined;
  const content = isRecord(payload.content) ? payload.content : undefined;
  // 新接口优先 state，旧 feed 再按 status 的 0/1/2/3 映射。
  const values = [payload.state, data?.state, nestedData?.state, payload.task_status, data?.task_status, payload.status, data?.status, content?.status];
  for (const value of values) {
    const state = normalizeState(value);
    if (state) return state;
  }
  return undefined;
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const inferAssetKind = (path: string, url: string, outputKind: Capability["outputKind"]): GeneratedAsset["kind"] => {
  const hint = `${path} ${url}`.toLowerCase();
  if (/video|\.mp4(?:$|\?)/.test(hint)) return "video";
  if (/audio|music|song|mp3|wav|\.m4a(?:$|\?)/.test(hint)) return "audio";
  if (/image|poster|thumbnail|cover|\.png(?:$|\?)|\.jpe?g(?:$|\?)|\.webp(?:$|\?)/.test(hint)) return "image";
  if (outputKind === "video") return "video";
  if (outputKind === "audio" || outputKind === "music") return "audio";
  if (outputKind === "image") return "image";
  return "file";
};

const extractResultData = (payload: unknown, outputKind: Capability["outputKind"]) => {
  const assets: GeneratedAsset[] = [];
  const texts: string[] = [];
  const seenUrls = new Set<string>();
  const visit = (value: unknown, path: string) => {
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return;
      if (isHttpUrl(text)) {
        if (!seenUrls.has(text)) {
          seenUrls.add(text);
          assets.push({ kind: inferAssetKind(path, text, outputKind), url: text });
        }
      } else if (
        /lyrics?|text|transcript|subtitle|caption|content|result/i.test(path) ||
        (outputKind === "lyrics" && (path === "" || path.endsWith(".data")))
      ) {
        texts.push(text);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) visit(child, path ? `${path}.${key}` : key);
    }
  };
  visit(payload, "");
  return { assets, text: [...new Set(texts)].join("\n\n") || undefined };
};

const toSucceededResult = (payload: unknown, outputKind: Capability["outputKind"]): ExtendedTaskResult => {
  const { assets, text } = extractResultData(payload, outputKind);
  return {
    state: "succeeded",
    // 兼容现有只消费 imageUrl 的队列；主线扩展类型后由 assets 决定实际媒体类型。
    imageUrl: assets.find((asset) => asset.url)?.url || "",
    assets,
    text,
    data: payload
  };
};

const parseTaskResult = (payload: unknown, capability: Capability, forceSucceeded = false): ExtendedTaskResult => {
  if (hasApiError(payload)) return { state: "error", errorMessage: getErrorMessage(payload, "多米 API 返回失败") };
  const state = getTaskState(payload);
  if (state === "error") return { state: "error", errorMessage: getErrorMessage(payload, "多米任务执行失败") };
  if (state === "pending" || state === "running") return { state };
  const extracted = extractResultData(payload, capability.outputKind);
  if (forceSucceeded || state === "succeeded" || extracted.assets.length > 0 || extracted.text) {
    return toSucceededResult(payload, capability.outputKind);
  }
  return { state: "pending" };
};

export const duomiCapabilityProtocol = {
  getEndpoint,
  collectTaskIds,
  normalizeState,
  extractResultData,
  parseTaskResult
};

/**
 * 多米能力注册表的通用执行器。接口差异由 capability 描述，Provider 只负责请求、认证和统一结果解析。
 */
export class DuomiCapabilityProvider implements ImageModelProvider {
  async createTask(job: DrawJob, settings: StoredSettings): Promise<ExtendedCreatedTask> {
    const capabilityJob = job as CapabilityJob;
    const capability = capabilityJob.capabilityId ? getDuomiCapability(capabilityJob.capabilityId) : undefined;
    if (!capability) throw new Error(`未找到多米能力：${capabilityJob.capabilityId || "未指定 capabilityId"}`);

    const values = { ...(capabilityJob.capabilityParams || {}) };
    fillJobDefaults(capabilityJob, capability, values);
    Object.assign(values, capability.fixedParams || {});
    const path = replacePathParams(capability.create.path, values);
    const headers: Record<string, string> = { Accept: "application/json" };
    applyAuth(capability.auth, settings.apiKey, headers, values);
    if (capability.create.method !== "GET" && capability.create.contentType !== "multipart/form-data") {
      headers["Content-Type"] = capability.create.contentType;
    }

    const endpoint = getEndpoint(settings, path);
    const isGet = capability.create.method === "GET";
    const payload = await fetchJson(
      isGet ? buildQueryUrl(endpoint, values) : endpoint,
      {
        method: capability.create.method,
        headers,
        body: isGet ? undefined : serializeBody(capability.create.contentType, values)
      },
      `提交${capability.name}`
    );
    if (hasApiError(payload)) throw new Error(getErrorMessage(payload, `提交${capability.name}失败`));

    const rawTaskIds = collectTaskIds(payload);
    const query = capability.query;
    // 同步接口的响应数据里可能含 id 字段（如分页查询），不属于任务 ID。
    const taskIds = query.strategy === "none" ? [] : rawTaskIds;
    const result = parseTaskResult(payload, capability, query.strategy === "none");
    const hasExplicitSynchronousResult = getTaskState(payload) === "succeeded" && result.state === "succeeded";
    if (!taskIds.length && query.strategy !== "none" && !hasExplicitSynchronousResult) {
      throw new Error(`${capability.name}未返回任务 id`);
    }
    const taskId = taskIds[0] || `sync-${job.id}`;
    return {
      taskId,
      taskIds: taskIds.length > 1 ? taskIds : undefined,
      queryUrl: query.strategy === "none" ? undefined : this.getQueryUrl(capability, query, taskId, settings, values),
      result: query.strategy === "none" || hasExplicitSynchronousResult ? result : undefined
    };
  }

  async queryTask(taskId: string, job: DrawJob, settings: StoredSettings): Promise<ExtendedTaskResult> {
    const capabilityJob = job as CapabilityJob;
    const capability = capabilityJob.capabilityId ? getDuomiCapability(capabilityJob.capabilityId) : undefined;
    if (!capability) throw new Error(`未找到多米能力：${capabilityJob.capabilityId || "未指定 capabilityId"}`);
    const query = capability.query;
    if (query.strategy === "none") throw new Error(`${capability.name}是同步接口，无需查询任务状态`);

    const values = { ...(capabilityJob.capabilityParams || {}) };
    const headers: Record<string, string> = { Accept: "application/json" };
    // 文档中的查询端点统一使用原始 Authorization；创建接口即使把 Key 放在 body，查询也不能沿用该方式。
    const queryAuth = (query as typeof query & { auth?: CapabilityAuth }).auth || {
      style: capability.auth.style === "bearer" ? "bearer" : "authorization"
    };
    const queryBody: Record<string, unknown> = {};
    applyAuth(queryAuth, settings.apiKey, headers, queryBody);
    let body: BodyInit | undefined;
    if (query.method !== "GET") {
      const taskIdParam = query.taskIdParam || "task_id";
      queryBody[taskIdParam] = taskId;
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(queryBody);
    }

    const payload = await fetchJson(
      (capabilityJob.remoteTaskIds?.length ?? 0) <= 1 && capabilityJob.queryUrl
        ? capabilityJob.queryUrl
        : this.getQueryUrl(capability, query, taskId, settings, values),
      { method: query.method, headers, body },
      `查询${capability.name}`
    );
    return parseTaskResult(payload, capability);
  }

  private getQueryUrl(
    capability: Capability,
    query: Capability["query"],
    taskId: string,
    settings: StoredSettings,
    values: Record<string, unknown>
  ) {
    if (!query.path) throw new Error(`${capability.name}缺少查询路径配置`);
    const path = replacePathParams(query.path, { ...values }, taskId);
    const endpoint = getEndpoint(settings, path);
    if (query.strategy !== "shared" || query.method !== "GET") return endpoint;
    const url = new URL(endpoint);
    url.searchParams.set(query.taskIdParam || "task_id", taskId);
    return url.toString();
  }
}
