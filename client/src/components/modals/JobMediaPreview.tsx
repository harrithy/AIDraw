import { CloudUpload, Copy, Loader2, PenLine, Play, RotateCcw, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRef, useState } from "react";
import type { DrawJob } from "../../types";
import { Message } from "../ui/message";
import { MediaPreview, type MediaPreviewProps } from "./MediaPreview";

/** 普通结果与多版本预览共用任务操作，排序仍只放在画布卡片上。 */
export type JobPreviewOperations = {
  onRetry?: (jobId: string) => void;
  onEditRetry?: (job: DrawJob) => void;
  onDelete?: (jobId: string) => void;
  onUploadLatestMedia?: (jobId: string) => Promise<void>;
};

type Props = MediaPreviewProps & JobPreviewOperations & { job: DrawJob | null };

/** 在公共图片查看器上追加任务工具，不复制下载、缩放或版本对比逻辑。 */
export function JobMediaPreview({ job, onRetry, onEditRetry, onDelete, onUploadLatestMedia, ...preview }: Props) {
  const [uploading, setUploading] = useState(false);
  const uploadInProgress = useRef(false);
  const current = preview.items[preview.items.length - 1];
  const mediaLabel = current?.kind === "video" ? "视频" : "图片";
  const canRetry = job?.status === "completed" || job?.status === "failed";

  const copyLink = async () => {
    if (!current) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(current.url);
      else {
        // 兼容没有 Clipboard API 的页面，完成后恢复焦点并清理临时节点。
        const previousFocus = document.activeElement;
        const input = document.createElement("textarea");
        input.value = current.url;
        input.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(input);
        try {
          input.select();
          if (!document.execCommand("copy")) throw new Error("复制链接失败");
        } finally {
          input.remove();
          if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
        }
      }
      Message.success(`已复制${mediaLabel}链接`);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "复制链接失败");
    }
  };

  const uploadLatest = async () => {
    if (!job || !onUploadLatestMedia || uploadInProgress.current) return;
    uploadInProgress.current = true;
    setUploading(true);
    try {
      await onUploadLatestMedia(job.id);
      Message.success("最新结果已上传到图床");
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "上传最新结果失败");
    } finally {
      uploadInProgress.current = false;
      setUploading(false);
    }
  };

  return <MediaPreview {...preview}
    toolbarStart={job && canRetry && (onRetry || (onEditRetry && !job.capabilityId)) ? (
      <DropdownMenu.Root key={`retry-${job.id}`} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="image-preview-action" title="重新绘制" aria-label="重新绘制"><RotateCcw size={18} /></button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="preview-download-menu preview-task-menu" align="end" sideOffset={8} collisionPadding={12}
            aria-label="重新绘制方式" onEscapeKeyDown={(event) => event.stopPropagation()}>
            {onEditRetry && !job.capabilityId ? <DropdownMenu.Item className="preview-download-menu-item" onSelect={() => { preview.onClose(); onEditRetry(job); }}>
              <PenLine size={15} /><span>重新编辑</span>
            </DropdownMenu.Item> : null}
            {onRetry ? <DropdownMenu.Item className="preview-download-menu-item" onSelect={() => onRetry(job.id)}>
              <Play size={15} /><span>继续绘制</span>
            </DropdownMenu.Item> : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    ) : null}
    toolbarEnd={job && current ? <>
      <button type="button" className="image-preview-action" title={`复制${mediaLabel}链接`} aria-label={`复制${mediaLabel}链接`} onClick={() => void copyLink()}><Copy size={18} /></button>
      {onUploadLatestMedia ? <button type="button" className="image-preview-action" title="上传最新结果到图床" aria-label="上传最新结果到图床" disabled={uploading} onClick={() => void uploadLatest()}>
        {uploading ? <Loader2 className="spin" size={18} /> : <CloudUpload size={18} />}
      </button> : null}
      {onDelete ? <DropdownMenu.Root key={`delete-${job.id}`} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="image-preview-action preview-delete-action" title="删除盒子" aria-label="删除盒子"><Trash2 size={18} /></button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="preview-download-menu preview-task-menu" align="end" sideOffset={8} collisionPadding={12}
            aria-label="删除盒子确认" onEscapeKeyDown={(event) => event.stopPropagation()}>
            <DropdownMenu.Label className="preview-download-menu-heading">删除这个盒子？</DropdownMenu.Label>
            <p className="preview-delete-description">生成图片与相关数据都会被删除。</p>
            <DropdownMenu.Item className="preview-download-menu-item">取消</DropdownMenu.Item>
            <DropdownMenu.Item className="preview-download-menu-item is-destructive" onSelect={() => onDelete(job.id)}><Trash2 size={15} /><span>确定删除</span></DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root> : null}
    </> : null}
  />;
}
