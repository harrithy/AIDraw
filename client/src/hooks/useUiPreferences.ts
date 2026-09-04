import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyUiPreset,
  loadUiPreferences,
  normalizeUiPreferences,
  resetUiLayout,
  saveUiPreferences,
  updateUiPreferences,
  UI_PREFERENCES_STORAGE_KEY,
  type UiLayoutPreset,
  type UiPreferences
} from "../lib/uiPreferences";

type PreferenceUpdater = UiPreferences | ((current: UiPreferences) => UiPreferences);

/**
 * 个性化设置状态管理。
 *
 * 常规修改（工具栏快捷开关等）会立即保存到本地；
 * 而个性化设置弹窗开启期间进入「预览会话」：
 * - 弹窗内的所有调整只进入内存状态，实时反映在画布上，不会写入存储；
 * - 点击「应用」调用 commitPreview 统一持久化；
 * - 点击「取消」或直接关闭弹窗调用 cancelPreview 回退到上次保存的配置。
 */
export function useUiPreferences(onSaveError?: (error: unknown) => void) {
  const [preferences, setPreferencesState] = useState<UiPreferences>(() => loadUiPreferences());
  const [isPreviewing, setIsPreviewing] = useState(false);
  // 最后一次成功持久化的配置，作为取消预览时的回退基线。
  const persistedRef = useRef<UiPreferences>(preferences);
  // 始终指向最新渲染的配置，供 commitPreview 读取，避免闭包过期。
  const preferencesRef = useRef<UiPreferences>(preferences);

  useEffect(() => {
    preferencesRef.current = preferences;
  });

  const persist = useCallback((next: UiPreferences) => {
    try {
      saveUiPreferences(next);
      persistedRef.current = next;
    } catch (error) {
      onSaveError?.(error);
    }
  }, [onSaveError]);

  const updatePreferences = useCallback((updater: PreferenceUpdater, markCustom = true) => {
    setPreferencesState((current) => updateUiPreferences(current, updater, markCustom));
  }, []);

  const applyPreset = useCallback((preset: Exclude<UiLayoutPreset, "custom">) => {
    setPreferencesState((current) => applyUiPreset(current, preset));
  }, []);

  const resetLayout = useCallback(() => {
    setPreferencesState((current) => resetUiLayout(current));
  }, []);

  // ---- 预览会话控制 ----

  /** 打开设置弹窗时开始预览：此后所有调整只进入内存状态，不自动保存。 */
  const beginPreview = useCallback(() => {
    setIsPreviewing(true);
  }, []);

  /** 确认应用：把当前预览结果一次性写入存储并结束预览。 */
  const commitPreview = useCallback(() => {
    persist(preferencesRef.current);
    setIsPreviewing(false);
  }, [persist]);

  /** 放弃更改：恢复为上次保存的配置并结束预览。 */
  const cancelPreview = useCallback(() => {
    setPreferencesState(persistedRef.current);
    setIsPreviewing(false);
  }, []);

  // 预览会话期间挂起自动保存；其余情况与旧行为一致：改动即持久化。
  useEffect(() => {
    if (isPreviewing) return;
    persist(preferences);
  }, [isPreviewing, persist, preferences]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      // 预览期间忽略其他标签页写入，避免覆盖未确认的调整。
      if (isPreviewing) return;
      if (event.key !== UI_PREFERENCES_STORAGE_KEY || event.newValue === null) return;
      const rawPreferences = event.newValue;
      try {
        setPreferencesState((current) => normalizeUiPreferences(JSON.parse(rawPreferences), current));
      } catch {
        // 其他标签页写入损坏数据时保留当前有效配置。
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isPreviewing]);

  return {
    preferences,
    updatePreferences,
    applyPreset,
    resetLayout,
    beginPreview,
    commitPreview,
    cancelPreview
  };
}
