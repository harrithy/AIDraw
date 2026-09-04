import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LEGACY_THEME_STORAGE_KEY,
  loadUiPreferences,
  UI_PREFERENCES_STORAGE_KEY
} from "../lib/uiPreferences";
import { useUiPreferences } from "./useUiPreferences";

type UiPreferencesApi = ReturnType<typeof useUiPreferences>;

let api: UiPreferencesApi | null = null;
let root: Root | null = null;
let container: HTMLElement | null = null;

/** 挂载 useUiPreferences 的最小宿主组件。 */
function Harness() {
  api = useUiPreferences();
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
});
