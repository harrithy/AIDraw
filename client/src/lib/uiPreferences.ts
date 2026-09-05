export const UI_PREFERENCES_STORAGE_KEY = "aidraw-ui-preferences-v1";
export const LEGACY_THEME_STORAGE_KEY = "aidraw-theme";
export const LEGACY_PET_STORAGE_KEY = "aidraw-pet-enabled";

export const CARD_ACTION_IDS = [
  "retry",
  "movePrevious",
  "moveNext",
  "download",
  "copyLink",
  "upload",
  "useAsReference",
  "delete"
] as const;

export type CardActionId = (typeof CARD_ACTION_IDS)[number];
export type UiLayoutPreset = "standard" | "focus" | "compact" | "custom";
export type ToolbarPosition = "top-left" | "top-center" | "top-right";
export type ComposerPosition = "bottom-left" | "bottom-center" | "bottom-right";
export type CardToolbarSide = "left" | "right";
export type CardToolbarBehavior = "click" | "hover" | "always";
export type AttachmentSide = "left" | "right" | "bottom";
export type AttachmentMode = "list" | "stack" | "summary";
export type AttachmentThumbnailSize = 44 | 58 | 72;
export type AttachmentMaxVisible = 1 | 3 | 5 | "all";
export type UiTheme = "light" | "dark" | "anime";

export type AppearancePreferences = {
  theme: UiTheme;
  petEnabled: boolean;
};

export type PageLayoutPreferences = {
  sidebarOpen: boolean;
  sidebarWidth: number;
  showMetrics: boolean;
  showAssetLibrary: boolean;
  toolbarPosition: ToolbarPosition;
  composerPosition: ComposerPosition;
  composerWidth: number;
  composerCollapsed: boolean;
};

export type CardLayoutPreferences = {
  toolbarSide: CardToolbarSide;
  toolbarBehavior: CardToolbarBehavior;
  actionOrder: CardActionId[];
  hiddenActions: CardActionId[];
  attachmentVisible: boolean;
  attachmentSide: AttachmentSide;
  attachmentMode: AttachmentMode;
  attachmentThumbnailSize: AttachmentThumbnailSize;
  attachmentMaxVisible: AttachmentMaxVisible;
};

export type UiPreferences = {
  version: 1;
  preset: UiLayoutPreset;
  appearance: AppearancePreferences;
  page: PageLayoutPreferences;
  card: CardLayoutPreferences;
};

const STANDARD_PAGE: PageLayoutPreferences = {
  sidebarOpen: true,
  sidebarWidth: 292,
  showMetrics: true,
  showAssetLibrary: true,
  toolbarPosition: "top-left",
  composerPosition: "bottom-center",
  composerWidth: 760,
  composerCollapsed: false
};

const STANDARD_CARD: CardLayoutPreferences = {
  toolbarSide: "right",
  toolbarBehavior: "click",
  actionOrder: [...CARD_ACTION_IDS],
  hiddenActions: [],
  attachmentVisible: true,
  attachmentSide: "right",
  attachmentMode: "list",
  attachmentThumbnailSize: 58,
  attachmentMaxVisible: "all"
};

