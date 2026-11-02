import type { DrawJob, GeneratedAsset } from "../../types";
import { customEndpoint, readResponsePath, renderRequestTemplate, validateCustomProviderConfig, type CustomProviderConfig } from "../customProviders";
import { createCredentialId } from "../jobCredentials";
import type { CreatedProviderTask, ImageModelProvider, ProviderTaskResult, StoredSettings } from "./types";

/** 请求始终走同源 JSON 代理，避免中转没有开放浏览器 CORS。 */
export const requestCustomProvider = async (
  config: CustomProviderConfig,
  apiKey: string,
  path: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<unknown> => {
  const url = new URL(customEndpoint(config, path));
  if (method === "GET" && body && typeof body === "object") {
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
  }
  const headers: Record<string, string> = {};
  if (config.authHeader && apiKey) headers[config.authHeader] = config.authPrefix + apiKey;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 125_000);
  try {
    const response = await fetch("/api/provider-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.toString(), method, headers, ...(method === "POST" ? { body } : {}) }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message ?? payload?.error ?? payload?.message;
      const details = typeof message === "string" ? message : "中转接口返回 HTTP " + response.status;
      throw new Error(response.status >= 500 ? "提交结果未知：" + details : details);
    }
    if (payload === null) throw new Error("提交结果未知：中转接口未返回有效 JSON");
    return payload;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("中转请求超时，提交结果可能未知");
    if (error instanceof TypeError) throw new Error("中转请求网络异常，请检查地址和部署的代理函数");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
};

/** 将自定义响应字段归一化到现有队列结果类型。 */
export const parseCustomResult = (payload: unknown, config: CustomProviderConfig, synchronous = false): ProviderTaskResult => {
  const state = String(readResponsePath(payload, config.statusPath)[0] ?? "").toLowerCase();
  const error = readResponsePath(payload, config.errorPath)[0];
  if (config.failureValues.includes(state)) {
    return { state: "error", errorMessage: typeof error === "string" ? error : "中转任务执行失败" };
  }
  if (!synchronous && !config.successValues.includes(state)) {
    if (!state) throw new Error("未找到任务状态，请检查状态字段映射");
    return { state: "running" };
  }
  const values = readResponsePath(payload, config.resultPath).filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  if (!values.length) throw new Error("未找到生成结果，请检查结果字段映射：" + config.resultPath);
  if (config.outputKind === "text") return { state: "succeeded", text: values.join("\n\n") };
  const assets: GeneratedAsset[] = values.map((url) => {
    if (!/^https?:\/\//i.test(url)) throw new Error("结果地址需为 HTTP(S) URL，暂不支持 Base64 结果");
    return { kind: config.outputKind as GeneratedAsset["kind"], url };
  });
  return { state: "succeeded", assets, imageUrl: assets.find((asset) => asset.kind === "image" || asset.kind === "video")?.url };
};

export class CustomProvider implements ImageModelProvider {
  private resolve(job: DrawJob, settings: StoredSettings) {
    const saved = settings.customProviders?.find((item) => item.config.id === job.customProviderId);
    if (!saved) throw new Error("该任务绑定的自定义中转已删除，请恢复配置后继续");
    const apiKey = job.customCredentialId
      ? [saved.apiKey, ...(saved.previousApiKeys ?? [])].find((key) => createCredentialId("duomi", key) === job.customCredentialId)
      : saved.apiKey;
    if (apiKey === undefined) throw new Error("该任务使用的中转 Key 已不可用");
    return { config: validateCustomProviderConfig(job.customProviderConfig ?? saved.config), apiKey };
  }

  async createTask(job: DrawJob, settings: StoredSettings): Promise<CreatedProviderTask> {
    const { config, apiKey } = this.resolve(job, settings);
    const images = job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [];
    const body = renderRequestTemplate(config.requestBody, {
      prompt: job.prompt, model: job.model, size: job.size ?? "auto", width: job.width, height: job.height,
      images: images.length ? images : undefined, image: images[0], duration: job.duration ?? 5, quality: job.thinking
    });
    const payload = await requestCustomProvider(config, apiKey, config.createPath, config.createMethod, body);
    if (config.mode === "sync") {
      try { return { taskId: "", result: parseCustomResult(payload, config, true) }; }
      catch (error) { throw new Error("提交结果未知：上游已响应，但" + (error instanceof Error ? error.message : "结果解析失败")); }
    }
    const taskId = readResponsePath(payload, config.taskIdPath)[0];
    if ((typeof taskId !== "string" && typeof taskId !== "number") || !String(taskId).trim()) {
      // 请求已被上游接受，字段配置错误时禁止自动再次提交。
      throw new Error("提交结果未知：未找到任务 ID，请核对 " + config.taskIdPath + " 并到中转后台确认");
    }
    return { taskId: String(taskId) };
  }

  async queryTask(taskId: string, job: DrawJob, settings: StoredSettings): Promise<ProviderTaskResult> {
    const { config, apiKey } = this.resolve(job, settings);
    const path = config.queryPath.replaceAll("{id}", encodeURIComponent(taskId));
    return parseCustomResult(await requestCustomProvider(config, apiKey, path, "GET"), config);
  }
}
