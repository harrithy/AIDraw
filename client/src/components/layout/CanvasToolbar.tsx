import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Clock, Copy, Github, Maximize2, Moon, RefreshCw, Search, Settings, Sun, X, ZoomIn, ZoomOut, Check } from "lucide-react";
import type { DrawJob } from "../../types";

type CanvasToolbarProps = {
  zoom: number;
  darkMode: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetCanvas: () => void;
  onSortByTime: () => void;
  onOpenApiSettings: () => void;
  onOpenGuide: () => void;
  onSortByName: () => void;
  onToggleTheme: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
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

export function CanvasToolbar({
  zoom,
  darkMode,
  onZoomOut,
  onZoomIn,
  onResetCanvas,
  onSortByTime,
  onOpenApiSettings,
  onOpenGuide,
  onSortByName,
  onToggleTheme,
  searchQuery,
  onSearchQueryChange,
  jobs
}: CanvasToolbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
                      {job.outputImageUrl || (job.outputImageUrls && job.outputImageUrls.length > 0) ? (
                        <img
                          src={job.outputImageUrl || (job.outputImageUrls && job.outputImageUrls[0]) || ""}
                          alt="result"
                        />
                      ) : (
                        <div className="search-dropdown-placeholder" />
                      )}
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
        <button type="button" onClick={onToggleTheme} title="切换暗黑模式">
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
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

