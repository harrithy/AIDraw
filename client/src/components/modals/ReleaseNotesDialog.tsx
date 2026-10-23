import { useEffect, useState } from "react";
import {
  CheckCheck,
  Calendar,
  CircleCheckBig,
  ExternalLink,
  Github,
  Megaphone,
  Sparkles,
  Wrench
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { Button } from "../ui/button";
import {
  syncAndGetAllReleases,
  getUnreadReleasesCount,
  isReleaseRead,
  markAllReleasesAsRead,
  markReleaseAsRead,
  LATEST_RELEASE,
  type ReleaseNote
} from "../../lib/changelog";

type ReleaseNotesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge?: () => void;
};

export function ReleaseNotesDialog({ open, onOpenChange, onAcknowledge }: ReleaseNotesDialogProps) {
  const [allReleases, setAllReleases] = useState<ReleaseNote[]>(() => syncAndGetAllReleases());
  const [selectedVersion, setSelectedVersion] = useState<string>(LATEST_RELEASE.version);
  const [unreadCount, setUnreadCount] = useState<number>(() => getUnreadReleasesCount());

  // 弹窗开启时同步最新数据
  useEffect(() => {
    if (open) {
      const synced = syncAndGetAllReleases();
      setAllReleases(synced);
      setUnreadCount(getUnreadReleasesCount());
      setSelectedVersion(synced[0]?.version || LATEST_RELEASE.version);
    }
  }, [open]);

  const activeRelease: ReleaseNote =
    allReleases.find((item) => item.version === selectedVersion) || allReleases[0] || LATEST_RELEASE;

  const isLatest = activeRelease.version === LATEST_RELEASE.version;

  // 一键已读全部版本
  const handleMarkAllAsRead = () => {
    markAllReleasesAsRead();
    setUnreadCount(0);
    if (onAcknowledge) onAcknowledge();
  };

  // 用户点击「我知道了喵」确认已读当前版本
  const handleAcknowledge = () => {
    markReleaseAsRead(LATEST_RELEASE.version);
    setUnreadCount(getUnreadReleasesCount());
    if (onAcknowledge) onAcknowledge();
    onOpenChange(false);
  };

  // 分类归集
  const featureItems = activeRelease.items.filter((i) => i.category === "feature");
  const otherItems = activeRelease.items.filter((i) => i.category === "improvement" || i.category === "fix");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="anime-release-dialog">
        {/* 更新简报 Header */}
        <DialogHeader className="anime-release-header">
          <div className="anime-release-header-inner">
            <div className="anime-release-identity">
              <div className="anime-cat-avatar">
                <Megaphone aria-hidden="true" size={18} strokeWidth={1.8} />
              </div>
              <div className="anime-release-heading">
                <div className="anime-release-title-row">
                  <DialogTitle className="anime-release-title">
                    <span>更新日志</span>
                    <span className="anime-release-kicker">
                      PATCH LOG
                    </span>
                  </DialogTitle>
                </div>
                <DialogDescription className="anime-release-description">
                  <Calendar aria-hidden="true" size={12} strokeWidth={1.8} />
                  <span>版本记录 · {activeRelease.date}</span>
                </DialogDescription>
              </div>
            </div>

            <div className="anime-release-actions">
              {/* 一键全阅按钮 */}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="anime-mark-read-btn"
                  title="将所有版本标记为已读"
                >
                  <CheckCheck aria-hidden="true" size={14} strokeWidth={1.8} />
                  <span>一键已读 ({unreadCount})</span>
                </button>
              )}

              {/* 历史版本下拉选择 */}
              <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                <SelectTrigger className="anime-version-select-trigger">
                  <SelectValue placeholder="选择版本">
                    <div className="anime-version-value">
                      <span className="anime-version-number">
                        <Sparkles aria-hidden="true" size={12} strokeWidth={1.8} />
                        {selectedVersion}
                      </span>
                      {isLatest ? (
                        <span className="anime-version-status">NEW</span>
                      ) : !isReleaseRead(selectedVersion) ? (
                        <span className="anime-unread-dot" aria-label="未读版本" />
                      ) : null}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="end"
                  sideOffset={4}
                  className="anime-version-select-content"
                >
                  {allReleases.map((rel) => {
                    const isRelLatest = rel.version === LATEST_RELEASE.version;
                    const isUnread = !isReleaseRead(rel.version);
                    return (
                      <SelectItem
                        key={rel.version}
                        value={rel.version}
                        className="anime-select-item"
                      >
                        <div className="anime-select-item-content">
                          <div className="anime-select-version">
                            <span>{rel.version}</span>
                            {isUnread && <span className="anime-unread-dot" aria-label="未读版本" />}
                          </div>
                          {isRelLatest ? (
                            <span className="anime-version-status">NEW</span>
                          ) : (
                            <span className="anime-select-date">{rel.date}</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* 内容主体 */}
        <div className="anime-release-content">
          {/* 版本摘要先于具体更新项展示，方便快速浏览。 */}
          <div className="anime-yuki-bubble">
            <div className="anime-yuki-tag">
              <span className="anime-yuki-badge">
                <Sparkles aria-hidden="true" size={13} strokeWidth={1.9} />
                本次更新
              </span>
              <span className="anime-yuki-label">STUDIO DISPATCH</span>
            </div>
            <p className="anime-yuki-copy">
              <strong>{activeRelease.version}</strong>
              <span> {activeRelease.summary}</span>
            </p>
          </div>

          {/* 新增功能模块 */}
          {featureItems.length > 0 && (
            <div className="anime-section">
              <div className="anime-section-header">
                <span className="anime-section-index">01</span>
                <span className="anime-section-icon feature">
                  <Sparkles aria-hidden="true" size={13} strokeWidth={1.9} />
                </span>
                <span className="anime-section-title">
                  新增功能
                </span>
                <div className="anime-section-line" />
              </div>
              <div className="anime-feature-cards">
                {featureItems.map((item, idx) => (
                  <div key={idx} className="anime-feature-card">
                    <div className="anime-feature-card-header">
                      <div className="anime-feature-title">
                        <CircleCheckBig aria-hidden="true" size={14} strokeWidth={1.8} />
                        <strong>
                          {item.title}
                        </strong>
                      </div>
                      {item.tag && (
                        <span className="anime-tag-badge feature">
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <p className="anime-feature-description">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 优化与修复模块 */}
          {otherItems.length > 0 && (
            <div className="anime-section">
              <div className="anime-section-header">
                <span className="anime-section-index">02</span>
                <span className="anime-section-icon fix">
                  <Wrench aria-hidden="true" size={13} strokeWidth={1.9} />
                </span>
                <span className="anime-section-title">
                  优化与修复
                </span>
                <div className="anime-section-line" />
              </div>
              <div className="anime-feature-cards">
                {otherItems.map((item, idx) => (
                  <div key={idx} className="anime-feature-card sub">
                    <div className="anime-feature-card-header">
                      <div className="anime-feature-title">
                        <Wrench aria-hidden="true" size={14} strokeWidth={1.8} />
                        <strong>
                          {item.title}
                        </strong>
                      </div>
                      {item.tag && (
                        <span className="anime-tag-badge sub">
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <p className="anime-feature-description">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <DialogFooter className="anime-release-footer">
          <button
            type="button"
            onClick={() => window.open("https://github.com/harrithy/AIDraw", "_blank", "noopener,noreferrer")}
            className="anime-footer-link"
          >
            <Github aria-hidden="true" size={14} strokeWidth={1.8} />
            <span>GitHub 开源仓</span>
            <ExternalLink aria-hidden="true" size={11} strokeWidth={1.8} />
          </button>

          <Button
            type="button"
            onClick={handleAcknowledge}
            className="anime-primary-cta"
          >
            <CheckCheck aria-hidden="true" size={15} strokeWidth={2} />
            <span>知道了</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
