import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Loader2, Save, Settings } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { prefersReducedMotion } from "../../lib/motion";
import type {
  ApiProviderId,
  ImageProviderSettings,
  UpdateImageProviderSettingsPayload,
} from "../../types";

type ApiSettingsPanelProps = {
  autoFocusApiKey?: boolean;
  settings: ImageProviderSettings;
  variant?: "panel" | "dialog";
  onSave: (payload: UpdateImageProviderSettingsPayload) => Promise<void>;
};

const apiProviderOptions = [
  { label: "多米API", description: "https://duomiapi.com", value: "duomi" },
  { label: "Grsai", description: "https://grsaiapi.com", value: "grsai" }
] as const;

const getApiProviderLabel = (providerId: ApiProviderId) =>
  apiProviderOptions.find((option) => option.value === providerId)?.label ?? providerId;

export function ApiSettingsPanel({
  autoFocusApiKey = false,
  settings,
  variant = "panel",
  onSave
}: ApiSettingsPanelProps) {
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [provider, setProvider] = useState<ApiProviderId>("duomi");
  const [providerOpen, setProviderOpen] = useState(false);
  const [savedKeySelectOpen, setSavedKeySelectOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!autoFocusApiKey) return;
    const focusTimer = window.setTimeout(() => {
      importInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [autoFocusApiKey]);

  useEffect(() => {
    setProvider(settings.providerId);
  }, [settings.providerId]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const animateTrigger = (selector: string, open: boolean) => {
        const trigger = settingsRef.current?.querySelector<HTMLElement>(selector);
        if (!trigger) return;
        gsap.to(trigger, {
          scale: open ? 1.012 : 1,
          y: open ? -1 : 0,
          duration: open ? 0.2 : 0.16,
          ease: open ? "back.out(1.8)" : "power2.out",
          overwrite: "auto",
          clearProps: open ? undefined : "transform"
        });
      };

      animateTrigger(".saved-api-key-select-trigger", savedKeySelectOpen);
      animateTrigger(".api-provider-select-trigger", providerOpen);
    },
    {
      dependencies: [providerOpen, savedKeySelectOpen],
      scope: settingsRef,
      revertOnUpdate: true
    }
  );

  const handleImport = async (event: FormEvent) => {
    event.preventDefault();
    if (!importText.trim()) return;

    try {
      setIsSaving(true);
      setError("");
      await onSave({ importApiKey: importText.trim(), providerId: provider });
      setImportText("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "导入失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetActiveKey = async (index: number) => {
    if (index === settings.activeApiKeyIndex) return;
    try {
      setIsSaving(true);
      setError("");
      await onSave({ setActiveApiKeyIndex: index });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "切换 API Key 失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      ref={settingsRef}
      className={`settings-panel ${variant === "dialog" ? "dialog-mode" : ""}`}
    >
      {variant === "panel" ? (
        <div className="panel-title compact">
          <div>
            <p className="eyebrow">接口设置</p>
            <h2>API 设置</h2>
          </div>
          <Settings size={22} />
        </div>
      ) : null}

      <label>
        正在使用
        <Select
          value={settings.activeApiKeyIndex >= 0 ? String(settings.activeApiKeyIndex) : undefined}
          open={savedKeySelectOpen}
          onOpenChange={setSavedKeySelectOpen}
          onValueChange={(value) => handleSetActiveKey(Number(value))}
          disabled={settings.savedApiKeysMasked.length === 0 || isSaving}
        >
          <SelectTrigger aria-label="正在使用的 API Key" className="api-provider-select-trigger saved-api-key-select-trigger">
            <SelectValue placeholder="未配置 API Key" />
          </SelectTrigger>
          <SelectContent
            side="bottom"
            sideOffset={7}
            position="popper"
            align="start"
            className="composer-select-content api-provider-select-content saved-api-key-select-content"
          >
            <SelectGroup>
              {settings.savedApiKeysMasked.map((maskedKey, index) => {
                const providerLabel = getApiProviderLabel(settings.savedApiKeyProviderIds[index] || "duomi");
                return (
                  <SelectItem key={`${maskedKey}-${index}`} value={String(index)} className="composer-select-item api-provider-select-item">
                    <span className="api-provider-option-copy">
                      <strong>{providerLabel}</strong>
                      <span className="api-provider-option-separator">-</span>
                      <small>{maskedKey}</small>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>

      <label>
        API 供应商
        <Select
          value={provider}
          open={providerOpen}
          onOpenChange={setProviderOpen}
          onValueChange={(value) => setProvider(value as ApiProviderId)}
        >
          <SelectTrigger aria-label="API 供应商" className="api-provider-select-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            side="bottom"
            sideOffset={7}
            position="popper"
            align="start"
            className="composer-select-content api-provider-select-content"
          >
            <SelectGroup>
              {apiProviderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="composer-select-item api-provider-select-item">
                  <span className="api-provider-option-copy">
                    <strong>{option.label}</strong>
                    <span className="api-provider-option-separator">-</span>
                    <small>{option.description}</small>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>

      <form className="api-key-import-form" onSubmit={handleImport}>
        <label>
          导入新的 API Key
          <input
            ref={importInputRef}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="每次输入一个 API Key"
            type="password"
            autoComplete="off"
          />
        </label>

        {error ? <small className="error-text">{error}</small> : null}

        <button className="secondary-submit" type="submit" disabled={isSaving || !importText.trim()}>
          {isSaving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
          导入并保存
        </button>
      </form>
    </div>
  );
}
