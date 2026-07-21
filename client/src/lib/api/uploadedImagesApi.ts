import type { UploadedImage } from "../../types";
import { createFileFromImageUrl, uploadImageToHost } from "../imageHost";
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
    url: await uploadImageToHost(file),
    originalName: file.name || "上传图片",
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

export const uploadedImagesApi = {
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

  uploadLatestJobImage: async (jobId: string): Promise<UploadedImage> => {
    const job = await ensureJob(jobId);
    const outputImages = getJobOutputImages(job);
    const latestImageUrl = outputImages[outputImages.length - 1];
    if (!latestImageUrl) throw new Error("该图片盒子还没有可上传的图片");

    const file = await createFileFromImageUrl(latestImageUrl, job.id);
    return uploadImage(job.folderId, file);
  },

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
