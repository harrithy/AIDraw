import { ArrowUpRight, Edit2, Folder, FolderPlus, HardDrive, Layers, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { formatDate } from "../../lib/format";
import type { GeneratedImageStats } from "../../lib/generatedImageStats";
import type { DrawFolder } from "../../types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";

/** LeftSidebar 组件的 Props 类型 */
type LeftSidebarProps = {
  /** 侧边栏是否展开 */
  isOpen: boolean;
  /** 所有文件夹列表 */
  folders: DrawFolder[];
  /** 全部文件夹及各文件夹当前保留的生成图片数量，包含重绘历史。 */
  generatedImageStats: GeneratedImageStats;
  /** 当前激活的文件夹 ID */
  activeFolderId: string | null;
  folderName: string;
  onFolderNameChange: (value: string) => void;
  onCreateFolder: (event: FormEvent) => void;
  onSelectFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
};

/**
 * 左侧文件夹导航栏。
 * 支持创建、选择、重命名和删除文件夹，每个文件夹对应独立的绘图画布。
 */
export function LeftSidebar({
  isOpen,
  folders,
  generatedImageStats,
  activeFolderId,
  folderName,
  onFolderNameChange,
  onCreateFolder,
  onSelectFolder,
  onRenameFolder,
  onDeleteFolder
}: LeftSidebarProps) {
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  return (
    <aside
      className={`floating-panel left-panel ${isOpen ? "open" : "closed"}`}
      data-layout-obstacle={isOpen ? "sidebar" : undefined}
      aria-label="文件夹导航"
      inert={!isOpen}
    >
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <Layers size={23} strokeWidth={1.7} />
        </div>
        <div>
          <p>AIDraw</p>
          <span>你的 AI 创作空间</span>
        </div>
      </div>

      <div className="sidebar-section-heading">
        <span>工作空间</span><span>{folders.length.toString().padStart(2, "0")}</span>
      </div>
      <form className="folder-form" onSubmit={onCreateFolder} data-tour="folder-create">
        <input
          value={folderName}
          onChange={(event) => onFolderNameChange(event.target.value)}
          placeholder="新文件夹名称"
          aria-label="新文件夹名称"
        />
        <button type="submit" title="创建文件夹" aria-label="创建文件夹">
          <FolderPlus size={18} />
        </button>
      </form>

      <nav className="folder-list" aria-label="创作文件夹">
        {folders.length === 0 ? (
          <div className="sidebar-empty">
            <Folder size={24} strokeWidth={1.3} />
            <strong>给灵感一个位置</strong>
            <p>创建文件夹，整理你的第一组作品。</p>
          </div>
        ) : null}
        {folders.map((folder) => (
          <div
            key={folder.id}
            className={`folder-item ${folder.id === activeFolderId ? "active" : ""}`}
          >
            <Folder size={17} className="folder-icon" />
            
            {editingFolderId === folder.id ? (
              <input
                className="folder-name-input"
                defaultValue={folder.name}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const newName = e.currentTarget.value.trim();
                    if (newName && newName !== folder.name) {
                      onRenameFolder(folder.id, newName);
                    }
                    setEditingFolderId(null);
                  } else if (e.key === "Escape") {
                    setEditingFolderId(null);
                  }
                }}
                onBlur={(e) => {
                  const newName = e.target.value.trim();
                  if (newName && newName !== folder.name) {
                    onRenameFolder(folder.id, newName);
                  }
                  setEditingFolderId(null);
                }}
              />
            ) : (
              <button
                type="button"
                className="folder-name"
                aria-current={folder.id === activeFolderId ? "page" : undefined}
                onClick={() => onSelectFolder(folder.id)}
              >
                {folder.name}
              </button>
            )}

            <small className="folder-meta">
              <span>{formatDate(folder.createdAt)}</span>
              <span className="folder-image-count" aria-label={`${folder.name}已生成图片数量`}>
                {(generatedImageStats.byFolderId.get(folder.id) ?? 0).toLocaleString("zh-CN")} 张图片
              </span>
            </small>

            {!editingFolderId && (
              <div className="folder-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="folder-action-btn" onClick={() => setEditingFolderId(folder.id)} title="重命名">
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  className="folder-action-btn"
                  onClick={() => setDeleteFolderId(folder.id)}
                  title="删除"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-storage">
          <HardDrive size={17} />
          <div><strong>本地工作区</strong><span>创作记录保存在此浏览器</span></div>
          <span className="connection-dot" />
        </div>
        <a href="https://github.com/harrithy/AIDraw" target="_blank" rel="noreferrer">
          AIDraw · 为灵感而生<ArrowUpRight size={13} />
        </a>
      </div>

      <Dialog open={!!deleteFolderId} onOpenChange={(open) => { if (!open) setDeleteFolderId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除文件夹</DialogTitle>
            <DialogDescription>
              确定要删除这个文件夹吗？内部的所有绘图记录也会丢失。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFolderId(null)}>取消</Button>
            <Button
              variant="default"
              onClick={() => {
                if (deleteFolderId) {
                  onDeleteFolder(deleteFolderId);
                  setDeleteFolderId(null);
                }
              }}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
