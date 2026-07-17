import type { ApiProviderId, DrawJob } from "../../types";

export type StoredSettings = {
  baseUrl: string;
  model: string;
  apiKey: string;
  savedApiKeys?: string[];
  providerId: ApiProviderId;
  savedApiKeyProviderIds?: ApiProviderId[];
};

export type CreatedProviderTask = {
  taskId: string;
  queryUrl?: string;
};

export type ProviderTaskResult =
  | { state: "pending" }
  | { state: "running" }
  | { state: "succeeded"; imageUrl: string }
  | { state: "error"; errorMessage: string };

export interface ImageModelProvider {
  /**
   * 提交绘制任务到平台，返回任务 ID 和可持久化的查询地址
   */
  createTask(job: DrawJob, settings: StoredSettings): Promise<CreatedProviderTask>;

  /**
   * 只查询一次远程状态；轮询节奏和截止时间由队列统一管理
   */
  queryTask(taskId: string, job: DrawJob, settings: StoredSettings): Promise<ProviderTaskResult>;
}
