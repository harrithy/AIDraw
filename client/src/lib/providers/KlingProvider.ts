import type { DrawJob } from "../../types";
import type { CreatedProviderTask, ImageModelProvider, ProviderTaskResult, StoredSettings } from "./types";

const DEFAULT_BASE_URL = "https://duomiapi.com";
const REQUEST_TIMEOUT_MS = 60 * 1000;

const getKlingTaskType = (inputImages: string[]) => {
  if (inputImages.length === 0) return "text2video";
  if (inputImages.length === 1) return "image2video";
  return "multi-image2video";
};

/** 校验图片地址是否为公网 http(s) URL，Kling 图生视频要求参考图为公网地址 */
const isRemoteImageUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/** 断言参考图均为公网 URL，本地图片或 data URL 会直接抛错 */
const assertKlingImageUrls = (imageUrls: string[]) => {
  const hasInvalidImage = imageUrls.some((imageUrl) => !isRemoteImageUrl(imageUrl));
  if (hasInvalidImage) {
    throw new Error("可灵 API 的参考图只支持公网 http(s) 图片 URL，不能直接发送本地图片或 data URL");
  }
};

/** 从接口返回体中提取最可读的错误信息，取不到时回退到 fallback 文案 */
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

/** 带超时控制的 JSON 请求封装，网络/超时错误转换为可读的中文提示 */
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
      throw new Error("浏览器直连多米 API 失败：可能是 CORS 限制、网络不可达，或 Base URL 无法从浏览器访问");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

/**
 * Kling（可灵）视频生成提供者，复用多米 API 的账号与 Key。
 * 按输入图数量选择接口：
 * - 无输入图：POST /api/video/kling/v1/videos/text2video
 * - 1 张输入图：POST /api/video/kling/v1/videos/image2video
 * - 多张输入图：POST /api/video/kling/v1/videos/multi-image2video
 * 任务状态通过 GET {type}/{task_id} 轮询，视频结果取 task_result.videos[0].url（mp4）。
 */
export class KlingProvider implements ImageModelProvider {
  private getKlingEndpoint(settings: StoredSettings, path: string) {
    const configuredBaseUrl = (settings.baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
    return `${configuredBaseUrl}${path}`;
  }

  private getQueryUrl(settings: StoredSettings, taskId: string, job: DrawJob) {
    const inputImages = job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [];
    const taskType = getKlingTaskType(inputImages);
    return this.getKlingEndpoint(settings, `/api/video/kling/v1/videos/${taskType}/${encodeURIComponent(taskId)}`);
  }

  async createTask(job: DrawJob, settings: StoredSettings): Promise<CreatedProviderTask> {
    const inputImages = job.inputImageUrls?.length ? job.inputImageUrls : job.inputImageUrl ? [job.inputImageUrl] : [];
    if (inputImages.length > 0) assertKlingImageUrls(inputImages);

    const aspectRatio = job.size && job.size.includes(":") ? job.size : "16:9";
    const requestBody: Record<string, unknown> = {
      model_name: job.model,
      prompt: job.prompt.trim(),
      mode: job.thinking === "high" ? "pro" : "std",
      aspect_ratio: aspectRatio,
      duration: job.duration ?? 5,
      cfg_scale: 0.5,
      sound: job.sound ?? "off"
    };
    const negativePrompt = job.negativePrompt?.trim();
    if (negativePrompt) {
      requestBody.negative_prompt = job.negativePrompt;
    }

    const taskType = getKlingTaskType(inputImages);
    if (inputImages.length === 1) {
      requestBody.image = inputImages[0];
    } else if (inputImages.length > 1) {
      requestBody.image_list = inputImages.map((imageUrl) => ({ image: imageUrl }));
    }

    const payload = await fetchJson<{ code?: number; message?: string; data?: { task_id?: string } }>(
      this.getKlingEndpoint(settings, `/api/video/kling/v1/videos/${taskType}`),
      {
        method: "POST",
        headers: {
          Authorization: settings.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      },
      "提交 Kling 视频生成任务"
    );

    const taskId = payload?.data?.task_id;
    if (!taskId) {
      // code=0 时顶层 message 常为 "SUCCEED" 等成功文案，缺 task_id 属于响应异常，用固定文案避免误导
      throw new Error(
        payload?.code === 0 ? "Kling API 未返回视频任务 id" : getErrorMessage(payload, "Kling API 未返回视频任务 id")
      );
    }
    return {
      taskId,
      queryUrl: this.getKlingEndpoint(settings, `/api/video/kling/v1/videos/${taskType}/${encodeURIComponent(taskId)}`)
    };
  }

  async queryTask(taskId: string, job: DrawJob, settings: StoredSettings): Promise<ProviderTaskResult> {
    const payload = await fetchJson<{
      code?: number;
      message?: string;
      data?: {
        task_id?: string;
        task_status?: string;
        task_status_msg?: string | null;
        message?: string;
        task_result?: {
          images?: Array<{ url?: string }> | null;
          videos?: Array<{ id?: string; url?: string; duration?: string }>;
        };
      };
    }>(
      job.queryUrl || this.getQueryUrl(settings, taskId, job),
      {
        method: "GET",
        headers: {
          Authorization: settings.apiKey
        }
      },
      "查询 Kling 视频任务状态"
    );

    // 顶层 code 非 0（如无效 task_id、配额不足、参数错误）或缺少 data 时属于 API 级错误，
    // 直接报错，避免被当成未知状态一直白轮询到超时
    if ((typeof payload?.code === "number" && payload.code !== 0) || !payload?.data) {
      return { state: "error", errorMessage: getErrorMessage(payload, "Kling 任务查询失败") };
    }

    const taskStatus = payload.data.task_status;
    if (taskStatus === "succeed") {
      const videoUrl = payload?.data?.task_result?.videos?.find((video) => typeof video.url === "string" && video.url.trim())
        ?.url;
      if (!videoUrl) throw new Error("Kling 视频任务已完成，但未返回视频地址");
      return { state: "succeeded", imageUrl: videoUrl };
    }
    if (taskStatus === "failed" || taskStatus === "fail" || taskStatus === "error") {
      const statusMessage = payload?.data?.task_status_msg?.trim();
      const dataMessage = payload?.data?.message?.trim();
      const topMessage = typeof payload?.message === "string" ? payload.message.trim() : "";
      const errorMessage = [statusMessage, dataMessage, topMessage].find((value) => value) ||
        getErrorMessage(payload, `Kling 视频任务失败：${taskId}`);
      return { state: "error", errorMessage };
    }
    return { state: "pending" };
  }
}
