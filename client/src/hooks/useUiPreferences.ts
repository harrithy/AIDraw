import { useCallback, useEffect, useState } from "react";
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

export function useUiPreferences(onSaveError?: (error: unknown) => void) {
  const [preferences, setPreferencesState] = useState<UiPreferences>(() => loadUiPreferences());

  const persist = useCallback((next: UiPreferences) => {
    try {
      saveUiPreferences(next);
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

  useEffect(() => {
    persist(preferences);
  }, [persist, preferences]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
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
  }, []);

  return {
    preferences,
    updatePreferences,
    applyPreset,
    resetLayout
  };
}
