import { CircleHelp, Clock, Maximize2, Moon, RefreshCw, Settings, Sun, ZoomIn, ZoomOut } from "lucide-react";

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
  onToggleTheme
}: CanvasToolbarProps) {
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
        <button type="button" onClick={onOpenApiSettings} title="接口设置">
          <Settings size={17} />
        </button>
      </div>
    </div>
  );
}
