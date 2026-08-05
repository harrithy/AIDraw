import type { UploadedImage } from "../../types";
import { createFileFromMediaUrl, uploadMediaToHost } from "../imageHost";
import { isVideoModel } from "../imageModels";
import { getJobOutputImages } from "../jobImages";
import { FOLDER_STORE, openDb, UPLOADED_IMAGE_STORE } from "../storage/database";
import { ensureFolder, ensureJob } from "../storage/entities";
import { createId, nowIso, sortUploadedImages } from "../storage/helpers";
import { broadcastStateUpdate } from "../storage/stateSync";

const uploadImage = async (folderId: string, file: File): Promise<UploadedImage> => {
  await ensureFolder(folderId);
  const image: UploadedImage = {
    id: createId(),
    folderId,
    url: await uploadMediaToHost(file),
    originalName: file.name || "上传素材",
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
    createdAt: nowIso()
  };
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([FOLDER_STORE, UPLOADED_IMAGE_STORE], "readwrite");
    const folderReq = transaction.objectStore(FOLDER_STORE).get(folderId);
    let folderExists = true;

    folderReq.onsuccess = () => {
      if (!folderReq.result) {
        folderExists = false;
        return;
      }
      transaction.objectStore(UPLOADED_IMAGE_STORE).add(image);
    };
    folderReq.onerror = () => reject(folderReq.error);
    transaction.oncomplete = () => {
      if (folderExists) resolve();
      else reject(new Error("文件夹不存在"));
    };
    transaction.onerror = () => reject(transaction.error);
  });

  broadcastStateUpdate(folderId);
  return image;
};

/**
 * 已上传素材管理 API，封装图片/视频上传、列表查询和删除操作。
 * 上传流程：本地文件 → 图床 → 公网 URL → IndexedDB 记录。
 */
export const uploadedImagesApi = {
  /**
   * 列出指定文件夹下所有已上传素材，按创建时间倒序。
   * @param folderId - 文件夹 ID
   * @returns 排序后的已上传素材数组
   */
  listUploadedImages: async (folderId: string): Promise<UploadedImage[]> => {
    const db = await openDb();
    await ensureFolder(folderId);
    return new Promise<UploadedImage[]>((resolve, reject) => {
      const transaction = db.transaction(UPLOADED_IMAGE_STORE, "readonly");
      const req = transaction.objectStore(UPLOADED_IMAGE_STORE).index("folderId").getAll(folderId);
      req.onsuccess = () => resolve(sortUploadedImages((req.result || []) as UploadedImage[]));
      req.onerror = () => reject(req.error);
    });
  },

  uploadImage,

  /**
   * 将任务生成的最新图片或视频上传到图床并记录。
   * @param jobId - 任务 ID
   * @returns 上传后的素材记录
   */
  uploadLatestJobMedia: async (jobId: string): Promise<UploadedImage> => {
    const job = await ensureJob(jobId);
    const outputMedia = getJobOutputImages(job);
    const latestMediaUrl = outputMedia[outputMedia.length - 1];
    if (!latestMediaUrl) throw new Error("该任务还没有可上传的结果");

    const file = await createFileFromMediaUrl(latestMediaUrl, job.id, isVideoModel(job.model) ? "video" : "image");
    return uploadImage(job.folderId, file);
  },

  /**
   * 删除指定已上传素材的记录。
   * @param imageId - 素材记录 ID
   */
  deleteUploadedImage: async (imageId: string): Promise<void> => {
    const db = await openDb();
    let folderId = "";

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(UPLOADED_IMAGE_STORE, "readwrite");
      const store = transaction.objectStore(UPLOADED_IMAGE_STORE);
      const getReq = store.get(imageId);

      getReq.onsuccess = () => {
        const image = getReq.result as UploadedImage | undefined;
        if (!image) return;
        folderId = image.folderId;
        store.delete(imageId);
      };
      getReq.onerror = () => reject(getReq.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    if (folderId) broadcastStateUpdate(folderId);
  }
};
