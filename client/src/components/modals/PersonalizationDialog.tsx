import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  PanelLeft,
  RotateCcw
} from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import {
  CARD_ACTION_IDS,
  type AttachmentMaxVisible,
  type CardActionId,
  type UiLayoutPreset,
  type UiPreferences
} from "../../lib/uiPreferences";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import { Message } from "../ui/message";
import { Switch } from "../ui/switch";

type PersonalizationSection = "presets" | "page" | "card" | "appearance";

type PersonalizationDialogProps = {
  open: boolean;
  preferences: UiPreferences;
  onOpenChange: (open: boolean) => void;
  onChange: (
    updater: UiPreferences | ((current: UiPreferences) => UiPreferences),
    markCustom?: boolean
  ) => void;
  onApplyPreset: (preset: Exclude<UiLayoutPreset, "custom">) => void;
  onResetLayout: () => void;
};

const SECTIONS: Array<{ id: PersonalizationSection; label: string; icon: ReactNode }> = [
  { id: "presets", label: "布局预设", icon: <LayoutGrid size={16} /> },
  { id: "page", label: "页面", icon: <PanelLeft size={16} /> },
  { id: "card", label: "图片盒子", icon: <ImageIcon size={16} /> },
  { id: "appearance", label: "外观", icon: <Palette size={16} /> }
];

const PRESETS: Array<{
  id: Exclude<UiLayoutPreset, "custom">;
  title: string;
  description: string;
}> = [
  { id: "standard", title: "标准", description: "保留当前布局，信息与操作完整显示。" },
  { id: "focus", title: "专注画布", description: "收起辅助区域，让画布成为视觉中心。" },
  { id: "compact", title: "紧凑", description: "减少面板占用，适合较小的桌面窗口。" }
];

const ACTION_LABELS: Record<CardActionId, string> = {
  retry: "重新绘制",
  movePrevious: "向前移动",
  moveNext: "向后移动",
  download: "下载媒体",
  copyLink: "复制媒体链接",
  upload: "上传到图床",
  useAsReference: "作为参考图",
  delete: "删除盒子"
};

