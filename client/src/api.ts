import { foldersApi } from "./lib/api/foldersApi";
import { healthApi } from "./lib/api/healthApi";
import { jobsApi } from "./lib/api/jobsApi";
import { providerSettingsApi } from "./lib/api/providerSettingsApi";
import { uploadedImagesApi } from "./lib/api/uploadedImagesApi";

/**
 * UI 层统一使用的纯前端 API 门面。
 * 具体的数据存储、任务队列、图床和绘图平台请求都由独立模块负责。
 */
export const api = {
  ...healthApi,
  ...foldersApi,
  ...jobsApi,
  ...uploadedImagesApi,
  ...providerSettingsApi
};
