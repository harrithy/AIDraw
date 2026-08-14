import { Braces, ExternalLink, Maximize2 } from "lucide-react";
import { memo, useState } from "react";
import { getJobOutputImages, getJobVisualKind } from "../../lib/jobImages";
import type { DrawJob, GeneratedAsset, GeneratedAssetKind } from "../../types";
import { AnimatedModal } from "../ui/AnimatedModal";
import { RetryingImage } from "../ui/RetryingImage";

/** 通用任务结果组件的属性。 */
type JobResultContentProps = {
  job: DrawJob;
};

const assetKindLabel: Record<GeneratedAssetKind, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  file: "文件"
};

/** 判断旧任务保存在图片字段里的结果是否实际为视频。 */
const getLegacyAssetKind = (job: DrawJob, url: string): GeneratedAssetKind =>
  getJobVisualKind(job, url) ?? "file";

/** 旧任务没有资产数组时，将历史图片字段转换成统一资产结构。 */
const getResultAssets = (job: DrawJob): GeneratedAsset[] => {
  if (job.outputAssets?.length) return job.outputAssets;

  return getJobOutputImages(job).map((url, index) => ({
    kind: getLegacyAssetKind(job, url),
    url,
    name: `结果 ${index + 1}`
  }));
};

/** 优先使用接口返回的名称，否则生成稳定、可读的资产名称。 */
const getAssetName = (asset: GeneratedAsset, index: number) => {
  const name = asset.name?.trim();
  if (name) return name;
  return `${assetKindLabel[asset.kind]} ${index + 1}`;
};

/** 将未知结构化结果安全地格式化为可读文本。 */
const formatOutputData = (value: unknown) => {
  if (typeof value === "string") return value;

  try {
    const serialized = JSON.stringify(
      value,
      (_key, nestedValue: unknown) => (typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue),
      2
    );
    return serialized ?? String(value);
  } catch {
    return String(value);
  }
};

/** 渲染单个图片或视频结果。 */
const MediaAsset = ({ asset, index, onPreview }: { asset: GeneratedAsset; index: number; onPreview: (asset: GeneratedAsset) => void }) => {
  const name = getAssetName(asset, index);

  if (!asset.url) {
    return (
      <article className={`job-result-asset job-result-${asset.kind}-asset is-unavailable`}>
        <span className="job-result-unavailable-label">{name}地址不可用</span>
      </article>
    );
  }

  return (
    <article className={`job-result-asset job-result-${asset.kind}-asset`}>
      <div className="job-result-media">
        {asset.kind === "video" ? (
          <video src={asset.url} controls playsInline preload="metadata" aria-label={name} />
        ) : (
          <button type="button" className="job-result-image-preview" onClick={() => onPreview(asset)} title={`预览${name}`}>
            <RetryingImage src={asset.url} alt={name} />
          </button>
        )}
      </div>
      <div className="job-result-asset-caption">
        <span>{name}</span>
        {asset.kind === "image" ? (
          <button type="button" className="job-result-preview-button" onClick={() => onPreview(asset)} title={`预览${name}`}>
            <Maximize2 size={15} aria-hidden="true" />
            <span>预览</span>
          </button>
        ) : null}
      </div>
    </article>
  );
};

/** 渲染单个音频或文件结果。 */
const AttachmentAsset = ({ asset, index }: { asset: GeneratedAsset; index: number }) => {
  const name = getAssetName(asset, index);

  if (asset.kind === "audio") {
    return (
      <article className="job-result-asset job-result-audio-asset">
        <span className="job-result-asset-name">{name}</span>
        {asset.url ? (
          <audio src={asset.url} controls preload="metadata" aria-label={name} />
        ) : (
          <span className="job-result-unavailable-label">音频地址不可用</span>
        )}
      </article>
    );
  }

  return (
    <article className="job-result-asset job-result-file-asset">
      {asset.url ? (
        <a href={asset.url} target="_blank" rel="noreferrer" className="job-result-file-link">
          <span>{name}</span>
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      ) : (
        <span className="job-result-unavailable-label">{name}地址不可用</span>
      )}
    </article>
  );
};

/**
 * 统一显示图片、视频、音频、文件、文本和结构化任务结果。
 * 新任务优先读取 outputAssets，旧任务继续兼容 outputImageUrl(s)。
 */
export const JobResultContent = memo(function JobResultContent({ job }: JobResultContentProps) {
  const [previewAsset, setPreviewAsset] = useState<GeneratedAsset | null>(null);
  const assets = getResultAssets(job);
  const mediaAssets = assets.filter((asset) => asset.kind === "image" || asset.kind === "video");
  const attachmentAssets = assets.filter((asset) => asset.kind === "audio" || asset.kind === "file");
  const hasOutputText = job.outputText !== undefined;
  const hasOutputData = job.outputData !== undefined;

  if (!assets.length && !hasOutputText && !hasOutputData) return null;

  return (
    <section className="job-result-content" aria-label="生成结果">
      {mediaAssets.length ? (
        <div className={`job-result-media-grid${mediaAssets.length > 1 ? " has-multiple-assets" : ""}`}>
          {mediaAssets.map((asset, index) => (
            <MediaAsset
              key={`${asset.kind}-${asset.url ?? "unavailable"}-${index}`}
              asset={asset}
              index={index}
              onPreview={setPreviewAsset}
            />
          ))}
        </div>
      ) : null}

      {attachmentAssets.length ? (
        <div className="job-result-attachment-list">
          {attachmentAssets.map((asset, index) => (
            <AttachmentAsset
              key={`${asset.kind}-${asset.url ?? "unavailable"}-${index}`}
              asset={asset}
              index={index}
            />
          ))}
        </div>
      ) : null}

      {hasOutputText ? (
        <section className="job-result-text" aria-label="文本结果">
          <pre>{job.outputText}</pre>
        </section>
      ) : null}

      {hasOutputData ? (
        <details className="job-result-data">
          <summary>
            <Braces size={15} aria-hidden="true" />
            <span>结构化结果</span>
          </summary>
          <pre>{formatOutputData(job.outputData)}</pre>
        </details>
      ) : null}

      <AnimatedModal
        open={Boolean(previewAsset?.url)}
        onClose={() => setPreviewAsset(null)}
        ariaLabel="图片结果预览"
      >
        {previewAsset?.url ? (
          <RetryingImage src={previewAsset.url} alt={previewAsset.name || job.prompt} />
        ) : null}
      </AnimatedModal>
    </section>
  );
});