const PRESET_LAYOUTS: Record<Exclude<UiLayoutPreset, "custom">, {
  page: PageLayoutPreferences;
  card: Omit<CardLayoutPreferences, "actionOrder" | "hiddenActions">;
}> = {
  standard: {
    page: STANDARD_PAGE,
    card: {
      toolbarSide: "right",
      toolbarBehavior: "click",
      attachmentVisible: true,
      attachmentSide: "right",
      attachmentMode: "list",
      attachmentThumbnailSize: 58,
      attachmentMaxVisible: "all"
    }
  },
  focus: {
    page: {
      sidebarOpen: false,
      sidebarWidth: 292,
      showMetrics: false,
      showAssetLibrary: false,
      toolbarPosition: "top-center",
      composerPosition: "bottom-center",
      composerWidth: 640,
      composerCollapsed: true
    },
    card: {
      toolbarSide: "right",
      toolbarBehavior: "hover",
      attachmentVisible: true,
      attachmentSide: "right",
      attachmentMode: "summary",
      attachmentThumbnailSize: 44,
      attachmentMaxVisible: 1
    }
  },
  compact: {
    page: {
      sidebarOpen: true,
      sidebarWidth: 240,
      showMetrics: true,
      showAssetLibrary: false,
      toolbarPosition: "top-right",
      composerPosition: "bottom-right",
      composerWidth: 560,
      composerCollapsed: true
    },
    card: {
      toolbarSide: "right",
      toolbarBehavior: "click",
      attachmentVisible: true,
      attachmentSide: "bottom",
      attachmentMode: "stack",
      attachmentThumbnailSize: 44,
      attachmentMaxVisible: 3
    }
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isOneOf = <T extends string | number>(value: unknown, options: readonly T[]): value is T =>
  options.includes(value as T);

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
};

const readBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export const normalizeCardActionOrder = (value: unknown): CardActionId[] => {
  const knownActions = new Set<CardActionId>(CARD_ACTION_IDS);
  const normalized: CardActionId[] = [];

  if (Array.isArray(value)) {
    for (const action of value) {
      if (knownActions.has(action as CardActionId) && !normalized.includes(action as CardActionId)) {
        normalized.push(action as CardActionId);
      }
    }
  }

  for (const action of CARD_ACTION_IDS) {
    if (!normalized.includes(action)) normalized.push(action);
  }
  return normalized;
};

const normalizeHiddenActions = (value: unknown): CardActionId[] => {
  if (!Array.isArray(value)) return [];
  return CARD_ACTION_IDS.filter((action) => value.includes(action));
};

export const createDefaultUiPreferences = (
  storage?: Pick<Storage, "getItem">,
  isWideViewport = true
): UiPreferences => {
  const savedTheme = storage?.getItem(LEGACY_THEME_STORAGE_KEY);
  const savedPet = storage?.getItem(LEGACY_PET_STORAGE_KEY);

  return {
    version: 1,
    preset: "standard",
    appearance: {
      theme: isOneOf(savedTheme, ["light", "dark", "anime"] as const) ? savedTheme : "dark",
      petEnabled: savedPet !== "off"
    },
    page: {
      ...STANDARD_PAGE,
      sidebarOpen: isWideViewport
    },
    card: {
      ...STANDARD_CARD,
      actionOrder: [...STANDARD_CARD.actionOrder],
      hiddenActions: []
    }
  };
};

export const normalizeUiPreferences = (
  value: unknown,
  fallback: UiPreferences = createDefaultUiPreferences()
): UiPreferences => {
  if (!isRecord(value) || value.version !== 1) return fallback;
  const appearance = isRecord(value.appearance) ? value.appearance : {};
  const page = isRecord(value.page) ? value.page : {};
  const card = isRecord(value.card) ? value.card : {};

  return {
    version: 1,
    preset: isOneOf(value.preset, ["standard", "focus", "compact", "custom"] as const)
      ? value.preset
      : fallback.preset,
    appearance: {
      theme: isOneOf(appearance.theme, ["light", "dark", "anime"] as const)
        ? appearance.theme
        : fallback.appearance.theme,
      petEnabled: readBoolean(appearance.petEnabled, fallback.appearance.petEnabled)
    },
    page: {
      sidebarOpen: readBoolean(page.sidebarOpen, fallback.page.sidebarOpen),
      sidebarWidth: clamp(page.sidebarWidth, 240, 360, fallback.page.sidebarWidth),
      showMetrics: readBoolean(page.showMetrics, fallback.page.showMetrics),
      showAssetLibrary: readBoolean(page.showAssetLibrary, fallback.page.showAssetLibrary),
      toolbarPosition: isOneOf(page.toolbarPosition, ["top-left", "top-center", "top-right"] as const)
        ? page.toolbarPosition
        : fallback.page.toolbarPosition,
      composerPosition: isOneOf(page.composerPosition, ["bottom-left", "bottom-center", "bottom-right"] as const)
        ? page.composerPosition
        : fallback.page.composerPosition,
      composerWidth: clamp(page.composerWidth, 560, 960, fallback.page.composerWidth),
      composerCollapsed: readBoolean(page.composerCollapsed, fallback.page.composerCollapsed)
    },
    card: {
      toolbarSide: isOneOf(card.toolbarSide, ["left", "right"] as const)
        ? card.toolbarSide
        : fallback.card.toolbarSide,
      toolbarBehavior: isOneOf(card.toolbarBehavior, ["click", "hover", "always"] as const)
        ? card.toolbarBehavior
        : fallback.card.toolbarBehavior,
      actionOrder: normalizeCardActionOrder(card.actionOrder ?? fallback.card.actionOrder),
      hiddenActions: Array.isArray(card.hiddenActions)
        ? normalizeHiddenActions(card.hiddenActions)
        : [...fallback.card.hiddenActions],
      attachmentVisible: readBoolean(card.attachmentVisible, fallback.card.attachmentVisible),
      attachmentSide: isOneOf(card.attachmentSide, ["left", "right", "bottom"] as const)
        ? card.attachmentSide
        : fallback.card.attachmentSide,
      attachmentMode: isOneOf(card.attachmentMode, ["list", "stack", "summary"] as const)
        ? card.attachmentMode
        : fallback.card.attachmentMode,
      attachmentThumbnailSize: isOneOf(card.attachmentThumbnailSize, [44, 58, 72] as const)
        ? card.attachmentThumbnailSize
        : fallback.card.attachmentThumbnailSize,
      attachmentMaxVisible: isOneOf(card.attachmentMaxVisible, [1, 3, 5, "all"] as const)
        ? card.attachmentMaxVisible
        : fallback.card.attachmentMaxVisible
    }
  };
};

export const loadUiPreferences = (
  storage: Pick<Storage, "getItem"> = window.localStorage,
  isWideViewport = window.matchMedia?.("(min-width: 721px)").matches ?? true
): UiPreferences => {
  const fallback = createDefaultUiPreferences(storage, isWideViewport);
  const raw = storage.getItem(UI_PREFERENCES_STORAGE_KEY);
  if (!raw) return fallback;

  try {
    return normalizeUiPreferences(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
};

export const saveUiPreferences = (
  preferences: UiPreferences,
  storage: Pick<Storage, "setItem"> = window.localStorage
) => {
  storage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  storage.setItem(LEGACY_THEME_STORAGE_KEY, preferences.appearance.theme);
  storage.setItem(LEGACY_PET_STORAGE_KEY, preferences.appearance.petEnabled ? "on" : "off");
};

export const applyUiPreset = (
  current: UiPreferences,
  preset: Exclude<UiLayoutPreset, "custom">
): UiPreferences => {
  const layout = PRESET_LAYOUTS[preset];
  return {
    ...current,
    preset,
    page: { ...layout.page },
    card: {
      ...current.card,
      ...layout.card,
      actionOrder: [...current.card.actionOrder],
      hiddenActions: [...current.card.hiddenActions]
    }
  };
};

export const resetUiLayout = (current: UiPreferences): UiPreferences => ({
  version: 1,
  preset: "standard",
  appearance: { ...current.appearance },
  page: { ...STANDARD_PAGE },
  card: {
    ...STANDARD_CARD,
    actionOrder: [...STANDARD_CARD.actionOrder],
    hiddenActions: []
  }
});

export const updateUiPreferences = (
  current: UiPreferences,
  updater: UiPreferences | ((preferences: UiPreferences) => UiPreferences),
  markCustom = true
) => {
  const candidate = typeof updater === "function" ? updater(current) : updater;
  return normalizeUiPreferences(
    markCustom ? { ...candidate, preset: "custom" } : candidate,
    current
  );
};

export const getVisibleCardActionOrder = (
  preferences: Pick<CardLayoutPreferences, "actionOrder" | "hiddenActions">,
  availableActions: Iterable<CardActionId>
) => {
  const available = new Set(availableActions);
  const hidden = new Set(preferences.hiddenActions);
  return normalizeCardActionOrder(preferences.actionOrder).filter(
    (action) => available.has(action) && !hidden.has(action)
  );
};

export const getAttachmentVisibleLimit = (preferences: CardLayoutPreferences) => {
  if (preferences.attachmentMode === "summary") return 1;
  return preferences.attachmentMaxVisible === "all"
    ? Number.POSITIVE_INFINITY
    : preferences.attachmentMaxVisible;
};

/**
 * 获取附件收起状态下的数量提示。
 * 单张参考图不重复显示“1 张”；堆叠模式仅在多图时提示总数或剩余数量。
 */
export const getCollapsedAttachmentIndicator = (
  mode: AttachmentMode,
  totalCount: number,
  visibleCount: number
) => {
  const hiddenCount = Math.max(0, totalCount - visibleCount);
  if (mode === "stack") {
    if (totalCount <= 1) return null;
    return hiddenCount > 0 ? `+${hiddenCount}` : `${totalCount}张`;
  }
  return hiddenCount > 0 ? `+${hiddenCount}` : null;
};
