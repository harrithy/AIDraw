import { useEffect, useRef, useState } from "react";
import { Check, FileText, Loader2, Plus, Radio, Trash2, Unplug } from "lucide-react";
import { api } from "../../api";
import { createCustomProviderTemplate, renderRequestTemplate, validateCustomProviderConfig, type CustomProviderConfig } from "../../lib/customProviders";
import { recognizeCustomProviderDocument } from "../../lib/customProviderImport";
import type { ImageProviderSettings, UpdateImageProviderSettingsPayload } from "../../types";

type Props = {
  settings: ImageProviderSettings;
  onSave: (payload: UpdateImageProviderSettingsPayload) => Promise<void>;
};

/** 文档导入、协议编辑和真实测试共用同一份配置，测试任务也进入正式队列。 */
export function CustomProviderPanel({ settings, onSave }: Props) {
  const [draft, setDraft] = useState<CustomProviderConfig | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [modelsText, setModelsText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testJob, setTestJob] = useState<{ folderId: string; id: string } | null>(null);
  const [testPrompt, setTestPrompt] = useState("一只坐在窗边的小猫，柔和自然光");
  const [preview, setPreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const profiles = settings.customProviders ?? [];

  const edit = (config: CustomProviderConfig) => {
    setDraft(structuredClone(config));
    setModelsText(config.models.join("\n"));
    setBodyText(JSON.stringify(config.requestBody, null, 2));
    setApiKey(""); setDocumentText(""); setError(""); setMessage(""); setPreview("");
  };
  const update = <K extends keyof CustomProviderConfig>(key: K, value: CustomProviderConfig[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setPreview("");
  };
  const configValue = () => {
    if (!draft) throw new Error("请先添加一个中转");
    let requestBody: unknown;
    try { requestBody = JSON.parse(bodyText); } catch { throw new Error("请求模板不是有效 JSON"); }
    return validateCustomProviderConfig({ ...draft, models: modelsText.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean), requestBody });
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (next) { setError(next instanceof Error ? next.message : "操作失败"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!testJob) return;
    let cancelled = false;
    const check = async () => {
      try {
        const job = (await api.listJobs(testJob.folderId)).find((item) => item.id === testJob.id);
        if (cancelled) return;
        if (!job) { setTestJob(null); return; }
        if (job.status === "completed") {
          setMessage("测试成功：已获取生成结果，可在「中转接入测试」文件夹查看。");
          setTestJob(null);
        } else if (job.status === "failed") {
          setError("测试失败：" + (job.errorMessage ?? "请检查配置")); setTestJob(null);
        }
      } catch (next) {
        if (!cancelled) { setError(next instanceof Error ? next.message : "读取测试任务失败"); setTestJob(null); }
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [testJob]);

  const save = (test: boolean) => run(async () => {
    const config = configValue();
    if (test && !testPrompt.trim()) throw new Error("请填写测试提示词");
    await onSave({ saveCustomProvider: { config, apiKey } });
    setApiKey("");
    if (!test) { setMessage("已保存并启用，可回到创作面板选择你的模型。"); return; }
    const folders = await api.listFolders();
    const folder = folders.find((item) => item.name === "中转接入测试") ?? await api.createFolder("中转接入测试");
    const [job] = await api.createJobs(folder.id, {
      customProviderId: config.id, prompt: testPrompt.trim(), model: config.models[0],
      mode: "text-to-image", width: 1024, height: 1024, size: "1024x1024", count: 1
    });
    setTestJob({ folderId: folder.id, id: job.id });
    setMessage("测试任务已提交，正在等待中转结果。关闭设置后仍可在「中转接入测试」文件夹查看。");
  });

  return (
    <section className="custom-provider-panel" aria-label="自定义中转">
      <div className="custom-provider-intro">
        <span className="custom-provider-icon"><Unplug size={22} /></span>
        <div><h3>连接你的中转</h3><p>从接口文档开始，把自己的模型带进创作空间。</p></div>
      </div>
      <div className="custom-provider-list">
        {profiles.map((item) => (
          <div className="custom-provider-card" key={item.config.id} data-active={settings.activeCustomProviderId === item.config.id}>
            <button type="button" onClick={() => edit(item.config)} disabled={busy} className="custom-provider-card-copy">
              <strong>{item.config.name}{settings.activeCustomProviderId === item.config.id ? <em><Check size={12} /> 使用中</em> : null}</strong>
              <small>{item.config.models.length} 个模型 · {item.config.mode === "async" ? "异步任务" : "同步返回"}</small>
              <small>{item.config.baseUrl}</small>
            </button>
            <div className="custom-provider-card-actions">
              <button type="button" disabled={busy} onClick={() => void run(async () => {
                await onSave({ activateCustomProviderId: settings.activeCustomProviderId === item.config.id ? "" : item.config.id });
                setMessage(settings.activeCustomProviderId === item.config.id ? "已切回内置供应商。" : "已启用 " + item.config.name);
              })}>{settings.activeCustomProviderId === item.config.id ? "停用" : "启用"}</button>
              <button type="button" aria-label={"删除中转 " + item.config.name} disabled={busy} onClick={() => {
                if (!window.confirm("删除「" + item.config.name + "」及其凭据？依赖此中转的运行中任务将无法继续追踪。")) return;
                void run(async () => {
                  await onSave({ deleteCustomProviderId: item.config.id });
                  if (draft?.id === item.config.id) setDraft(null);
                  setMessage("中转已删除。");
                });
              }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        <button className="custom-provider-add" type="button" disabled={busy} onClick={() => edit(createCustomProviderTemplate())}><Plus size={16} />添加自定义中转</button>
      </div>

      {draft ? (
        <div className="custom-provider-editor">
          <div className="custom-provider-section-title"><h4>{profiles.some((item) => item.config.id === draft.id) ? "编辑连接" : "新建连接"}</h4><button type="button" disabled={busy} onClick={() => setDraft(null)}>收起</button></div>
          <fieldset disabled={busy} className="custom-provider-fields">
            <details className="custom-provider-document">
              <summary><FileText size={16} /> 从接口文档识别配置</summary>
              <p>支持 OpenAPI JSON、已导出的配置 JSON。文字或 Markdown 文档使用你保存的 DeepSeek Key 识别，请先移除文档中的密钥。</p>
              <textarea aria-label="接口文档" placeholder="粘贴接口文档，或导入 .json / .md / .txt 文件…" value={documentText} onChange={(event) => setDocumentText(event.target.value)} rows={5} />
              <div className="custom-provider-inline-actions">
                <input ref={fileRef} type="file" accept=".json,.md,.txt" hidden onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void run(async () => { if (file.size > 80_000) throw new Error("文档不能超过 80 KB"); setDocumentText(await file.text()); });
                  event.target.value = "";
                }} />
                <button type="button" onClick={() => fileRef.current?.click()}>导入文件</button>
                <button type="button" disabled={!documentText.trim()} onClick={() => void run(async () => {
                  const next = await recognizeCustomProviderDocument(documentText, { ...draft, models: modelsText.split(/[,，\n]/).filter(Boolean) });
                  edit(next); setMessage("已生成配置草稿，请核对地址、模型、请求模板和结果字段，再发送测试。");
                })}>识别并填入</button>
              </div>
            </details>
            <div className="custom-provider-form-grid">
              <label>中转名称<input aria-label="中转名称" value={draft.name} onChange={(event) => update("name", event.target.value)} /></label>
              <label>协议模板<select aria-label="协议模板" value={draft.mode} onChange={(event) => {
                const template = createCustomProviderTemplate(event.target.value === "async");
                setDraft({ ...draft, mode: template.mode, createPath: template.createPath, queryPath: template.queryPath, resultPath: template.resultPath });
              }}><option value="sync">同步 JSON · 兼容 Images</option><option value="async">异步 JSON · 创建后查询</option></select></label>
            </div>
            <label>中转地址<input aria-label="中转地址" placeholder="https://api.example.com 或 https://api.example.com/v1" value={draft.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} /></label>
            <label>模型列表<textarea aria-label="自定义模型列表" rows={2} placeholder="每行一个模型名称，也可用逗号分隔" value={modelsText} onChange={(event) => setModelsText(event.target.value)} /></label>
            <div className="custom-provider-form-grid">
              <label>鉴权请求头<input aria-label="鉴权请求头" placeholder="Authorization；留空表示无需鉴权" value={draft.authHeader} onChange={(event) => update("authHeader", event.target.value)} /></label>
              <label>鉴权前缀<select aria-label="鉴权前缀" value={draft.authPrefix} onChange={(event) => update("authPrefix", event.target.value)}><option value="Bearer ">Bearer + Key</option><option value="">直接使用 Key</option>{!["Bearer ", ""].includes(draft.authPrefix) ? <option value={draft.authPrefix}>{draft.authPrefix}</option> : null}</select></label>
            </div>
            <label>API Key<input aria-label="自定义中转 API Key" type="password" autoComplete="off" value={apiKey} placeholder={profiles.find((item) => item.config.id === draft.id)?.apiKeyMasked ? "已保存，留空保留原 Key" : "输入此中转的 API Key"} onChange={(event) => setApiKey(event.target.value)} /></label>
            <div className="custom-provider-form-grid">
              <label>提交接口<input aria-label="提交接口" value={draft.createPath} onChange={(event) => update("createPath", event.target.value)} /></label>
              <label>提交方法<select aria-label="提交方法" value={draft.createMethod} onChange={(event) => update("createMethod", event.target.value as "GET" | "POST")}><option>POST</option><option>GET</option></select></label>
            </div>
            <label>请求模板<textarea className="custom-provider-code" aria-label="请求模板" value={bodyText} rows={6} spellCheck={false} onChange={(event) => { setBodyText(event.target.value); setPreview(""); }} /></label>
            <p className="custom-provider-hint">变量：{"{{prompt}} {{model}} {{size}} {{width}} {{height}} {{image}} {{images}} {{duration}} {{quality}}"}。参考图使用公网 URL；结果也需返回 URL。</p>
            <div className="custom-provider-form-grid">
              <label>结果字段<input aria-label="结果字段" placeholder="data[].url" value={draft.resultPath} onChange={(event) => update("resultPath", event.target.value)} /></label>
              <label>结果类型<select aria-label="结果类型" value={draft.outputKind} onChange={(event) => update("outputKind", event.target.value as CustomProviderConfig["outputKind"])}><option value="image">图片</option><option value="video">视频</option><option value="audio">音频</option><option value="text">文本</option><option value="file">文件</option></select></label>
            </div>
            {draft.mode === "async" ? <div className="custom-provider-async">
              <label>查询接口（GET）<input aria-label="查询接口" value={draft.queryPath} onChange={(event) => update("queryPath", event.target.value)} /><small>使用 {"{id}"} 代替远程任务 ID</small></label>
              <div className="custom-provider-form-grid"><label>任务 ID 字段<input aria-label="任务 ID 字段" value={draft.taskIdPath} onChange={(event) => update("taskIdPath", event.target.value)} /></label><label>状态字段<input aria-label="状态字段" value={draft.statusPath} onChange={(event) => update("statusPath", event.target.value)} /></label></div>
              <div className="custom-provider-form-grid"><label>成功状态<input aria-label="成功状态" value={draft.successValues.join(",")} onChange={(event) => update("successValues", event.target.value.split(","))} /></label><label>失败状态<input aria-label="失败状态" value={draft.failureValues.join(",")} onChange={(event) => update("failureValues", event.target.value.split(","))} /></label></div>
              <label>错误字段<input aria-label="错误字段" value={draft.errorPath} onChange={(event) => update("errorPath", event.target.value)} /></label>
            </div> : null}
            <details><summary>请求预览与测试</summary>
              <label>测试提示词<input aria-label="测试提示词" value={testPrompt} onChange={(event) => setTestPrompt(event.target.value)} /></label>
              <button type="button" onClick={() => void run(async () => {
                const config = configValue(); setPreview(JSON.stringify(renderRequestTemplate(config.requestBody, { prompt: testPrompt, model: config.models[0], size: "1024x1024", width: 1024, height: 1024, duration: 5, quality: "high" }), null, 2));
              })}>预览请求参数</button>
              {preview ? <pre className="custom-provider-preview">{preview}</pre> : null}
              <p className="custom-provider-hint">真实测试会保存并启用此配置，发送 1 个生成任务，可能产生中转费用。结果保存在「中转接入测试」文件夹。</p>
              <button type="button" disabled={Boolean(testJob)} onClick={() => void save(true)}><Radio size={14} />保存并发送测试（可能计费）</button>
            </details>
          </fieldset>
          <div className="custom-provider-save"><span>配置和凭据保存在当前浏览器</span><button type="button" className="custom-provider-primary" disabled={busy} onClick={() => void save(false)}>{busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />}保存并启用</button></div>
        </div>
      ) : null}
      {busy ? <p role="status" className="custom-provider-status"><Loader2 size={14} className="spin" />正在处理…</p> : null}
      {testJob ? <p role="status" className="custom-provider-status"><Loader2 size={14} className="spin" />测试任务正在执行…</p> : null}
      {message ? <p role="status" className="custom-provider-status">{message}</p> : null}
      {error ? <p role="alert" className="custom-provider-error">{error}</p> : null}
    </section>
  );
}
