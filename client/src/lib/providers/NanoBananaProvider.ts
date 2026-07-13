import type { DrawJob, DrawSize, NanoImageSize } from "../../types";
import type { CreatedProviderTask, ImageModelProvider, ProviderTaskResult, StoredSettings } from "./types";
import {
  MAX_NANO_BANANA_REFERENCE_IMAGES,
  NANO_BANANA_MODEL,
  supportsNanoBananaImageSize
} from "../imageModels";

const NANO_BANANA_API_PREFIX = "/api/gemini";
const DEFAULT_SIZE: DrawSize = "auto";
const DEFAULT_NANO_IMAGE_SIZE: NanoImageSize = "4K";
const REQUEST_TIMEOUT_MS = 60 * 1000;

const nanoAspectRatios = new Set<string>([
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
    throw new Error("参考图只支持公网 http(s) 图片 URL，不能直接发送本地图片或 data URL");
  }
};

const normalizeNanoAspectRatio = (value: unknown): DrawSize => {
  const size = String(value ?? "").trim() as DrawSize;
  return nanoAspectRatios.has(size) ? size : DEFAULT_SIZE;
};

const normalizeNanoImageSize = (value: unknown): NanoImageSize => {
  if (value === "1K" || value === "2K" || value === "4K") return value;
  return DEFAULT_NANO_IMAGE_SIZE;
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
      throw new Error("浏览器直连 API 失败：可能是 CORS 限制、网络不可达，或 Base URL 无法从浏览器访问");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export class NanoBananaProvider implements ImageModelProvider {
  private getNanoBananaEndpoint(settings: StoredSettings, path: string) {
    const configuredBaseUrl = (settings.baseUrl || "https://duomiapi.com").trim().replace(/\/+$/, "");
    const apiRoot = configuredBaseUrl.endsWith("/v1")
      ? configuredBaseUrl.slice(0, -3)
      : configuredBaseUrl;
    return `${apiRoot}${NANO_BANANA_API_PREFIX}${path}`;
  }

  async createTask(job: DrawJob, settings: StoredSettings): Promise<CreatedProviderTask> {
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

    const payload = await fetchJson<{ code?: number; msg?: string; data?: { task_id?: string } }>(
      this.getNanoBananaEndpoint(settings, endpointPath),
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

    if (payload?.code !== 200) {
      throw new Error(getErrorMessage(payload, "提交 NANO-BANANA 任务失败"));
    }
    const taskId = payload?.data?.task_id;
    if (!taskId) throw new Error("NANO-BANANA 未返回任务 id");
    return {
      taskId,
      queryUrl: this.getNanoBananaEndpoint(settings, `/nano-banana/${encodeURIComponent(taskId)}`)
    };
  }

  async queryTask(taskId: string, job: DrawJob, settings: StoredSettings): Promise<ProviderTaskResult> {
    const payload = await fetchJson<{
      code?: number;
      msg?: string;
      data?: { state?: string; msg?: string; data?: { images?: Array<{ url?: string }> } };
    }>(
      job.queryUrl || this.getNanoBananaEndpoint(settings, `/nano-banana/${encodeURIComponent(taskId)}`),
      {
        method: "GET",
        headers: {
          Authorization: settings.apiKey
        }
      },
      "查询 NANO-BANANA 任务状态"
    );

    if (payload?.code !== 200) {
      throw new Error(getErrorMessage(payload, "查询 NANO-BANANA 任务状态失败"));
    }

    const taskState = payload?.data?.state;
    if (taskState === "succeeded") {
      const imageUrl = payload?.data?.data?.images?.find((img) => typeof img.url === "string" && img.url.trim())?.url;
      if (!imageUrl) throw new Error("NANO-BANANA 任务已完成，但未返回图片地址");
      return { state: "succeeded", imageUrl };
    }
    if (taskState === "error") {
      return {
        state: "error",
        errorMessage: payload?.data?.msg?.trim() || getErrorMessage(payload, `NANO-BANANA 任务失败：${taskId}`)
      };
    }
    if (taskState === "pending" || taskState === "running") {
      return { state: taskState };
    }
    throw new Error("NANO-BANANA 查询结果缺少有效的任务状态");
  }
}
