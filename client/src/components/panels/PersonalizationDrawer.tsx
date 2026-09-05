import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  CloudUpload,
  Download,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Link,
  Moon,
  Palette,
  PanelLeft,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  CARD_ACTION_IDS,
  type AttachmentMode,
  type AttachmentMaxVisible,
  type CardActionId,
  type UiLayoutPreset,
  type UiPreferences,
  type UiTheme
} from "../../lib/uiPreferences";
import { Button } from "../ui/button";
import { DialogDescription, DialogTitle } from "../ui/dialog";
import { Drawer } from "../ui/drawer";
import { Message } from "../ui/message";
import { Switch } from "../ui/switch";

type PersonalizationSection = "presets" | "page" | "card" | "appearance";

type PersonalizationDrawerProps = {
  open: boolean;
  preferences: UiPreferences;
  onOpenChange: (open: boolean) => void;
  /** 预览修改：只更新画布上的实时效果，不写入本地存储。 */
  onPreview: (
    updater: UiPreferences | ((current: UiPreferences) => UiPreferences),
    markCustom?: boolean
  ) => void;
  onPreviewPreset: (preset: Exclude<UiLayoutPreset, "custom">) => void;
  onPreviewReset: () => void;
  /** 确认应用当前预览结果并保存。 */
  onCommit: () => boolean;
  /** 放弃预览，恢复为上次保存的设置。 */
  onCancel: () => void;
};

const SECTIONS: Array<{
  id: PersonalizationSection;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  { id: "presets", label: "布局预设", description: "一键切换空间节奏", icon: <LayoutGrid size={16} /> },
  { id: "page", label: "页面布局", description: "控制面板与创作框", icon: <PanelLeft size={16} /> },
  { id: "card", label: "图片盒子", description: "管理工具与参考图", icon: <ImageIcon size={16} /> },
  { id: "appearance", label: "外观主题", description: "主题与陪伴体验", icon: <Palette size={16} /> }
];

const PRESET_LABELS: Record<UiLayoutPreset, string> = {
  standard: "标准布局",
  focus: "专注画布",
  compact: "紧凑分屏",
  custom: "自定义布局"
};

const THEME_OPTIONS: Array<{
  id: UiTheme;
  title: string;
  description: string;
}> = [
  { id: "light", title: "明亮浅色", description: "清爽纸面与墨绿强调" },
  { id: "dark", title: "极夜深色", description: "低照度沉浸创作" },
  { id: "anime", title: "樱落漫绘", description: "二次元 · 柔粉与青空" }
];

function ThemeGlyph({ theme, size = 20 }: { theme: UiTheme; size?: number }) {
  if (theme === "dark") return <Moon size={size} />;
  if (theme === "anime") return <Sparkles size={size} />;
  return <Sun size={size} />;
}

const ATTACHMENT_MODES: Array<{
  value: AttachmentMode;
  label: string;
  description: string;
}> = [
  { value: "list", label: "平铺浏览", description: "每张参考图完整露出" },
  { value: "stack", label: "卡叠收纳", description: "多图错层，点击展开" },
  { value: "summary", label: "首图摘要", description: "只看首图与剩余数量" }
];

const PRESETS: Array<{
  id: Exclude<UiLayoutPreset, "custom">;
  title: string;
  badge: string;
  description: string;
}> = [
  {
    id: "standard",
    title: "标准布局",
    badge: "全功能展开",
    description: "展开侧边栏与全部面板，信息完备，操作指引清晰。"
  },
  {
    id: "focus",
    title: "专注画布",
    badge: "纯净沉浸",
    description: "收起侧栏与辅助部件，最大化画布视界，沉浸创作。"
  },
  {
    id: "compact",
    title: "紧凑分屏",
    badge: "空间优化",
    description: "精简面板占比与工具位，为笔记本与小窗口度身定制。"
  }
];

const ACTION_META: Record<CardActionId, { label: string; icon: ReactNode }> = {
  retry: { label: "重新绘制", icon: <RotateCw size={14} /> },
  movePrevious: { label: "向前移动", icon: <ArrowLeft size={14} /> },
  moveNext: { label: "向后移动", icon: <ArrowRight size={14} /> },
  download: { label: "下载媒体", icon: <Download size={14} /> },
  copyLink: { label: "复制链接", icon: <Link size={14} /> },
  upload: { label: "上传图床", icon: <CloudUpload size={14} /> },
  useAsReference: { label: "设为参考", icon: <Sparkles size={14} /> },
  delete: { label: "删除盒子", icon: <Trash2 size={14} /> }
};

