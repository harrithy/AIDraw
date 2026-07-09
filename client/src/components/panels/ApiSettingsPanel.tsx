import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CheckCircle2, KeyRound, Loader2, Save, Settings } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../lib/motion";
import type {
  ImageProviderSettings,
  UpdateImageProviderSettingsPayload,
} from "../../types";

type ApiSettingsPanelProps = {
  autoFocusApiKey?: boolean;
  settings: ImageProviderSettings;
  variant?: "panel" | "dialog";
  onSave: (payload: UpdateImageProviderSettingsPayload) => Promise<void>;
};

export function ApiSettingsPanel({
  autoFocusApiKey = false,
  settings,
  variant = "panel",
  onSave
}: ApiSettingsPanelProps) {
  const settingsRef = useRef<HTMLFormElement | null>(null);
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
  }, [settings.baseUrl, settings.model]);

  useEffect(() => {
    if (!autoFocusApiKey) return;

    const focusTimer = window.setTimeout(() => {
      apiKeyInputRef.current?.focus();
      apiKeyInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [autoFocusApiKey]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const badge =
        settingsRef.current?.querySelector<HTMLElement>(".provider-badge");
      if (!badge) return;

      gsap.fromTo(
        badge,
        { scale: 0.985 },
        {
          scale: 1,
          duration: 0.28,
          ease: "back.out(1.6)",
          clearProps: "transform",
        },
      );
    },
    {
      dependencies: [settings.hasApiKey, settings.apiKeyMasked],
      scope: settingsRef,
    },
  );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const payload: UpdateImageProviderSettingsPayload = {
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      clearApiKey,
    };
    if (apiKey.trim()) {
      payload.apiKey = apiKey.trim();
      payload.clearApiKey = false;
    }

    try {
      setIsSaving(true);
      setError("");
      await onSave(payload);
      setApiKey("");
      setClearApiKey(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      ref={settingsRef}
      className={`settings-panel ${variant === "dialog" ? "dialog-mode" : ""}`}
      onSubmit={save}
    >
      {variant === "panel" ? (
        <div className="panel-title compact">
          <div>
            <p className="eyebrow">接口设置</p>
            <h2>多米API</h2>
          </div>
          <Settings size={22} />
        </div>
      ) : null}

      <div className={`provider-badge ${settings.hasApiKey ? "ready" : ""}`}>
        {settings.hasApiKey ? (
          <CheckCircle2 size={17} />
        ) : (
          <KeyRound size={17} />
        )}
        <span>{settings.hasApiKey ? "已保存 API Key" : "未配置 API Key"}</span>
        {settings.apiKeyMasked ? <small>{settings.apiKeyMasked}</small> : null}
      </div>

      <label>
        Base URL
        <input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://duomiapi.com"
        />
      </label>

      <label>
        Model
        <input
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="gpt-image-2"
        />
      </label>

      <label>
        API Key
        <input
          ref={apiKeyInputRef}
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            if (event.target.value) setClearApiKey(false);
          }}
          placeholder={
            settings.hasApiKey ? "留空则保留已保存 Key" : "输入 API Key"
          }
          type="password"
        />
      </label>

      <label className="check-line">
        <input
          type="checkbox"
          checked={clearApiKey}
          onChange={(event) => {
            setClearApiKey(event.target.checked);
            if (event.target.checked) setApiKey("");
          }}
        />
        清空已保存 Key
      </label>

      {error ? <small className="error-text">{error}</small> : null}

      <button className="secondary-submit" type="submit" disabled={isSaving}>
        {isSaving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
        保存接口设置
      </button>
    </form>
  );
}
