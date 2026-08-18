import { useEffect, useState } from "react";
import {
  CheckCheck,
  Calendar,
  ExternalLink,
  Sparkles,
  Heart,
  Bot,
  Zap,
  Rocket
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
        {/* 顶部二次元机能风 Header */}
        <DialogHeader className="anime-release-header">
          <div className="flex items-center justify-between gap-3 w-full pr-8">
            <div className="flex items-center gap-2.5">
              <div className="anime-cat-avatar">
                <span className="anime-cat-emoji">🐾</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-sm font-black tracking-wide anime-gradient-text flex items-center gap-1.5">
                    <span>系统更新通报</span>
                    <span className="text-[10px] tracking-normal font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      PATCH LOG
                    </span>
                  </DialogTitle>
                </div>
                <DialogDescription className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 mt-0.5 font-medium">
                  <Sparkles size={11} className="text-pink-400 animate-spin" style={{ animationDuration: "6s" }} />
                  <span>雪奈核心指令集 · {activeRelease.date}</span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* 一键全阅按钮 */}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="anime-mark-read-btn"
                  title="将所有版本标记为已读"
                >
                  <CheckCheck size={12} className="text-pink-400" />
                  <span>一键已读 ({unreadCount})</span>
                </button>
              )}

              {/* 历史版本下拉选择 */}
              <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                <SelectTrigger className="anime-version-select-trigger h-7.5 w-[140px] text-xs font-bold">
                  <SelectValue placeholder="选择版本">
                    <div className="flex items-center justify-between w-full pr-1 text-xs font-bold">
                      <span className="text-emerald-600 dark:text-emerald-400">✦ {selectedVersion}</span>
                      {isLatest ? (
                        <span className="text-[10px] font-black text-pink-500">NEW</span>
                      ) : !isReleaseRead(selectedVersion) ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
                      ) : null}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="end"
                  sideOffset={4}
                  className="anime-version-select-content w-[150px] min-w-[150px] p-1 shadow-2xl"
                >
                  {allReleases.map((rel) => {
                    const isRelLatest = rel.version === LATEST_RELEASE.version;
                    const isUnread = !isReleaseRead(rel.version);
                    return (
                      <SelectItem
                        key={rel.version}
                        value={rel.version}
                        className="anime-select-item text-xs font-medium cursor-pointer py-1.5 px-2 rounded-md"
                      >
                        <div className="flex items-center justify-between w-full gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[var(--ink)]">✦ {rel.version}</span>
                            {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />}
                          </div>
                          {isRelLatest ? (
                            <span className="text-[10px] font-black text-pink-500">NEW</span>
                          ) : (
                            <span className="text-[10px] text-[var(--muted)]">{rel.date}</span>
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
          {/* 小雪专属赛博猫娘气泡导语 */}
          <div className="anime-yuki-bubble">
            <div className="anime-yuki-tag">
              <span className="anime-yuki-badge">🐱 小雪 Yuki</span>
              <span className="text-[10px] text-pink-500 font-bold">喵～🐾</span>
            </div>
            <p className="text-xs text-[var(--ink)] leading-relaxed font-medium mt-1">
              报告主人！本次 <strong className="text-emerald-500 font-bold">{activeRelease.version}</strong> 算力核心装填完毕：
              <span className="text-[var(--muted)]"> {activeRelease.summary}</span>
            </p>
          </div>

          {/* 新增功能模块 */}
          {featureItems.length > 0 && (
            <div className="anime-section">
              <div className="anime-section-header">
                <span className="anime-section-icon feature">★</span>
                <span className="anime-section-title">核心机能实装 · NEW FEATURES</span>
                <div className="anime-section-line" />
              </div>
              <div className="anime-feature-cards">
                {featureItems.map((item, idx) => (
                  <div key={idx} className="anime-feature-card">
                    <div className="anime-feature-card-header">
                      <div className="flex items-center gap-1.5">
                        <span className="anime-star">✦</span>
                        <strong className="text-xs font-bold text-[var(--ink)]">
                          {item.title}
                        </strong>
                      </div>
                      {item.tag && (
                        <span className="anime-tag-badge feature">
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)] leading-relaxed font-normal mt-1 pl-4">
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
                <span className="anime-section-icon fix">◆</span>
                <span className="anime-section-title">机体调校 & 修复 · ADJUSTMENTS</span>
                <div className="anime-section-line" />
              </div>
              <div className="anime-feature-cards">
                {otherItems.map((item, idx) => (
                  <div key={idx} className="anime-feature-card sub">
                    <div className="anime-feature-card-header">
                      <div className="flex items-center gap-1.5">
                        <span className="anime-star sub">◆</span>
                        <strong className="text-xs font-bold text-[var(--ink)]">
                          {item.title}
                        </strong>
                      </div>
                      {item.tag && (
                        <span className="anime-tag-badge sub">
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)] leading-relaxed font-normal mt-1 pl-4">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮栏：二次元萌系交互 */}
        <DialogFooter className="anime-release-footer">
          <button
            type="button"
            onClick={() => window.open("https://github.com/harrithy/AIDraw", "_blank", "noopener,noreferrer")}
            className="anime-footer-link"
          >
            <ExternalLink size={12} className="text-pink-400" />
            <span>GitHub 开源仓 🐾</span>
          </button>

          <Button
            type="button"
            onClick={handleAcknowledge}
            className="anime-primary-cta"
          >
            <span>我知道了喵～ (๑•̀ㅂ•́)و✧</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
