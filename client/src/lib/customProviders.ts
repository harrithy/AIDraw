import type { GeneratedAssetKind } from "../types";
import { createId } from "./storage/helpers";

/** 中转协议只保存声明式 JSON，不执行文档中的代码。 */
export type CustomProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  mode: "sync" | "async";
  outputKind: GeneratedAssetKind | "text";
  authHeader: string;
  authPrefix: string;
  createPath: string;
  createMethod: "GET" | "POST";
  requestBody: Record<string, unknown>;
  queryPath: string;
  resultPath: string;
  taskIdPath: string;
  statusPath: string;
  errorPath: string;
  successValues: string[];
  failureValues: string[];
};

export type StoredCustomProvider = {
  config: CustomProviderConfig;
  apiKey: string;
  previousApiKeys?: string[];
};

export type PublicCustomProvider = {
  config: CustomProviderConfig;
  hasApiKey: boolean;
  apiKeyMasked: string;
};

export const createCustomProviderTemplate = (asyncMode = false): CustomProviderConfig => ({
  id: createId(),
  name: asyncMode ? "我的异步中转" : "我的图片中转",
  baseUrl: "",
  models: ["gpt-image-2"],
  mode: asyncMode ? "async" : "sync",
  outputKind: "image",
  authHeader: "Authorization",
  authPrefix: "Bearer ",
  createPath: asyncMode ? "/v1/images/generations?async=true" : "/v1/images/generations",
  createMethod: "POST",
  requestBody: { model: "{{model}}", prompt: "{{prompt}}", size: "{{size}}", n: 1 },
  queryPath: "/v1/tasks/{id}",
  resultPath: asyncMode ? "data.images[].url" : "data[].url",
  taskIdPath: "id",
  statusPath: "state",
  errorPath: "error.message",
  successValues: ["succeeded", "completed", "success"],
  failureValues: ["failed", "error", "cancelled", "canceled"]
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const safePath = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n#]/.test(value)) {
    throw new Error(label + "需为以 / 开头的接口路径");
  }
  if (/[?&](?:api[_-]?key|token|access_token|secret)=/i.test(value)) throw new Error("请通过鉴权请求头配置密钥，接口路径不能包含密钥");
  return value;
};