function SettingGroup({
  title,
  icon,
  badge,
  children
}: {
  title: string;
  icon?: ReactNode;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="personalization-group-card">
      <div className="personalization-group-header">
        <div className="personalization-group-title">
          {icon ? <span className="personalization-group-icon">{icon}</span> : null}
          <h4>{title}</h4>
        </div>
        {badge ? <span className="personalization-group-badge">{badge}</span> : null}
      </div>
      <div className="personalization-group-body">{children}</div>
    </div>
  );
}

function SettingRow({
  title,
  description,
  fullWidth = false,
  children
}: {
  title: string;
  description?: string;
  fullWidth?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`personalization-setting-row${fullWidth ? " full-width" : ""}`}>
      <div className="personalization-setting-copy">
        <span className="personalization-setting-title">{title}</span>
        {description ? <small className="personalization-setting-desc">{description}</small> : null}
      </div>
      <div className="personalization-setting-control">{children}</div>
    </div>
  );
}

function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="personalization-choice-group" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "active" : ""}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <span className="choice-icon">{option.icon}</span> : null}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function AttachmentModePicker({
  value,
  onChange
}: {
  value: AttachmentMode;
  onChange: (value: AttachmentMode) => void;
}) {
  return (
    <div className="personalization-attachment-modes" role="radiogroup" aria-label="附件图片展示方式">
      {ATTACHMENT_MODES.map((mode) => {
        const active = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            className={`personalization-attachment-mode${active ? " active" : ""}`}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode.value)}
          >
            <span className="attachment-mode-visual" data-mode={mode.value} aria-hidden="true">
              <span className="attachment-preview-card first" />
              <span className="attachment-preview-card second" />
              <span className="attachment-preview-card third" />
              <span className="attachment-preview-count">+2</span>
            </span>
            <span className="attachment-mode-copy">
              <strong>{mode.label}</strong>
              <small>{mode.description}</small>
            </span>
            <span className="attachment-mode-check" aria-hidden="true">
              <Check size={12} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RangeSlider({
  value,
  min,
  max,
  step = 1,
  unit = "px",
  onChange,
  ariaLabel
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  ariaLabel: string;
}) {
  const percentage = Math.round(((value - min) / (max - min)) * 100);

  return (
    <div className="personalization-slider-wrapper">
      <div className="personalization-slider-bar">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={ariaLabel}
          style={{ "--slider-fill": `${percentage}%` } as React.CSSProperties}
        />
      </div>
      <span className="personalization-slider-badge">
        {Math.round(value)} {unit}
      </span>
    </div>
  );
}

export function PersonalizationDrawer({
  open,
  preferences,
  onOpenChange,
  onPreview,
  onPreviewPreset,
  onPreviewReset,
  onCommit,
  onCancel
}: PersonalizationDrawerProps) {
  const [section, setSection] = useState<PersonalizationSection>("presets");
  const [draggedAction, setDraggedAction] = useState<CardActionId | null>(null);
  const [dirty, setDirty] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const currentSectionIndex = SECTIONS.findIndex((item) => item.id === section);
  const currentSection = SECTIONS[currentSectionIndex] ?? SECTIONS[0];
  const visibleActionCount = CARD_ACTION_IDS.length - preferences.card.hiddenActions.length;
  const currentTheme = THEME_OPTIONS.find((theme) => theme.id === preferences.appearance.theme) ?? THEME_OPTIONS[0];

  useGSAP(
    () => {
      if (!open || !shellRef.current) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .fromTo(
            ".personalization-header-copy > *",
            { autoAlpha: 0, x: 18 },
            { autoAlpha: 1, x: 0, duration: 0.42, stagger: 0.055, clearProps: "transform,opacity,visibility" }
          )
          .fromTo(
            ".personalization-nav-tab",
            { autoAlpha: 0, x: 12 },
            { autoAlpha: 1, x: 0, duration: 0.32, stagger: 0.045, clearProps: "transform,opacity,visibility" },
            "<0.08"
          )
          .fromTo(
            ".personalization-footer",
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: 0.3, clearProps: "transform,opacity,visibility" },
            "<0.12"
          );
      });
      return () => media.revert();
    },
    { dependencies: [open], scope: shellRef, revertOnUpdate: true }
  );

  useGSAP(
    () => {
      if (!contentRef.current) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const items = contentRef.current?.querySelectorAll(
          ".personalization-preset-card, .personalization-group-card, .personalization-custom-tip"
        );
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        timeline.fromTo(
          ".personalization-section-context",
          { autoAlpha: 0, x: 18 },
          { autoAlpha: 1, x: 0, duration: 0.28, clearProps: "transform,opacity,visibility" }
        );
        if (items?.length) {
          timeline.fromTo(
            items,
            { autoAlpha: 0, y: 16, scale: 0.985 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.38,
              stagger: 0.045,
              clearProps: "transform,opacity,visibility"
            },
            "<0.04"
          );
        }
      });
      return () => media.revert();
    },
    { dependencies: [section], scope: contentRef, revertOnUpdate: true }
  );

  useEffect(() => {
    if (open) {
      setDirty(false);
      setDraggedAction(null);
      setCollapsed(false);
    }
  }, [open]);

  const updatePage = (patch: Partial<UiPreferences["page"]>) => {
    onPreview((current) => ({
      ...current,
      page: { ...current.page, ...patch }
    }));
    setDirty(true);
  };

  const updateCard = (patch: Partial<UiPreferences["card"]>) => {
    onPreview((current) => ({
      ...current,
      card: { ...current.card, ...patch }
    }));
    setDirty(true);
  };

  const updateAppearance = (patch: Partial<UiPreferences["appearance"]>) => {
    onPreview(
      (current) => ({
        ...current,
        appearance: { ...current.appearance, ...patch }
      }),
      false
    );
    setDirty(true);
  };

  const moveAction = (action: CardActionId, direction: -1 | 1) => {
    const order = [...preferences.card.actionOrder];
    const index = order.indexOf(action);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    updateCard({ actionOrder: order });
  };

  const dropAction = (event: DragEvent<HTMLDivElement>, targetAction: CardActionId) => {
    event.preventDefault();
    if (!draggedAction || draggedAction === targetAction) return;
    const order = preferences.card.actionOrder.filter((action) => action !== draggedAction);
    const targetIndex = order.indexOf(targetAction);
    if (targetIndex < 0) return;
    order.splice(targetIndex, 0, draggedAction);
    updateCard({ actionOrder: order });
    setDraggedAction(null);
  };

  const toggleAction = (action: CardActionId, visible: boolean) => {
    const hidden = new Set(preferences.card.hiddenActions);
    if (visible) hidden.delete(action);
    else hidden.add(action);
    updateCard({ hiddenActions: CARD_ACTION_IDS.filter((item) => hidden.has(item)) });
  };

  const changeSection = (nextSection: PersonalizationSection) => {
    if (nextSection === section) return;
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setSection(nextSection);
  };

  const handleCommit = () => {
    if (!onCommit()) return;
    setDirty(false);
    Message.success("已应用个性化设置");
  };

  const handleCancel = () => {
    const hasChanges = dirty;
    onCancel();
    setDirty(false);
    if (hasChanges) Message.info("已放弃更改，恢复原设置");
  };

  const handleReset = () => {
    onPreviewReset();
    setDirty(true);
    Message.info("已恢复默认布局预设（预览中）");
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      className={`personalization-drawer${collapsed ? " collapsed" : ""}`}
    >
      {/* 抽屉左侧垂直居中外侧的悬浮收起/展开把手（仿 dock-toggle 风格） */}
      <button
        type="button"
        className={`personalization-dock-toggle${collapsed ? " collapsed" : ""}`}
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "展开个性化设置" : "收起个性化设置"}
        aria-label={collapsed ? "展开个性化设置" : "收起个性化设置"}
      >
        <span className="personalization-dock-toggle-icon">
          <ChevronRight size={18} />
        </span>
      </button>

      <div ref={shellRef} className="personalization-shell">
        {/* 抽屉头部 */}
        <header className="personalization-header">
          <div className="personalization-header-copy">
            <div className="personalization-eyebrow-row">
              <span className="personalization-icon-pill">
                <SlidersHorizontal size={14} />
              </span>
              <span className="personalization-kicker">SPACE STUDIO</span>
              <span className="personalization-preview-badge">
                <span className="personalization-preview-pulse" />
                实时预览
              </span>
            </div>
            <div className="personalization-title-row">
              <DialogTitle>把创作空间调成顺手的样子</DialogTitle>
            </div>
            <DialogDescription>
              每一次选择都会立即映射到画布；满意后应用，不满意就安全退回。
            </DialogDescription>
            <div className="personalization-header-facts" aria-label="当前个性化设置摘要">
              <span><LayoutGrid size={13} />{PRESET_LABELS[preferences.preset]}</span>
              <span><Sparkles size={13} />{visibleActionCount} 个卡片动作</span>
              <span><ThemeGlyph theme={currentTheme.id} size={13} />{currentTheme.title}</span>
            </div>
          </div>

          <div className="personalization-header-actions">
            <button
              type="button"
              className="personalization-action-btn"
              onClick={handleReset}
              title="恢复默认布局"
              aria-label="恢复默认布局"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="personalization-action-btn close"
              onClick={() => onOpenChange(false)}
              title="关闭抽屉并取消"
              aria-label="关闭个性化设置"
            >
              <X size={17} />
            </button>
          </div>
        </header>

        <div className="personalization-workbench">
          {/* 工作台分区导航 */}
          <nav className="personalization-nav" aria-label="个性化设置分区">
            <div className="personalization-nav-heading">
              <span>CONTROL MAP</span>
              <strong>调节分区</strong>
            </div>
            <div className="personalization-nav-track">
              {SECTIONS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`personalization-nav-tab${section === item.id ? " active" : ""}`}
                  aria-current={section === item.id ? "page" : undefined}
                  onClick={() => changeSection(item.id)}
                >
                  <span className="personalization-nav-index">0{index + 1}</span>
                  <span className="personalization-nav-icon">{item.icon}</span>
                  <span className="personalization-nav-copy">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ChevronRight className="personalization-nav-arrow" size={15} />
                </button>
              ))}
            </div>
            <div className="personalization-nav-note">
              <span className={`status-indicator-dot${dirty ? " dirty" : ""}`} />
              <span>{dirty ? "预览正在等待应用" : "当前设置已同步"}</span>
            </div>
          </nav>

          {/* 滚动内容区 */}
          <div ref={contentRef} className="personalization-content">
            <div className="personalization-section-context">
              <span className="personalization-section-number">0{currentSectionIndex + 1}</span>
              <span className="personalization-section-divider" />
              <div>
                <strong>{currentSection.label}</strong>
                <small>{currentSection.description}</small>
              </div>
            </div>
        {/* TAB 1: 布局预设 */}
        {section === "presets" ? (
          <section className="personalization-section" aria-labelledby="personalization-presets-title">
            <div className="personalization-section-intro">
              <h3 id="personalization-presets-title">快速布局方案</h3>
              <p>
                一键切换适合不同创作场景的窗口与面板排布，选择后依然可以自由微调各项细节。
              </p>
            </div>

            <div className="personalization-preset-grid">
              {PRESETS.map((preset) => {
                const isActive = preferences.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`personalization-preset-card${isActive ? " active" : ""}`}
                    onClick={() => {
                      onPreviewPreset(preset.id);
                      setDirty(true);
                    }}
                  >
                    {/* 高保真微缩示意图 */}
                    <div className="personalization-preset-mockup" data-preset={preset.id} aria-hidden="true">
                      <div className="mockup-header" />
                      <div className="mockup-body">
                        <div className="mockup-sidebar" />
                        <div className="mockup-canvas">
                          <div className="mockup-card-slot slot-1" />
                          <div className="mockup-card-slot slot-2" />
                          <div className="mockup-composer" />
                        </div>
                      </div>
                    </div>

                    <div className="personalization-preset-info">
                      <div className="personalization-preset-header">
                        <strong className="personalization-preset-title">{preset.title}</strong>
                        <span className="personalization-preset-tag">{preset.badge}</span>
                      </div>
                      <p className="personalization-preset-desc">{preset.description}</p>
                    </div>

                    {isActive ? (
                      <div className="personalization-preset-active-indicator" title="当前使用">
                        <Check size={13} />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {preferences.preset === "custom" ? (
              <div className="personalization-custom-tip">
                <span className="tip-dot" />
                <span>当前已在预设基础上进行了自定义微调</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* TAB 2: 页面布局 */}
        {section === "page" ? (
          <section className="personalization-section" aria-labelledby="personalization-page-title">
            <div className="personalization-section-intro">
              <h3 id="personalization-page-title">全局界面排布</h3>
              <p>定制画布周围各个工具栏、侧边面板及底部创作框的停靠与展开偏好。</p>
            </div>

            {/* 侧边栏卡片 */}
            <SettingGroup title="侧边栏设置" icon={<PanelLeft size={16} />}>
              <SettingRow title="展开侧边文件夹栏" description="记住文件夹栏在屏幕上的默认展开状态">
                <Switch
                  checked={preferences.page.sidebarOpen}
                  onCheckedChange={(checked) => updatePage({ sidebarOpen: checked })}
                  aria-label="显示左侧文件夹栏"
                />
              </SettingRow>
              <SettingRow title="侧栏默认宽度" description="拖动调整侧边栏的桌面展开宽度">
                <RangeSlider
                  min={240}
                  max={360}
                  step={4}
                  value={preferences.page.sidebarWidth}
                  onChange={(sidebarWidth) => updatePage({ sidebarWidth })}
                  ariaLabel="侧栏宽度"
                />
              </SettingRow>
            </SettingGroup>

            {/* 辅助面板显隐卡片 */}
            <SettingGroup title="辅助功能面板" icon={<LayoutGrid size={16} />}>
              <SettingRow title="任务统计仪表盘" description="在顶部或侧边展示当前队列与历史生图统计">
                <Switch
                  checked={preferences.page.showMetrics}
                  onCheckedChange={(checked) => updatePage({ showMetrics: checked })}
                  aria-label="显示任务统计"
                />
              </SettingRow>
              <SettingRow title="素材库面板" description="开启后可快速浏览并复用已收集的参考图像">
                <Switch
                  checked={preferences.page.showAssetLibrary}
                  onCheckedChange={(checked) => updatePage({ showAssetLibrary: checked })}
                  aria-label="显示素材库"
                />
              </SettingRow>
              <SettingRow title="默认折叠底部创作框" description="启动后最小化提示词输入框以腾出更大画布">
                <Switch
                  checked={preferences.page.composerCollapsed}
                  onCheckedChange={(checked) => updatePage({ composerCollapsed: checked })}
                  aria-label="默认折叠创作框"
                />
              </SettingRow>
            </SettingGroup>

            {/* 停靠定位卡片 */}
            <SettingGroup title="停靠位置与尺寸" icon={<SlidersHorizontal size={16} />}>
              <SettingRow title="全局工具栏停靠" description="主操作栏在画布视口中的停靠对齐">
                <ChoiceGroup
                  value={preferences.page.toolbarPosition}
                  ariaLabel="全局工具栏位置"
                  options={[
                    { value: "top-left", label: "左上" },
                    { value: "top-center", label: "居中" },
                    { value: "top-right", label: "右上" }
                  ]}
                  onChange={(toolbarPosition) => updatePage({ toolbarPosition })}
                />
              </SettingRow>
              <SettingRow title="创作框停靠" description="底部生图提示词输入条的停靠对齐">
                <ChoiceGroup
                  value={preferences.page.composerPosition}
                  ariaLabel="创作框位置"
                  options={[
                    { value: "bottom-left", label: "左下" },
                    { value: "bottom-center", label: "居中" },
                    { value: "bottom-right", label: "右下" }
                  ]}
                  onChange={(composerPosition) => updatePage({ composerPosition })}
                />
              </SettingRow>
              <SettingRow title="创作框宽度" description="居中或停靠时的最大限制宽度">
                <RangeSlider
                  min={560}
                  max={960}
                  step={20}
                  value={preferences.page.composerWidth}
                  onChange={(composerWidth) => updatePage({ composerWidth })}
                  ariaLabel="创作框宽度"
                />
              </SettingRow>
            </SettingGroup>
          </section>
        ) : null}

        {/* TAB 3: 图片盒子 */}
        {section === "card" ? (
          <section className="personalization-section" aria-labelledby="personalization-card-title">
            <div className="personalization-section-intro">
              <h3 id="personalization-card-title">卡片与操作盒子</h3>
              <p>定制画布上每个任务卡片的快捷悬浮条、附件形态与按钮顺序。</p>
            </div>

            {/* 工具栏交互 */}
            <SettingGroup title="卡片快捷工具栏" icon={<SlidersHorizontal size={16} />}>
              <SettingRow title="工具栏停靠侧">
                <ChoiceGroup
                  value={preferences.card.toolbarSide}
                  ariaLabel="图片盒子工具栏位置"
                  options={[
                    { value: "left", label: "左侧" },
                    { value: "right", label: "右侧" }
                  ]}
                  onChange={(toolbarSide) => updateCard({ toolbarSide })}
                />
              </SettingRow>
              <SettingRow title="展开与触发机制" description="控制卡片工具栏的展开交互形式">
                <ChoiceGroup
                  value={preferences.card.toolbarBehavior}
                  ariaLabel="图片盒子工具栏展开方式"
                  options={[
                    { value: "click", label: "点击展开" },
                    { value: "hover", label: "悬停出现" },
                    { value: "always", label: "始终保持" }
                  ]}
                  onChange={(toolbarBehavior) => updateCard({ toolbarBehavior })}
                />
              </SettingRow>
            </SettingGroup>

            {/* 动作按钮排序与显隐 */}
            <SettingGroup
              title="卡片动作按钮"
              icon={<Sparkles size={16} />}
              badge="拖动或按箭头排序"
            >
              <div className="personalization-action-editor">
                <div className="personalization-action-list">
                  {preferences.card.actionOrder.map((action, index) => {
                    const meta = ACTION_META[action];
                    const visible = !preferences.card.hiddenActions.includes(action);
                    return (
                      <div
                        key={action}
                        className={`personalization-action-item${
                          draggedAction === action ? " dragging" : ""
                        }${!visible ? " is-hidden" : ""}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", action);
                          setDraggedAction(action);
                        }}
                        onDragEnd={() => setDraggedAction(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => dropAction(event, action)}
                      >
                        <span className="drag-handle" title="按住拖动排序">
                          <GripVertical size={14} />
                        </span>

                        <div className="action-identity">
                          <span className="action-position">{String(index + 1).padStart(2, "0")}</span>
                          <span className="action-icon">{meta.icon}</span>
                          <span className="action-label">{meta.label}</span>
                          {!visible ? <span className="action-hidden-badge">已隐藏</span> : null}
                        </div>

                        <div className="action-controls">
                          <Switch
                            checked={visible}
                            onCheckedChange={(checked) => toggleAction(action, checked)}
                            aria-label={`${visible ? "隐藏" : "显示"}${meta.label}`}
                          />
                          <div className="action-order-arrows">
                            <button
                              type="button"
                              onClick={() => moveAction(action, -1)}
                              disabled={index === 0}
                              title="上移"
                              aria-label={`上移${meta.label}`}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveAction(action, 1)}
                              disabled={index === preferences.card.actionOrder.length - 1}
                              title="下移"
                              aria-label={`下移${meta.label}`}
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SettingGroup>

            {/* 参考附件设置 */}
            <SettingGroup title="参考图与附件展示" icon={<ImageIcon size={16} />}>
              <SettingRow title="显示参考图附件" description="在结果卡片旁附属展示提交的原图">
                <Switch
                  checked={preferences.card.attachmentVisible}
                  onCheckedChange={(checked) => updateCard({ attachmentVisible: checked })}
                  aria-label="显示附件图片"
                />
              </SettingRow>
              <SettingRow title="附件停靠方位">
                <ChoiceGroup
                  value={preferences.card.attachmentSide}
                  ariaLabel="附件图片位置"
                  options={[
                    { value: "left", label: "左侧" },
                    { value: "right", label: "右侧" },
                    { value: "bottom", label: "底部" }
                  ]}
                  onChange={(attachmentSide) => updateCard({ attachmentSide })}
                />
              </SettingRow>
              <SettingRow
                title="排列展示方式"
                description="直接看预览选择，不再靠抽象名称猜效果"
                fullWidth
              >
                <AttachmentModePicker
                  value={preferences.card.attachmentMode}
                  onChange={(attachmentMode) => updateCard({ attachmentMode })}
                />
              </SettingRow>
              <SettingRow title="缩略图尺寸">
                <ChoiceGroup
                  value={String(preferences.card.attachmentThumbnailSize)}
                  ariaLabel="附件缩略图大小"
                  options={[
                    { value: "44", label: "44px 小" },
                    { value: "58", label: "58px 标准" },
                    { value: "72", label: "72px 大" }
                  ]}
                  onChange={(value) =>
                    updateCard({
                      attachmentThumbnailSize: Number(value) as 44 | 58 | 72
                    })
                  }
                />
              </SettingRow>
              <SettingRow title="最多可见数量" description="超出部分可通过悬停或点击卡片展开">
                <ChoiceGroup
                  value={String(preferences.card.attachmentMaxVisible)}
                  ariaLabel="附件最大展示数量"
                  options={[
                    { value: "1", label: "1 张" },
                    { value: "3", label: "3 张" },
                    { value: "5", label: "5 张" },
                    { value: "all", label: "全部" }
                  ]}
                  onChange={(value) =>
                    updateCard({
                      attachmentMaxVisible: (value === "all" ? "all" : Number(value)) as AttachmentMaxVisible
                    })
                  }
                />
              </SettingRow>
            </SettingGroup>
          </section>
        ) : null}

        {/* TAB 4: 外观与桌宠 */}
        {section === "appearance" ? (
          <section className="personalization-section" aria-labelledby="personalization-appearance-title">
            <div className="personalization-section-intro">
              <h3 id="personalization-appearance-title">外观风格与彩蛋</h3>
              <p>选择界面的色彩底色模式，或开启可爱的桌宠伴侣。</p>
            </div>

            {/* 主题选择卡片 */}
            <SettingGroup title="界面主题配色" icon={<Palette size={16} />}>
              <div className="personalization-theme-cards" role="radiogroup" aria-label="界面主题">
                {THEME_OPTIONS.map((theme, themeIndex) => {
                  const active = preferences.appearance.theme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      className={`personalization-theme-card theme-${theme.id}${active ? " active" : ""}`}
                      role="radio"
                      aria-checked={active}
                      tabIndex={active ? 0 : -1}
                      onClick={() => updateAppearance({ theme: theme.id })}
                      onKeyDown={(event) => {
                        let nextIndex = themeIndex;
                        if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex += 1;
                        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex -= 1;
                        else if (event.key === "Home") nextIndex = 0;
                        else if (event.key === "End") nextIndex = THEME_OPTIONS.length - 1;
                        else return;
                        event.preventDefault();
                        nextIndex = (nextIndex + THEME_OPTIONS.length) % THEME_OPTIONS.length;
                        updateAppearance({ theme: THEME_OPTIONS[nextIndex].id });
                        event.currentTarget.parentElement
                          ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
                      }}
                    >
                      <div className="theme-card-preview">
                        <span className="theme-card-icon" aria-hidden="true">
                          <ThemeGlyph theme={theme.id} />
                        </span>
                        <div className={`theme-card-mockup theme-${theme.id}`} aria-hidden="true">
                          <span className="mock-bar" />
                          <span className="mock-box" />
                          {theme.id === "anime" ? (
                            <span className="mock-sparkles">
                              <i />
                              <i />
                              <i />
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="theme-card-footer">
                        <span className="theme-card-footer-copy">
                          <strong>{theme.title}</strong>
                          <small>{theme.description}</small>
                        </span>
                        {active ? (
                          <span className="theme-check" aria-hidden="true">
                            <Check size={12} />
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </SettingGroup>

            {/* 桌宠伴侣 */}
            <SettingGroup title="陪伴互动" icon={<Sparkles size={16} />}>
              <SettingRow
                title="Mugi 桌宠巡游"
                description="开启后 Mugi 会在画布空白处打盹、奔跑或好奇观察你的提示词"
              >
                <Switch
                  checked={preferences.appearance.petEnabled}
                  onCheckedChange={(petEnabled) => updateAppearance({ petEnabled })}
                  aria-label="显示 Mugi 桌宠"
                />
              </SettingRow>
            </SettingGroup>
          </section>
        ) : null}
          </div>
        </div>

        {/* 抽屉底部操作栏 */}
        <footer className="personalization-footer">
          <div className="personalization-footer-status" role="status" aria-live="polite">
            <span className={`status-indicator-dot${dirty ? " dirty" : ""}`} />
            <span className="status-text">
              {dirty ? "有未保存的调整 · 预览中" : "所有调整已实时反映在画布上"}
            </span>
          </div>
          <div className="personalization-footer-actions">
            <Button variant="outline" onClick={handleCancel}>
              放弃更改
            </Button>
            <Button onClick={handleCommit} disabled={!dirty} className="personalization-commit-btn">
              <Check size={14} />
              <span>应用设置</span>
            </Button>
          </div>
        </footer>
      </div>
    </Drawer>
  );
}