function SettingRow({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="personalization-setting-row">
      <div className="personalization-setting-copy">
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
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
  options: Array<{ value: T; label: string }>;
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
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PersonalizationDialog({
  open,
  preferences,
  onOpenChange,
  onChange,
  onApplyPreset,
  onResetLayout
}: PersonalizationDialogProps) {
  const [section, setSection] = useState<PersonalizationSection>("presets");
  const [draggedAction, setDraggedAction] = useState<CardActionId | null>(null);

  const updatePage = (patch: Partial<UiPreferences["page"]>) => {
    onChange((current) => ({
      ...current,
      page: { ...current.page, ...patch }
    }));
  };

  const updateCard = (patch: Partial<UiPreferences["card"]>) => {
    onChange((current) => ({
      ...current,
      card: { ...current.card, ...patch }
    }));
  };

  const updateAppearance = (patch: Partial<UiPreferences["appearance"]>) => {
    onChange((current) => ({
      ...current,
      appearance: { ...current.appearance, ...patch }
    }), false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="personalization-dialog">
        <DialogHeader className="personalization-header">
          <div>
            <p className="eyebrow">PERSONALIZE</p>
            <DialogTitle>个性化设置</DialogTitle>
          </div>
          <DialogDescription>
            调整会立即生效并保存在当前设备，不会改变任务数据或盒子坐标。
          </DialogDescription>
        </DialogHeader>

        <div className="personalization-layout">
          <nav className="personalization-nav" aria-label="个性化设置分区">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={section === item.id ? "active" : ""}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => setSection(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="personalization-reset-button"
              onClick={() => {
                onResetLayout();
                Message.success("已恢复默认布局");
              }}
            >
              <RotateCcw size={15} />
              <span>恢复默认布局</span>
            </button>
          </nav>

          <div className="personalization-content">
            {section === "presets" ? (
              <section aria-labelledby="personalization-presets-title">
                <div className="personalization-section-heading">
                  <h3 id="personalization-presets-title">布局预设</h3>
                  <span>{preferences.preset === "custom" ? "当前：自定义" : "选择后仍可继续细调"}</span>
                </div>
                <div className="personalization-preset-grid">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={preferences.preset === preset.id ? "active" : ""}
                      onClick={() => {
                        onApplyPreset(preset.id);
                        Message.success(`已应用“${preset.title}”布局`);
                      }}
                    >
                      <span className="personalization-preset-preview" data-preset={preset.id} aria-hidden="true">
                        <i />
                        <b />
                        <em />
                      </span>
                      <strong>
                        {preset.title}
                        {preferences.preset === preset.id ? <Check size={15} /> : null}
                      </strong>
                      <small>{preset.description}</small>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {section === "page" ? (
              <section aria-labelledby="personalization-page-title">
                <div className="personalization-section-heading">
                  <h3 id="personalization-page-title">页面布局</h3>
                  <span>桌面宽屏完整应用</span>
                </div>
                <div className="personalization-setting-list">
                  <SettingRow title="左侧文件夹栏" description="记住展开或收起状态">
                    <Switch
                      checked={preferences.page.sidebarOpen}
                      onCheckedChange={(checked) => updatePage({ sidebarOpen: checked })}
                      aria-label="显示左侧文件夹栏"
                    />
                  </SettingRow>
                  <SettingRow title="左栏宽度" description={`${Math.round(preferences.page.sidebarWidth)}px`}>
                    <input
                      type="range"
                      min={240}
                      max={360}
                      step={4}
                      value={preferences.page.sidebarWidth}
                      onChange={(event) => updatePage({ sidebarWidth: Number(event.target.value) })}
                      aria-label="左栏宽度"
                    />
                  </SettingRow>
                  <SettingRow title="任务统计">
                    <Switch
                      checked={preferences.page.showMetrics}
                      onCheckedChange={(checked) => updatePage({ showMetrics: checked })}
                      aria-label="显示任务统计"
                    />
                  </SettingRow>
                  <SettingRow title="素材库">
                    <Switch
                      checked={preferences.page.showAssetLibrary}
                      onCheckedChange={(checked) => updatePage({ showAssetLibrary: checked })}
                      aria-label="显示素材库"
                    />
                  </SettingRow>
                  <SettingRow title="全局工具栏位置">
                    <ChoiceGroup
                      value={preferences.page.toolbarPosition}
                      ariaLabel="全局工具栏位置"
                      options={[
                        { value: "top-left", label: "左上" },
                        { value: "top-center", label: "顶部居中" },
                        { value: "top-right", label: "右上" }
                      ]}
                      onChange={(toolbarPosition) => updatePage({ toolbarPosition })}
                    />
                  </SettingRow>
                  <SettingRow title="创作框位置">
                    <ChoiceGroup
                      value={preferences.page.composerPosition}
                      ariaLabel="创作框位置"
                      options={[
                        { value: "bottom-left", label: "左下" },
                        { value: "bottom-center", label: "底部居中" },
                        { value: "bottom-right", label: "右下" }
                      ]}
                      onChange={(composerPosition) => updatePage({ composerPosition })}
                    />
                  </SettingRow>
                  <SettingRow title="创作框宽度" description={`${Math.round(preferences.page.composerWidth)}px`}>
                    <input
                      type="range"
                      min={560}
                      max={960}
                      step={20}
                      value={preferences.page.composerWidth}
                      onChange={(event) => updatePage({ composerWidth: Number(event.target.value) })}
                      aria-label="创作框宽度"
                    />
                  </SettingRow>
                  <SettingRow title="默认折叠创作框">
                    <Switch
                      checked={preferences.page.composerCollapsed}
                      onCheckedChange={(checked) => updatePage({ composerCollapsed: checked })}
                      aria-label="默认折叠创作框"
                    />
                  </SettingRow>
                </div>
              </section>
            ) : null}

            {section === "card" ? (
              <section aria-labelledby="personalization-card-title">
                <div className="personalization-section-heading">
                  <h3 id="personalization-card-title">图片盒子</h3>
                  <span>应用于所有文件夹</span>
                </div>
                <div className="personalization-setting-list">
                  <SettingRow title="工具栏位置">
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
                  <SettingRow title="工具栏展开方式">
                    <ChoiceGroup
                      value={preferences.card.toolbarBehavior}
                      ariaLabel="图片盒子工具栏展开方式"
                      options={[
                        { value: "click", label: "点击" },
                        { value: "hover", label: "悬停" },
                        { value: "always", label: "始终" }
                      ]}
                      onChange={(toolbarBehavior) => updateCard({ toolbarBehavior })}
                    />
                  </SettingRow>

                  <div className="personalization-action-editor">
                    <div className="personalization-action-editor-heading">
                      <strong>工具按钮</strong>
                      <small>拖动排序，或使用箭头进行键盘调整</small>
                    </div>
                    {preferences.card.actionOrder.map((action, index) => {
                      const visible = !preferences.card.hiddenActions.includes(action);
                      return (
                        <div
                          key={action}
                          className={`personalization-action-row${draggedAction === action ? " dragging" : ""}`}
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
                          <GripVertical size={15} aria-hidden="true" />
                          <span>{ACTION_LABELS[action]}</span>
                          <Switch
                            checked={visible}
                            onCheckedChange={(checked) => toggleAction(action, checked)}
                            aria-label={`${visible ? "隐藏" : "显示"}${ACTION_LABELS[action]}`}
                          />
                          <button
                            type="button"
                            onClick={() => moveAction(action, -1)}
                            disabled={index === 0}
                            aria-label={`上移${ACTION_LABELS[action]}`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAction(action, 1)}
                            disabled={index === preferences.card.actionOrder.length - 1}
                            aria-label={`下移${ACTION_LABELS[action]}`}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <SettingRow title="显示附件图片">
                    <Switch
                      checked={preferences.card.attachmentVisible}
                      onCheckedChange={(checked) => updateCard({ attachmentVisible: checked })}
                      aria-label="显示附件图片"
                    />
                  </SettingRow>
                  <SettingRow title="附件位置">
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
                  <SettingRow title="附件展示方式">
                    <ChoiceGroup
                      value={preferences.card.attachmentMode}
                      ariaLabel="附件图片展示方式"
                      options={[
                        { value: "list", label: "列表" },
                        { value: "stack", label: "堆叠" },
                        { value: "summary", label: "首图 +N" }
                      ]}
                      onChange={(attachmentMode) => updateCard({ attachmentMode })}
                    />
                  </SettingRow>
                  <SettingRow title="缩略图大小">
                    <ChoiceGroup
                      value={String(preferences.card.attachmentThumbnailSize)}
                      ariaLabel="附件缩略图大小"
                      options={[
                        { value: "44", label: "小" },
                        { value: "58", label: "标准" },
                        { value: "72", label: "大" }
                      ]}
                      onChange={(value) => updateCard({ attachmentThumbnailSize: Number(value) as 44 | 58 | 72 })}
                    />
                  </SettingRow>
                  <SettingRow title="最多展示">
                    <select
                      value={String(preferences.card.attachmentMaxVisible)}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateCard({
                          attachmentMaxVisible: (value === "all" ? "all" : Number(value)) as AttachmentMaxVisible
                        });
                      }}
                      aria-label="附件最大展示数量"
                    >
                      <option value="1">1 张</option>
                      <option value="3">3 张</option>
                      <option value="5">5 张</option>
                      <option value="all">全部</option>
                    </select>
                  </SettingRow>
                </div>
              </section>
            ) : null}

            {section === "appearance" ? (
              <section aria-labelledby="personalization-appearance-title">
                <div className="personalization-section-heading">
                  <h3 id="personalization-appearance-title">外观</h3>
                  <span>工具栏快捷按钮保持同步</span>
                </div>
                <div className="personalization-setting-list">
                  <SettingRow title="主题">
                    <ChoiceGroup
                      value={preferences.appearance.theme}
                      ariaLabel="页面主题"
                      options={[
                        { value: "light", label: "浅色" },
                        { value: "dark", label: "深色" }
                      ]}
                      onChange={(theme) => updateAppearance({ theme })}
                    />
                  </SettingRow>
                  <SettingRow title="Mugi 桌宠" description="关闭后不会在画布中巡游">
                    <Switch
                      checked={preferences.appearance.petEnabled}
                      onCheckedChange={(petEnabled) => updateAppearance({ petEnabled })}
                      aria-label="显示 Mugi 桌宠"
                    />
                  </SettingRow>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <div className="personalization-save-status" role="status">
          <Check size={14} />
          所有调整都会自动保存
        </div>
      </DialogContent>
    </Dialog>
  );
}
