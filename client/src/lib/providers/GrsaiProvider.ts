import type { DrawJob } from "../../types";
import { isNanoBananaModel } from "../imageModels";
import type { CreatedProviderTask, ImageModelProvider, ProviderTaskResult, StoredSettings } from "./types";

const DEFAULT_GRSAI_BASE_URL = "https://grsaiapi.com";
const DEFAULT_MODEL = "gpt-image-2";
const REQUEST_TIMEOUT_MS = 60 * 1000;

type GrsaiTaskPayload = {
  id?: string;
  status?: string;
  progress?: number;
  results?: Array<{ url?: string }>;
  error?: string | { code?: string; message?: string; type?: string };
  message?: string;
  msg?: string;
};

const getAuthorizationHeader = (apiKey: string) => {
  const trimmedKey = apiKey.trim();
  return /^Bearer\s+/i.test(trimmedKey) ? trimmedKey : `Bearer ${trimmedKey}`;
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  const data = payload as GrsaiTaskPayload | null;
  const structuredError = typeof data?.error === "object" ? data.error : undefined;
  const message =
    (typeof data?.error === "string" ? data.error : undefined) ??
    structuredError?.message ??
    data?.message ??
    data?.msg;
  const details = [structuredError?.code, structuredError?.type].filter(Boolean).join(" / ");
  if (message && details) return `${message}（${details}）`;
  return message?.trim() || fallback;
};

const fetchJson = async <T>(url: string, init: RequestInit, context: string) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
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
      throw new Error("浏览器直连 Grsai API 失败：可能是 CORS 限制、网络不可达，或 Base URL 无法访问");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export class GrsaiProvider implements ImageModelProvider {
  private getEndpoint(settings: StoredSettings, path: string) {
    const configuredBaseUrl = (settings.baseUrl || DEFAULT_GRSAI_BASE_URL).trim().replace(/\/+$/, "");
    const apiRoot = configuredBaseUrl.endsWith("/v1") ? configuredBaseUrl.slice(0, -3) : configuredBaseUrl;
    return `${apiRoot}${path}`;
  }

  async createTask(job: DrawJob, settings: StoredSettings): Promise<CreatedProviderTask> {
    const inputImages = job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [];
    const model = job.model || settings.model || DEFAULT_MODEL;
    const requestBody: Record<string, unknown> = {
      model,
      prompt: job.prompt.trim(),
      aspectRatio: job.size || "auto",
      replyType: "async"
    };

    if (inputImages.length > 0) requestBody.images = inputImages;
    if (isNanoBananaModel(model) && job.imageSize) requestBody.imageSize = job.imageSize;

    const payload = await fetchJson<GrsaiTaskPayload>(
      this.getEndpoint(settings, "/v1/api/generate"),
      {
        method: "POST",
        headers: {
          Authorization: getAuthorizationHeader(settings.apiKey),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      },
      "提交 Grsai 图片生成任务"
    );

    const taskId = payload?.id?.trim();
    if (!taskId) throw new Error(getErrorMessage(payload, "Grsai API 未返回任务 id"));
    if (payload?.status === "failed" || payload?.status === "violation") {
      throw new Error(getErrorMessage(payload, `Grsai 任务状态异常：${payload.status}`));
    }

    return {
      taskId,
      queryUrl: this.getEndpoint(settings, `/v1/api/result?id=${encodeURIComponent(taskId)}`)
    };
  }

  async queryTask(taskId: string, job: DrawJob, settings: StoredSettings): Promise<ProviderTaskResult> {
    const payload = await fetchJson<GrsaiTaskPayload>(
      job.queryUrl || this.getEndpoint(settings, `/v1/api/result?id=${encodeURIComponent(taskId)}`),
      {
        method: "GET",
        headers: {
          Authorization: getAuthorizationHeader(settings.apiKey)
        }
      },
      "查询 Grsai 异步结果"
    );

    const status = payload?.status?.toLowerCase();
    if (status === "succeeded") {
      const imageUrl = payload?.results?.find((result) => typeof result.url === "string" && result.url.trim())?.url;
      if (!imageUrl) throw new Error("Grsai 任务已完成，但未返回图片地址");
      return { state: "succeeded", imageUrl };
    }
    if (status === "failed" || status === "violation") {
      return { state: "error", errorMessage: getErrorMessage(payload, `Grsai 任务失败：${taskId}`) };
    }
    if (status === "pending" || status === "running") {
      return { state: status };
    }
    throw new Error("Grsai 查询结果缺少有效的任务状态");
  }
}
