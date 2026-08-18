import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowRight, Check, CircleHelp, Clock, Copy, Github, LayoutGrid, LocateFixed, Maximize2, Megaphone, Moon, RefreshCw, Search, Settings, Sun, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { LayoutDirection } from "../../lib/canvas";
import { getJobOutputImages, getJobVisualKind } from "../../lib/jobImages";
import type { DrawJob } from "../../types";

/** CanvasToolbar 组件的 Props 类型 */
type CanvasToolbarProps = {
  /** 当前画布缩放比例 */
  zoom: number;
  /** 是否处于深色模式 */
  darkMode: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetCanvas: () => void;
  /** 当前文件夹是否已有可跳转的生成结果 */
  hasLatestOutput: boolean;
  onJumpToLatestOutput: () => void;
  onSortByTime: () => void;
  onOpenApiSettings: () => void;
  onOpenGuide: () => void;
  /** 打开版本更新公告弹窗 */
  onOpenAnnouncement?: () => void;
  /** 未读的版本更新公告数量 */
  unreadAnnouncementsCount?: number;
  onSortByName: () => void;
  onToggleTheme: () => void;
  /** 生成失败任务数量 */
  failedJobsCount?: number;
  /** 一键清理失败任务回调 */
  onClearFailedJobs?: () => void;
  /** 应用排版模板回调 */
  onApplyLayout?: (direction: LayoutDirection, gridColumns: number) => void;
  /** 搜索关键词 */
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  /** 当前画布上的所有任务，用于搜索过滤 */
  jobs: DrawJob[];
};

const fuzzyMatch = (str: string, pattern: string) => {
  if (!str) return false;
  pattern = pattern.toLowerCase();
  str = str.toLowerCase();
  let patternIdx = 0;
  let strIdx = 0;
  while (patternIdx < pattern.length && strIdx < str.length) {
    if (pattern[patternIdx] === str[strIdx]) {
      patternIdx++;
    }
    strIdx++;
  }
  return patternIdx === pattern.length;
};

/**
 * 画布工具栏组件。
 * 提供缩放控制、画布重置、排序模式切换、深色模式切换、
 * API 设置入口、新手引导入口及任务模糊搜索功能。
 */
