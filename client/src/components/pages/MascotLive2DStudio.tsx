import { Eye, EyeOff, Heart, MoveHorizontal, MoveUp, Pause, Play, RotateCcw, ScanEye, Smile, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createMascotLive2D, type MascotLive2DAction, type MascotLive2DController } from "../../lib/mascotLive2D";

const ACTIONS = [
  { id: "idle", label: "陪伴", icon: Heart },
  { id: "blink", label: "眨眼", icon: Eye },
  { id: "nod", label: "点头", icon: MoveUp },
  { id: "tilt", label: "歪头", icon: Sparkles },
  { id: "wink", label: "眨单眼", icon: EyeOff },
  { id: "shake", label: "摇头", icon: MoveHorizontal },
  { id: "lookAround", label: "张望", icon: ScanEye },
  { id: "smile", label: "开心笑", icon: Smile }
] as const;

/** 原创少女的 Live2D 展示；加载失败保留原画与明确的重试入口。 */
export function MascotLive2DStudio() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MascotLive2DController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [action, setAction] = useState<MascotLive2DAction>("idle");

  useEffect(() => {
    const abort = new AbortController();
    setStatus("loading");
    setAction("idle");
    createMascotLive2D(hostRef.current!, abort.signal, () => setAction("idle")).then((controller) => {
      if (abort.signal.aborted) { controller.destroy(); return; }
      controllerRef.current = controller;
      setStatus("ready");
    }).catch(() => { if (!abort.signal.aborted) setStatus("error"); });
    return () => { abort.abort(); controllerRef.current?.destroy(); controllerRef.current = null; };
  }, [attempt]);

  useEffect(() => { controllerRef.current?.setPaused(paused); }, [paused, status]);

  const play = (next: MascotLive2DAction) => { setAction(next); setPaused(false); controllerRef.current?.play(next); };
  const reset = () => { setAction("idle"); controllerRef.current?.reset(); };

  return (
    <div className="mascot-live2d-studio" role="region" aria-label="原创少女 Live2D 展示" aria-busy={status === "loading"}>
      <div className="mascot-live2d-canvas" ref={hostRef} />
      {status !== "ready" && (
        <div className="mascot-live2d-fallback">
          <img src="/mascot/aidraw-girl-2d-v1.png" alt="AIDraw 原创绘画少女立绘" />
          <div role="status">{status === "loading" ? "正在唤醒画里的她…" : <>Live2D 暂时无法加载<button type="button" onClick={() => setAttempt((value) => value + 1)}>重新加载</button></>}</div>
        </div>
      )}
      {status === "ready" && <span className="mascot-live2d-hint"><span />目光会跟随你</span>}
      <div className="mascot-live2d-utilities">
        <button type="button" onClick={reset} disabled={status !== "ready"} aria-label="重置 Live2D 动作" title="重置动作"><RotateCcw size={14} /></button>
        <button type="button" onClick={() => setPaused((value) => !value)} disabled={status !== "ready"} aria-label={paused ? "播放 Live2D" : "暂停 Live2D"} title={paused ? "播放" : "暂停"}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
      </div>
      <div className="mascot-live2d-actions" aria-label="角色互动">
        {ACTIONS.map(({ id, label, icon: Icon }) => <button key={id} type="button" disabled={status !== "ready"} aria-pressed={action === id} onClick={() => play(id)}><Icon size={12} />{label}</button>)}
      </div>
      <span className="mascot-live2d-status" aria-live="polite">{status === "ready" ? paused ? "静静陪着你" : ACTIONS.find((item) => item.id === action)?.label : ""}</span>
    </div>
  );
}
