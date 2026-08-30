import { Download, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../../api";
import type { DrawFolder } from "../../types";
import { Message } from "../ui/message";

/** FolderTransferControls 组件的 Props 类型 */
type FolderTransferControlsProps = {
  /** 当前选中的文件夹，未选择时导出禁用 */
  folder: DrawFolder | null;
  /** 导入成功后的回调，参数为新文件夹 ID */
  onImported: (folderId: string) => void;
};

const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

/** 清理文件名中的非法字符。 */
const sanitizeFileName = (value: string) => {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 60) || "folder";
};

/**
 * 网页左上角（顶栏最左端）的文件夹导入/导出控件。
 * - 导出：把当前文件夹的任务列表、素材库与画布状态打包为 JSON 下载；
 * - 导入：读取 JSON 备份，生成一个全新文件夹并切换到它，不覆盖现有数据。
 */
export function FolderTransferControls({ folder, onImported }: FolderTransferControlsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = async () => {
    if (!folder || isExporting) return;
    setIsExporting(true);
    try {
      const backup = await api.exportFolderBackup(folder.id);
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);

      const stamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[-:T]/g, "");
      const fileName = `AIDraw-${sanitizeFileName(folder.name)}-${stamp}.json`;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      Message.success(
        `已导出「${folder.name}」：${backup.jobs.length} 个任务 · ${backup.uploadedImages.length} 个素材（媒体原文件未打包）`
      );
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isImporting) return;
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      Message.error("导入失败：JSON 备份不能超过 25 MB");
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("导入失败：文件不是有效的 JSON");
      }
      const createdFolder = await api.importFolderBackup(data);
      Message.success(`已导入「${createdFolder.name}」`);
      onImported(createdFolder.id);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="folder-transfer-controls">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={!folder || isExporting}
        title={folder ? `导出当前文件夹「${folder.name}」（保存记录和媒体链接，不包含媒体原文件）` : "请先选择文件夹再导出"}
        aria-label="导出当前文件夹"
      >
        {isExporting ? <Loader2 className="spin" size={17} /> : <Download size={17} />}
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        title="导入文件夹备份（.json）"
        aria-label="导入文件夹备份"
      >
        {isImporting ? <Loader2 className="spin" size={17} /> : <Upload size={17} />}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => void handleFileChange(event)}
      />
    </div>
  );
}