export function CanvasToolbar({
  zoom,
  darkMode,
  onZoomOut,
  onZoomIn,
  onResetCanvas,
  hasLatestOutput,
  onJumpToLatestOutput,
  onSortByTime,
  onOpenApiSettings,
  onOpenGuide,
  onOpenAnnouncement,
  unreadAnnouncementsCount,
  onSortByName,
  onToggleTheme,
  failedJobsCount,
  onClearFailedJobs,
  onApplyLayout,
  searchQuery,
  onSearchQueryChange,
  jobs
}: CanvasToolbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>(() => {
    return (window.localStorage.getItem("aidraw-layout-direction") as LayoutDirection) || "horizontal";
  });
  const [gridCols, setGridCols] = useState<number>(() => {
    const saved = Number(window.localStorage.getItem("aidraw-layout-columns"));
    return Number.isFinite(saved) && saved >= 1 ? saved : 3;
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const layoutMenuRef = useRef<HTMLDivElement | null>(null);

  // 点击外部或按 Esc 关闭排版菜单
  useEffect(() => {
    if (!layoutMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLayoutMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [layoutMenuOpen]);

  // 当外部传入的 searchQuery 发生改变时，自动将搜索栏展开
  useEffect(() => {
    if (searchQuery) {
      setIsSearchExpanded(true);
    }
  }, [searchQuery]);

  // 当搜索框展开时，自动聚焦到输入框
  useEffect(() => {
    if (isSearchExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchExpanded]);

  const handleClearOrCollapse = () => {
    if (searchQuery) {
      onSearchQueryChange("");
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } else {
      setIsSearchExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsSearchExpanded(false);
      onSearchQueryChange("");
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // 检查焦点是否移出了搜索框容器（包括输入框和清除按钮）
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (!searchQuery) {
        setIsSearchExpanded(false);
      }
    }
  };

  const matchingJobs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    
    // 如果包含空格，则按空格分割，检查是否所有关键词都模糊匹配上，或者整体模糊匹配上
    const keywords = q.split(/\s+/).filter(Boolean);
    
    return jobs.filter(
      (job) => {
        const checkFuzzy = (query: string) => 
          fuzzyMatch(job.prompt, query) ||
          fuzzyMatch(job.negativePrompt || "", query) ||
          fuzzyMatch(job.status, query) ||
          fuzzyMatch(job.id, query);
          
        return keywords.every(kw => checkFuzzy(kw)) || checkFuzzy(q);
      }
    );
  }, [jobs, searchQuery]);

  return (
    <div className="canvas-toolbar floating-toolbar">
      <div className="tool-group">
        <button type="button" onClick={onZoomOut} title="缩小">
          <ZoomOut size={17} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onZoomIn} title="放大">
          <ZoomIn size={17} />
        </button>
        <button type="button" onClick={onResetCanvas} title="重置画布">
          <Maximize2 size={17} />
        </button>
        <button
          type="button"
          onClick={onJumpToLatestOutput}
          disabled={!hasLatestOutput}
          title={hasLatestOutput ? "跳到最新图片或视频盒子" : "当前文件夹暂无生成结果"}
          aria-label={hasLatestOutput ? "跳到最新图片或视频盒子" : "当前文件夹暂无生成结果"}
        >
          <LocateFixed size={17} />
        </button>
      </div>

      <div
        className={`search-group${isSearchExpanded ? " expanded" : ""}`}
        onClick={() => {
          if (!isSearchExpanded) setIsSearchExpanded(true);
        }}
        onBlur={handleBlur}
        tabIndex={-1} // 允许容器及子代接收 FocusEvent 的 relatedTarget 检测
      >
        <div className="search-icon" title={!isSearchExpanded ? "搜索提示词" : undefined}>
          <Search size={17} />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="搜索提示词喵..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
        {isSearchExpanded && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={(e) => {
              e.stopPropagation(); // 阻止容器点击事件再次触发导致重新 Focus
              handleClearOrCollapse();
            }}
            title={searchQuery ? "清空搜索" : "收起搜索"}
          >
            <X size={11} />
          </button>
        )}

        <div 
          className={`search-dropdown ${isSearchExpanded && searchQuery.trim() ? "open" : ""}`} 
          onMouseDown={(e) => e.preventDefault()}
        >
            {matchingJobs.length === 0 ? (
              <div className="search-dropdown-empty">没有匹配结果喵...</div>
            ) : (
              <ul className="search-dropdown-list">
                {matchingJobs.map((job) => (
                  <li key={job.id} className="search-dropdown-item">
                    <div className="search-dropdown-image">
                      {(() => {
                        const resultUrl = getJobOutputImages(job).at(-1);
                        if (!resultUrl) return <div className="search-dropdown-placeholder" />;
                        return getJobVisualKind(job, resultUrl) === "video" ? (
                          <video src={resultUrl} muted playsInline preload="metadata" aria-label="视频结果" />
                        ) : (
                          <img src={resultUrl} alt="图片结果" />
                        );
                      })()}
                    </div>
                    <div className="search-dropdown-content">
                      <div className="search-dropdown-prompt" title={job.prompt}>
                        {job.prompt}
                      </div>
                      <div className="search-dropdown-time">
                        {new Date(job.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="search-dropdown-copy"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(job.prompt);
                        setCopiedId(job.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      title="复制提示词"
                    >
                      {copiedId === job.id ? <Check size={14} style={{ color: "var(--green)" }} /> : <Copy size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
      </div>

      <div className="tool-group">
        <button type="button" onClick={onSortByTime} title="按生成时间排序">
          <Clock size={17} />
        </button>
        <button type="button" onClick={onSortByName} title="按提示词排序">
          <RefreshCw size={17} />
        </button>
        {onClearFailedJobs && (
          <button
            type="button"
            className={`toolbar-clear-failed-btn ${(failedJobsCount ?? 0) > 0 ? "has-failed" : ""}`}
            onClick={onClearFailedJobs}
            disabled={(failedJobsCount ?? 0) === 0}
            title={(failedJobsCount ?? 0) > 0 ? `一键清理失败盒子 (共 ${failedJobsCount} 个)` : "暂无生成失败的盒子"}
            aria-label={(failedJobsCount ?? 0) > 0 ? `一键清理失败盒子 (共 ${failedJobsCount} 个)` : "暂无生成失败的盒子"}
          >
            <Trash2 size={17} />
            {(failedJobsCount ?? 0) > 0 && (
              <span className="toolbar-badge-count">
                {(failedJobsCount ?? 0) > 99 ? "99+" : failedJobsCount}
              </span>
            )}
          </button>
        )}

        {onApplyLayout && (
          <div className="layout-menu-wrapper" ref={layoutMenuRef}>
            <button
              type="button"
              className={`toolbar-layout-btn ${layoutMenuOpen ? "is-open" : ""}`}
              onClick={() => setLayoutMenuOpen((v) => !v)}
              title="重置排版与布局模板"
              aria-label="重置排版与布局模板"
              aria-expanded={layoutMenuOpen}
            >
              <LayoutGrid size={17} />
            </button>

            {layoutMenuOpen && (
              <div className="layout-popover-menu" role="dialog" aria-label="排版布局设置">
                <div className="layout-popover-header">
                  <strong>画布排版与重置</strong>
                  <small>一键规范所有盒子间距并对齐</small>
                </div>

                <div className="layout-options-grid">
                  <button
                    type="button"
                    className={`layout-option-card ${layoutDirection === "horizontal" ? "active" : ""}`}
                    onClick={() => {
                      setLayoutDirection("horizontal");
                      window.localStorage.setItem("aidraw-layout-direction", "horizontal");
                    }}
                  >
                    <div className="layout-option-icon">
                      <ArrowRight size={17} />
                    </div>
                    <div className="layout-option-info">
                      <span>从左往右</span>
                      <small>单行横向排版（默认）</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`layout-option-card ${layoutDirection === "vertical" ? "active" : ""}`}
                    onClick={() => {
                      setLayoutDirection("vertical");
                      window.localStorage.setItem("aidraw-layout-direction", "vertical");
                    }}
                  >
                    <div className="layout-option-icon">
                      <ArrowDown size={17} />
                    </div>
                    <div className="layout-option-info">
                      <span>从上往下</span>
                      <small>单列纵向排列</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`layout-option-card ${layoutDirection === "grid" ? "active" : ""}`}
                    onClick={() => {
                      setLayoutDirection("grid");
                      window.localStorage.setItem("aidraw-layout-direction", "grid");
                    }}
                  >
                    <div className="layout-option-icon">
                      <LayoutGrid size={17} />
                    </div>
                    <div className="layout-option-info">
                      <span>蛇形网格</span>
                      <small>S形走位折行（每行固定数量）</small>
                    </div>
                  </button>
                </div>

                {layoutDirection === "grid" && (
                  <div className="layout-grid-config">
                    <div className="layout-grid-config-label">
                      <span>每行展示数量</span>
                      <strong>{gridCols} 个 / 行</strong>
                    </div>
                    <div className="layout-grid-chips">
                      {[2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          className={`layout-chip ${gridCols === num ? "active" : ""}`}
                          onClick={() => {
                            setGridCols(num);
                            window.localStorage.setItem("aidraw-layout-columns", String(num));
                          }}
                        >
                          {num}个
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="layout-apply-btn"
                  onClick={() => {
                    setLayoutMenuOpen(false);
                    onApplyLayout(layoutDirection, gridCols);
                  }}
                >
                  一键重置排版
                </button>
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={onToggleTheme} title="切换暗黑模式">
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        {onOpenAnnouncement && (
          <button
            type="button"
            onClick={onOpenAnnouncement}
            title={
              unreadAnnouncementsCount && unreadAnnouncementsCount > 0
                ? `更新日志（${unreadAnnouncementsCount} 条未读）`
                : "更新日志"
            }
            className="relative"
            aria-label="更新日志"
          >
            <Megaphone size={17} />
            {unreadAnnouncementsCount && unreadAnnouncementsCount > 0 ? (
              <span className="announcement-badge-count">
                {unreadAnnouncementsCount > 9 ? "9+" : unreadAnnouncementsCount}
              </span>
            ) : null}
          </button>
        )}
        <button type="button" onClick={onOpenGuide} title="新手指引">
          <CircleHelp size={17} />
        </button>
        <button
          type="button"
          onClick={() => window.open("https://github.com/harrithy/AIDraw", "_blank", "noopener,noreferrer")}
          title="访问 GitHub 仓库"
          aria-label="访问 GitHub 仓库"
        >
          <Github size={17} />
        </button>
        <button type="button" onClick={onOpenApiSettings} title="接口设置" data-tour="api-settings">
          <Settings size={17} />
        </button>
      </div>

      {copiedId && createPortal(
        <div className="copy-toast">
          <Check size={16} style={{ color: "var(--green)" }} />
          <span>已复制提示词喵！</span>
        </div>,
        document.body
      )}
    </div>
  );
}