/** 对保存、导入和历史任务恢复使用相同校验，阻止配置注入与错误协议。 */
export const validateCustomProviderConfig = (value: unknown): CustomProviderConfig => {
  if (!isRecord(value)) throw new Error("中转配置必须是 JSON 对象");
  const text = (key: string) => typeof value[key] === "string" ? value[key] as string : "";
  const name = text("name").trim();
  if (!name) throw new Error("请填写中转名称");
  const baseUrl = text("baseUrl").trim().replace(/\/+$/, "");
  let parsed: URL;
  try { parsed = new URL(baseUrl); } catch { throw new Error("请填写有效的中转地址"); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("中转地址需为不含账号、密码和查询参数的 HTTP(S) 地址");
  }
  const models = Array.isArray(value.models)
    ? [...new Set(value.models.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
    : [];
  if (!models.length || models.length > 100) throw new Error("请填写 1 到 100 个模型名称");
  if (!isRecord(value.requestBody)) throw new Error("请求模板必须是 JSON 对象");
  const serialized = JSON.stringify(value.requestBody);
  if (/"(?:api[_-]?key|authorization|token|access_token|secret)"\s*:/i.test(serialized)) {
    throw new Error("请将密钥填写在 API Key 中；当前支持请求头鉴权");
  }
  if (serialized.length > 100_000 || /"(?:__proto__|constructor|prototype)"\s*:/.test(serialized)) {
    throw new Error("请求模板过大或包含不支持的字段");
  }
  const allowedVariables = new Set(["prompt", "model", "size", "width", "height", "images", "image", "duration", "quality"]);
  for (const match of serialized.matchAll(/\{\{(.*?)\}\}/g)) {
    if (!allowedVariables.has(match[1].trim())) throw new Error("未知模板变量：" + match[1]);
  }
  const authHeader = text("authHeader").trim();
  if (authHeader && (!/^[a-zA-Z0-9-]+$/.test(authHeader) || /^(host|cookie|content-length|connection|origin|referer|proxy-.*|sec-.*|x-forwarded-.*)$/i.test(authHeader))) {
    throw new Error("鉴权请求头名称无效");
  }
  if (/[\r\n]/.test(text("authPrefix"))) throw new Error("鉴权前缀不能包含换行");
  if (!["sync", "async"].includes(text("mode"))) throw new Error("请选择同步或异步接口");
  if (!["image", "video", "audio", "file", "text"].includes(text("outputKind"))) throw new Error("结果类型无效");
  const mode = text("mode") as CustomProviderConfig["mode"];
  const queryPath = mode === "async" ? safePath(value.queryPath, "查询接口") : text("queryPath");
  if (mode === "async" && !queryPath.includes("{id}")) throw new Error("查询接口需包含 {id} 占位符");
  if (!text("resultPath").trim() || (mode === "async" && (!text("taskIdPath") || !text("statusPath")))) {
    throw new Error("请填写结果字段；异步接口还需任务 ID 和状态字段");
  }
  const values = (key: string) => Array.isArray(value[key])
    ? (value[key] as unknown[]).filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean)
    : [];
  const successValues = values("successValues");
  const failureValues = values("failureValues");
  if (mode === "async" && (!successValues.length || !failureValues.length || successValues.some((item) => failureValues.includes(item)))) {
    throw new Error("请填写互不重叠的成功和失败状态");
  }
  return {
    id: text("id") || createId(), name, baseUrl, models, mode,
    outputKind: text("outputKind") as CustomProviderConfig["outputKind"],
    authHeader, authPrefix: text("authPrefix"),
    createPath: safePath(value.createPath, "提交接口"),
    createMethod: value.createMethod === "GET" ? "GET" : "POST",
    requestBody: JSON.parse(serialized) as Record<string, unknown>, queryPath,
    resultPath: text("resultPath").trim(), taskIdPath: text("taskIdPath").trim(),
    statusPath: text("statusPath").trim(), errorPath: text("errorPath").trim(),
    successValues, failureValues
  };
};

/** 支持 data[0].url、data[].url 和 data.*.url，不使用 eval。 */
export const readResponsePath = (payload: unknown, path: string): unknown[] => {
  if (!path) return [];
  const segments = path.replace(/^\$\.?/, "").replace(/\[(\d+|\*|)\]/g, (_, key: string) => "." + (key || "*")).split(".").filter(Boolean);
  let values: unknown[] = [payload];
  for (const key of segments) {
    if (["__proto__", "constructor", "prototype"].includes(key)) return [];
    values = values.flatMap((value) => {
      if (key === "*") return Array.isArray(value) ? value : [];
      return value !== null && typeof value === "object" && Object.hasOwn(value, key)
        ? [(value as Record<string, unknown>)[key]] : [];
    });
  }
  return values.flatMap((value) => Array.isArray(value) ? value : [value]);
};

/** 完整占位符保留数组/数字类型，嵌入文本的占位符才转换为字符串。 */
export const renderRequestTemplate = (value: unknown, variables: Record<string, unknown>): unknown => {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{\s*(\w+)\s*\}\}$/);
    if (exact) return variables[exact[1]];
    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => String(variables[key] ?? ""));
  }
  if (Array.isArray(value)) return value.map((item) => renderRequestTemplate(item, variables));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, renderRequestTemplate(item, variables)])
    .filter(([, item]) => item !== undefined));
  return value;
};

export const customEndpoint = (config: CustomProviderConfig, path: string) => {
  const base = new URL(config.baseUrl);
  const basePath = base.pathname.replace(/\/+$/, "");
  return basePath && (path === basePath || path.startsWith(basePath + "/"))
    ? base.origin + path : config.baseUrl.replace(/\/+$/, "") + path;
};
