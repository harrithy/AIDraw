import { Edit2, FolderPlus, Layers, Palette, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { formatDate } from "../../lib/format";
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

type LeftSidebarProps = {
  isOpen: boolean;
  folders: DrawFolder[];
  activeFolderId: string | null;
  folderName: string;
  onFolderNameChange: (value: string) => void;
  onCreateFolder: (event: FormEvent) => void;
  onSelectFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
};

export function LeftSidebar({
  isOpen,
  folders,
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
    <aside className={`floating-panel left-panel ${isOpen ? "open" : "closed"}`}>
      <div className="brand">
        <div className="brand-mark" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/logo.png" alt="AIDraw Logo" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
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
          <div
            key={folder.id}
            className={`folder-item ${folder.id === activeFolderId ? "active" : ""}`}
            onClick={() => onSelectFolder(folder.id)}
          >
            <Layers size={17} className="folder-icon" />
            
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
              <span className="folder-name">{folder.name}</span>
            )}

            <small>{formatDate(folder.createdAt)}</small>

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
