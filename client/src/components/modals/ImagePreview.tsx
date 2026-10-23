import { formatDate } from "../../lib/format";
import { isNanoBananaModel, supportsNanoBananaImageSize } from "../../lib/imageModels";
import { getJobOutputImages, getJobVisualKind } from "../../lib/jobImages";
import type { DrawJob } from "../../types";
import { MediaPreview } from "./MediaPreview";

/** 任务预览只负责转换任务数据，弹层、图片和版本对比均复用公共组件。 */
export function ImagePreview({ job, onClose, onUseImage }: {
  job: DrawJob | null;
  onClose: () => void;
  onUseImage?: (url: string) => void;
}) {
  const urls = job ? getJobOutputImages(job) : [];
  const currentUrl = urls[urls.length - 1];
  const isVideo = job && getJobVisualKind(job, currentUrl) === "video";
  const usesNanoBanana = job && isNanoBananaModel(job.model);
  const quality = job && usesNanoBanana
    ? supportsNanoBananaImageSize(job.model) ? job.imageSize ?? "4K" : "自动"
    : job?.thinking === "low" || job?.thinking === "medium" || job?.thinking === "high" ? job.thinking : "high";
  const description = job
    ? `${formatDate(job.createdAt)} · ${isVideo ? "格式 MP4" : usesNanoBanana ? "分辨率 " + quality : "quality " + quality} · ${job.size || `${job.width}x${job.height}`}${urls.length > 1 ? ` · 共 ${urls.length} 个版本` : ""}`
    : undefined;

  return (
    <MediaPreview
      items={job ? urls.map((url, index) => ({
        url,
        alt: urls.length > 1 ? `${job.prompt}，版本 ${index + 1}` : job.prompt,
        kind: getJobVisualKind(job, url) ?? "image"
      })) : []}
      comparisonKey={job?.id}
      onClose={onClose}
      onUseImage={onUseImage}
      downloadName={job?.prompt}
      title={job?.prompt}
      description={description}
    />
  );
}
