import { FolderPlus, Layers, Palette } from "lucide-react";
import { FormEvent } from "react";
import { formatDate } from "../../lib/format";
import type { DrawFolder } from "../../types";

type LeftSidebarProps = {
  isOpen: boolean;
  folders: DrawFolder[];
  activeFolderId: string | null;
  folderName: string;
  onFolderNameChange: (value: string) => void;
  onCreateFolder: (event: FormEvent) => void;
  onSelectFolder: (folderId: string) => void;
};

export function LeftSidebar({
  isOpen,
  folders,
  activeFolderId,
  folderName,
  onFolderNameChange,
  onCreateFolder,
  onSelectFolder
}: LeftSidebarProps) {
  return (
    <aside className={`floating-panel left-panel ${isOpen ? "open" : "closed"}`}>
      <div className="brand">
        <div className="brand-mark">
          <Palette size={24} />
        </div>
        <div>
          <p>AIDraw</p>
          <span>AI 绘图工作流</span>
        </div>
      </div>

      <form className="folder-form" onSubmit={onCreateFolder} data-tour="folder-create">
        <input
          value={folderName}
          onChange={(event) => onFolderNameChange(event.target.value)}
          placeholder="新文件夹名称"
        />
        <button type="submit" title="创建文件夹">
          <FolderPlus size={18} />
        </button>
      </form>

      <div className="folder-list">
        {folders.map((folder) => (
          <button
            type="button"
            key={folder.id}
            className={`folder-item ${folder.id === activeFolderId ? "active" : ""}`}
            onClick={() => onSelectFolder(folder.id)}
          >
            <Layers size={17} />
            <span>{folder.name}</span>
            <small>{formatDate(folder.createdAt)}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
