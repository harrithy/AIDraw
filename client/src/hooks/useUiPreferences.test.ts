import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_THEME_STORAGE_KEY,
  loadUiPreferences,
  saveUiPreferences,
  UI_PREFERENCES_STORAGE_KEY
} from "../lib/uiPreferences";
import { useUiPreferences } from "./useUiPreferences";

type UiPreferencesApi = ReturnType<typeof useUiPreferences>;

let api: UiPreferencesApi | null = null;
let root: Root | null = null;
let container: HTMLElement | null = null;
const onSaveError = vi.fn();

/** 挂载 useUiPreferences 的最小宿主组件。 */
function Harness() {
  api = useUiPreferences(onSaveError);
  return null;
}

const current = () => {
  if (!api) throw new Error("useUiPreferences 未挂载");
  return api;
};

const storedPreferences = () => loadUiPreferences();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  onSaveError.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(createElement(Harness));
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  api = null;
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe("useUiPreferences 预览会话", () => {
  const beginPreview = () => {
    act(() => {
      current().beginPreview();
    });
  };

  it("预览期间的调整会反映在状态里，但不会写入本地存储", () => {
    beginPreview();
    act(() => {
      current().updatePreferences((prefs) => ({
        ...prefs,
        appearance: { ...prefs.appearance, theme: "light" }
      }), false);
    });

    expect(current().preferences.appearance.theme).toBe("light");
    // 本地存储仍是预览前的默认值。
    expect(storedPreferences().appearance.theme).toBe("dark");
    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBe("dark");
  });

  it("提交预览后调整才写入本地存储", () => {
    beginPreview();
    act(() => {
      current().updatePreferences((prefs) => ({
        ...prefs,
        appearance: { ...prefs.appearance, theme: "light" }
      }), false);
    });
    act(() => {
      current().commitPreview();
    });

    expect(storedPreferences().appearance.theme).toBe("light");
    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBe("light");
  });

  it("取消预览会回退到上次保存的配置", () => {
    beginPreview();
    act(() => {
      current().applyPreset("focus");
    });
    expect(current().preferences.page.showMetrics).toBe(false);
    expect(current().preferences.preset).toBe("focus");

    act(() => {
      current().cancelPreview();
    });

    expect(current().preferences.page.showMetrics).toBe(true);
    expect(current().preferences.preset).toBe("standard");
    expect(storedPreferences().page.showMetrics).toBe(true);
  });

  it("预览会话外的直接修改仍然立即保存", () => {
    act(() => {
      current().updatePreferences((prefs) => ({
        ...prefs,
        page: { ...prefs.page, showMetrics: false }
      }), false);
    });

    expect(current().preferences.page.showMetrics).toBe(false);
    expect(storedPreferences().page.showMetrics).toBe(false);
  });

  it("连续预览修改不会逐次落盘，提交时只保存最终结果", () => {
    const before = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    beginPreview();
    act(() => {
      current().updatePreferences((prefs) => ({
        ...prefs,
        page: { ...prefs.page, composerWidth: 600 }
      }), false);
    });
    act(() => {
      current().updatePreferences((prefs) => ({
        ...prefs,
        page: { ...prefs.page, composerWidth: 900 }
      }), false);
    });

    expect(window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)).toBe(before);
    act(() => {
      current().commitPreview();
    });
    expect(storedPreferences().page.composerWidth).toBe(900);
  });

  it("预览中取消后可以再次开始新的预览会话", () => {
    beginPreview();
    act(() => {
      current().updatePreferences((prefs) => ({
        ...prefs,
        page: { ...prefs.page, sidebarWidth: 340 }
      }), false);
    });
    act(() => {
      current().cancelPreview();
    });
    expect(current().preferences.page.sidebarWidth).toBe(292);

    beginPreview();
    act(() => {
      current().updatePreferences((prefs) => ({
        ...prefs,
        page: { ...prefs.page, sidebarWidth: 320 }
      }), false);
    });
    act(() => {
      current().commitPreview();
    });
    expect(storedPreferences().page.sidebarWidth).toBe(320);
  });

  it.each([
    { editDraft: false, deliverEvent: true },
    { editDraft: true, deliverEvent: true },
    { editDraft: true, deliverEvent: false }
  ])("取消预览保留其他标签页的最新设置：%j", ({ editDraft, deliverEvent }) => {
    beginPreview();
    if (editDraft) {
      act(() => current().updatePreferences((prefs) => ({
        ...prefs,
        appearance: { ...prefs.appearance, theme: "light" }
      }), false));
    }

    const otherTabPreferences = storedPreferences();
    otherTabPreferences.appearance.theme = "anime";
    otherTabPreferences.page.sidebarWidth = 340;
    saveUiPreferences(otherTabPreferences);
    if (deliverEvent) {
      act(() => window.dispatchEvent(new StorageEvent("storage", {
        key: UI_PREFERENCES_STORAGE_KEY,
        newValue: JSON.stringify(otherTabPreferences)
      })));
    }
    expect(current().preferences.appearance.theme).toBe(editDraft ? "light" : "dark");
    const write = vi.spyOn(window.localStorage, "setItem");

    act(() => current().cancelPreview());

    expect(current().preferences).toEqual(otherTabPreferences);
    expect(storedPreferences()).toEqual(otherTabPreferences);
    expect(write).not.toHaveBeenCalled();
  });

  it("接收其他标签页的设置后只更新界面，不重复写回", () => {
    const otherTabPreferences = storedPreferences();
    otherTabPreferences.appearance.theme = "anime";
    saveUiPreferences(otherTabPreferences);
    const write = vi.spyOn(window.localStorage, "setItem");

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: UI_PREFERENCES_STORAGE_KEY,
      newValue: JSON.stringify(otherTabPreferences)
    })));

    expect(current().preferences).toEqual(otherTabPreferences);
    expect(write).not.toHaveBeenCalled();
  });

  it("保存失败保留预览，可继续编辑并重试，成功后只保存一次", () => {
    beginPreview();
    act(() => current().updatePreferences((prefs) => ({
      ...prefs,
      appearance: { ...prefs.appearance, theme: "anime" }
    }), false));
    const failure = new DOMException("存储空间不足", "QuotaExceededError");
    const write = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw failure;
    });
    let committed: boolean | undefined;

    act(() => { committed = current().commitPreview(); });

    expect(committed).toBe(false);
    expect(onSaveError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(current().preferences.appearance.theme).toBe("anime");
    expect(storedPreferences().appearance.theme).toBe("dark");
    act(() => current().updatePreferences((prefs) => ({
      ...prefs,
      page: { ...prefs.page, sidebarWidth: 330 }
    })));
    expect(write).toHaveBeenCalledTimes(1);

    write.mockRestore();
    const successfulWrite = vi.spyOn(window.localStorage, "setItem");
    act(() => { committed = current().commitPreview(); });

    expect(committed).toBe(true);
    expect(storedPreferences()).toEqual(current().preferences);
    expect(storedPreferences().page.sidebarWidth).toBe(330);
    expect(successfulWrite.mock.calls.filter(([key]) => key === UI_PREFERENCES_STORAGE_KEY)).toHaveLength(1);
  });

  it("保存失败后仍可取消，不重复写入或报告错误", () => {
    const original = storedPreferences();
    beginPreview();
    act(() => current().applyPreset("focus"));
    const write = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("存储不可用", "QuotaExceededError");
    });
    act(() => { current().commitPreview(); });
    act(() => current().cancelPreview());

    expect(current().preferences).toEqual(original);
    expect(write).toHaveBeenCalledTimes(1);
    expect(onSaveError).toHaveBeenCalledTimes(1);
  });
});
