import type { DrawJob } from "../../types";
import type { CreatedProviderTask, ImageModelProvider, ProviderTaskResult, StoredSettings } from "./types";

const DUOMI_API_PREFIX = "/v1";
const DEFAULT_MODEL = "gpt-image-2";
const REQUEST_TIMEOUT_MS = 60 * 1000;

const normalizeQuality = (value: DrawJob["thinking"]) => {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "high";
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

const getErrorMessage = (payload: unknown, fallback: string) => {
  const data = payload as {
    error?: { code?: string; message?: string; type?: string };
    message?: string;
    data?: { description?: string };
  } | null;
  const message = data?.error?.message ?? data?.message ?? data?.data?.description;
  const details = [data?.error?.code, data?.error?.type].filter(Boolean).join(" / ");
  if (message && details) return `${message}（${details}）`;
  return message ?? fallback;
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

export class DuomiProvider implements ImageModelProvider {
  private getDuomiEndpoint(settings: StoredSettings, path: string) {
    const configuredBaseUrl = (settings.baseUrl || "https://duomiapi.com").trim().replace(/\/+$/, "");
    const versionedBaseUrl = configuredBaseUrl.endsWith(DUOMI_API_PREFIX)
      ? configuredBaseUrl
      : `${configuredBaseUrl}${DUOMI_API_PREFIX}`;
    return `${versionedBaseUrl}${path}`;
  }

  async createTask(job: DrawJob, settings: StoredSettings): Promise<CreatedProviderTask> {
    const inputImages = job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [];
    if (inputImages.length > 0) assertDuomiImageUrls(inputImages);

    const requestBody: Record<string, unknown> = {
      model: job.model || settings.model || DEFAULT_MODEL,
      prompt: job.prompt.trim(),
      size: job.size || "auto",
      quality: normalizeQuality(job.thinking),
      oversea: false
    };

    if (inputImages.length > 0) {
      requestBody.image = inputImages;
    }

    const payload = await fetchJson<{
      id?: string;
      task_id?: string;
      taskId?: string;
      data?: { id?: string; task_id?: string; taskId?: string };
    }>(
      this.getDuomiEndpoint(settings, "/images/generations"),
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

    const taskId = payload?.id ?? payload?.task_id ?? payload?.taskId ?? payload?.data?.id ?? payload?.data?.task_id ?? payload?.data?.taskId;
    if (!taskId) throw new Error("多米API未返回任务 id");
    return {
      taskId,
      queryUrl: this.getDuomiEndpoint(settings, `/tasks/${encodeURIComponent(taskId)}`)
    };
  }

  async queryTask(taskId: string, job: DrawJob, settings: StoredSettings): Promise<ProviderTaskResult> {
    const payload = await fetchJson<{
      id?: string;
      state?: string;
      data?: { images?: Array<{ url?: string; file_name?: string }>; description?: string };
      error?: { message?: string };
      message?: string;
    }>(
      job.queryUrl || this.getDuomiEndpoint(settings, `/tasks/${encodeURIComponent(taskId)}`),
      {
        method: "GET",
        headers: {
          Authorization: settings.apiKey
        }
      },
      "查询多米API异步结果"
    );

    if (payload?.state === "succeeded") {
      const imageUrl = payload?.data?.images?.find((image) => typeof image.url === "string" && image.url.trim())?.url;
      if (!imageUrl) throw new Error("多米API任务已完成，但未返回图片地址");
      return { state: "succeeded", imageUrl };
    }
    if (payload?.state === "error") {
      return { state: "error", errorMessage: getErrorMessage(payload, `多米API任务失败：${taskId}`) };
    }
    if (payload?.state === "pending" || payload?.state === "running") {
      return { state: payload.state };
    }
    throw new Error("多米API查询结果缺少有效的任务状态");
  }
}
