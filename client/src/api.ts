import type {
  CreateJobPayload,
  DrawFolder,
  DrawJob,
  HealthPayload,
  ImageProviderSettings,
  UpdateImageProviderSettingsPayload
} from "./types";

const API_BASE = "/api";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? `请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const api = {
  health: () => request<HealthPayload>("/health"),

  listFolders: () => request<DrawFolder[]>("/folders"),

  createFolder: (name: string) =>
    request<DrawFolder>("/folders", {
      method: "POST",
      body: JSON.stringify({ name })
    }),

  updateFolder: (
    id: string,
    patch: Partial<Pick<DrawFolder, "name" | "canvasZoom" | "canvasPanX" | "canvasPanY">>
  ) =>
    request<DrawFolder>(`/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    }),

  listJobs: (folderId: string) => request<DrawJob[]>(`/folders/${folderId}/jobs`),

  createJobs: (folderId: string, payload: CreateJobPayload) =>
    request<DrawJob[]>(`/folders/${folderId}/jobs`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  retryJob: (jobId: string) =>
    request<DrawJob>(`/jobs/${jobId}/retry`, {
      method: "POST"
    }),

  /**
   * 🐱 更新卡片在画布上的自由拖拽位置
   * 主人把卡片拖到新位置后，人家帮你保存到服务器喵~
   */
  updateJobPosition: (jobId: string, posX: number, posY: number) =>
    request<DrawJob>(`/jobs/${jobId}/position`, {
      method: "PATCH",
      body: JSON.stringify({ posX, posY })
    }),

  reorderJobs: (folderId: string, orderedIds: string[]) =>
    request<DrawJob[]>(`/folders/${folderId}/jobs/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ orderedIds })
    }),

  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${API_BASE}/uploads/image`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(error?.message ?? "上传失败");
    }

    return response.json() as Promise<{ url: string; originalName: string }>;
  },

  getImageProviderSettings: () =>
    request<ImageProviderSettings>("/settings/image-provider"),

  updateImageProviderSettings: (payload: UpdateImageProviderSettingsPayload) =>
    request<ImageProviderSettings>("/settings/image-provider", {
      method: "PATCH",
      body: JSON.stringify(payload)
    })
};
