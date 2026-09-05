import { beforeEach, describe, expect, it } from "vitest";
import {
  CARD_ACTION_IDS,
  LEGACY_PET_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  UI_PREFERENCES_STORAGE_KEY,
  applyUiPreset,
  createDefaultUiPreferences,
  getAttachmentVisibleLimit,
  getCollapsedAttachmentIndicator,
  getVisibleCardActionOrder,
  loadUiPreferences,
  normalizeCardActionOrder,
  normalizeUiPreferences,
  resetUiLayout,
  saveUiPreferences,
  updateUiPreferences
} from "./uiPreferences";

describe("UI preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the current desktop layout as the default", () => {
    const preferences = createDefaultUiPreferences(window.localStorage, true);
    expect(preferences.preset).toBe("standard");
    expect(preferences.page).toMatchObject({
      sidebarOpen: true,
      sidebarWidth: 292,
      toolbarPosition: "top-left",
      composerWidth: 760,
      composerCollapsed: false
    });
    expect(preferences.card).toMatchObject({
      toolbarSide: "right",
      toolbarBehavior: "click",
      attachmentSide: "right",
      attachmentMode: "list",
      attachmentThumbnailSize: 58,
      attachmentMaxVisible: "all"
    });
  });

  it("inherits legacy theme and pet settings", () => {
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "light");
    window.localStorage.setItem(LEGACY_PET_STORAGE_KEY, "off");
    const preferences = loadUiPreferences(window.localStorage, false);
    expect(preferences.appearance).toEqual({ theme: "light", petEnabled: false });
    expect(preferences.page.sidebarOpen).toBe(false);
  });

  it("keeps the anime theme when loading legacy appearance settings", () => {
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "anime");
    const preferences = loadUiPreferences(window.localStorage, true);
    expect(preferences.appearance.theme).toBe("anime");
  });

  it("falls back safely when stored JSON is invalid", () => {
    window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, "{broken");
    const preferences = loadUiPreferences(window.localStorage, true);
    expect(preferences.preset).toBe("standard");
    expect(preferences.page.sidebarWidth).toBe(292);
  });

  it("clamps sizes and repairs unknown or duplicate actions", () => {
    const fallback = createDefaultUiPreferences(window.localStorage, true);
    const preferences = normalizeUiPreferences({
      ...fallback,
      page: { ...fallback.page, sidebarWidth: 1000, composerWidth: 10 },
      card: {
        ...fallback.card,
        actionOrder: ["delete", "delete", "unknown"],
        hiddenActions: ["download", "unknown"]
      }
    }, fallback);

    expect(preferences.page.sidebarWidth).toBe(360);
    expect(preferences.page.composerWidth).toBe(560);
    expect(preferences.card.actionOrder[0]).toBe("delete");
    expect(new Set(preferences.card.actionOrder).size).toBe(CARD_ACTION_IDS.length);
    expect(preferences.card.hiddenActions).toEqual(["download"]);
  });

  it("normalizes anime as a supported appearance theme", () => {
    const fallback = createDefaultUiPreferences(window.localStorage, true);
    const preferences = normalizeUiPreferences({
      ...fallback,
      appearance: { ...fallback.appearance, theme: "anime" }
    }, fallback);

    expect(preferences.appearance.theme).toBe("anime");
  });

  it("applies presets without changing appearance or action choices", () => {
    const current = createDefaultUiPreferences(window.localStorage, true);
    current.appearance.theme = "light";
    current.card.actionOrder = normalizeCardActionOrder(["delete", "retry"]);
    current.card.hiddenActions = ["upload"];
    const next = applyUiPreset(current, "focus");

    expect(next.preset).toBe("focus");
    expect(next.page.sidebarOpen).toBe(false);
    expect(next.card.attachmentMode).toBe("summary");
    expect(next.appearance.theme).toBe("light");
    expect(next.card.actionOrder[0]).toBe("delete");
    expect(next.card.hiddenActions).toEqual(["upload"]);
  });

  it("resets layout without changing appearance", () => {
    const current = applyUiPreset(createDefaultUiPreferences(window.localStorage, true), "compact");
    current.appearance.petEnabled = false;
    current.card.actionOrder = normalizeCardActionOrder(["delete", "retry"]);
    current.card.hiddenActions = ["download"];
    const reset = resetUiLayout(current);
    expect(reset.preset).toBe("standard");
    expect(reset.page.sidebarWidth).toBe(292);
    expect(reset.appearance.petEnabled).toBe(false);
    expect(reset.card.actionOrder).toEqual(CARD_ACTION_IDS);
    expect(reset.card.hiddenActions).toEqual([]);
  });

  it("marks layout edits as custom while appearance edits keep the selected preset", () => {
    const current = applyUiPreset(createDefaultUiPreferences(window.localStorage, true), "focus");
    const layoutEdit = updateUiPreferences(current, (preferences) => ({
      ...preferences,
      page: { ...preferences.page, composerWidth: 700 }
    }));
    const appearanceEdit = updateUiPreferences(current, (preferences) => ({
      ...preferences,
      appearance: { ...preferences.appearance, theme: "light" }
    }), false);

    expect(layoutEdit.preset).toBe("custom");
    expect(appearanceEdit.preset).toBe("focus");
  });

  it("filters unavailable and hidden actions while preserving order", () => {
    const preferences = createDefaultUiPreferences(window.localStorage, true).card;
    preferences.actionOrder = normalizeCardActionOrder(["delete", "download", "retry"]);
    preferences.hiddenActions = ["download"];
    expect(getVisibleCardActionOrder(preferences, ["retry", "download", "delete"]))
      .toEqual(["delete", "retry"]);
  });

  it("uses the correct attachment limit for each mode", () => {
    const preferences = createDefaultUiPreferences(window.localStorage, true).card;
    expect(getAttachmentVisibleLimit(preferences)).toBe(Number.POSITIVE_INFINITY);
    expect(getAttachmentVisibleLimit({ ...preferences, attachmentMode: "summary" })).toBe(1);
    expect(getAttachmentVisibleLimit({ ...preferences, attachmentMaxVisible: 3 })).toBe(3);
  });

  it("does not render a redundant count tile for a single stacked attachment", () => {
    expect(getCollapsedAttachmentIndicator("stack", 1, 1)).toBeNull();
    expect(getCollapsedAttachmentIndicator("stack", 3, 3)).toBe("3张");
    expect(getCollapsedAttachmentIndicator("stack", 5, 2)).toBe("+3");
    expect(getCollapsedAttachmentIndicator("summary", 4, 1)).toBe("+3");
  });

  it("saves the canonical and legacy preference keys", () => {
    const preferences = createDefaultUiPreferences(window.localStorage, true);
    preferences.appearance = { theme: "anime", petEnabled: false };
    saveUiPreferences(preferences, window.localStorage);
    expect(JSON.parse(window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY) || "null"))
      .toEqual(preferences);
    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBe("anime");
    expect(window.localStorage.getItem(LEGACY_PET_STORAGE_KEY)).toBe("off");
    expect(loadUiPreferences(window.localStorage, true)).toEqual(preferences);
  });
});
