import type { DrawJob } from "../types";

type JobImageFields = Pick<DrawJob, "outputImageUrl" | "outputImageUrls">;

export const getJobOutputImages = (job: JobImageFields) => {
  const outputImageUrls = (job.outputImageUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const currentImageUrl = job.outputImageUrl?.trim();

  if (!currentImageUrl || outputImageUrls[outputImageUrls.length - 1] === currentImageUrl) {
    return outputImageUrls;
  }

  return [...outputImageUrls, currentImageUrl];
};
