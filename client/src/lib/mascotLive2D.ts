import type { Cubism4InternalModel, Live2DModel } from "pixi-live2d-display/cubism4";

// 动作时长同时用于采样与结束判断，避免长动作还没播完就被切回待机。
export const MASCOT_LIVE2D_ACTION_DURATIONS = {
  idle: 0,
  blink: 0.6,
  nod: 1.8,
  tilt: 1.8,
  wink: 1.35,
  shake: 2.1,
  lookAround: 3.2,
  smile: 2.4
} as const;
export type MascotLive2DAction = keyof typeof MASCOT_LIVE2D_ACTION_DURATIONS;
export const MASCOT_LIVE2D_MODEL = "/mascot/live2d/aidraw-girl.model3.json";
const CORE_URL = "/vendor/live2d/live2dcubismcore.min.js";
let corePromise: Promise<void> | undefined;
let modelLoadQueue = Promise.resolve();

/** 原生参数驱动动作；幅度与绑定范围一起限制，避免夸张拉伸脸部。 */
export function getMascotLive2DFrame(time: number, action: MascotLive2DAction, actionTime: number, focus: { x: number; y: number }) {
  const phase = time % 4.8;
  const blink = phase > 3.1 && phase < 3.32 ? Math.sin((phase - 3.1) / 0.22 * Math.PI) ** 2 : 0;
  const duration = MASCOT_LIVE2D_ACTION_DURATIONS[action];
  const actionProgress = duration === 0 ? 0 : Math.min(1, Math.max(0, actionTime / duration));
  const envelope = Math.sin(actionProgress * Math.PI) ** 2;
  const clamp = (value: number) => Math.min(1, Math.max(-1, value));
  const smooth = (value: number) => {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
  };
  // 闭眼动作短暂过渡后保持完整闭眼，避免长时间停留在贴图混合的中间状态。
  const hold = smooth(actionProgress / 0.18) * smooth((1 - actionProgress) / 0.22);
  const frame = {
    ParamAngleX: clamp(focus.x) * 12 + Math.sin(time * 0.55) * 2,
    ParamAngleY: clamp(focus.y) * 7 + (action === "nod" ? Math.sin(actionProgress * Math.PI * 4) * envelope * 23 : 0),
    ParamAngleZ: Math.sin(time * 0.65) * 2 + (action === "tilt" ? envelope * 25 : 0),
    ParamBreath: (Math.sin(time * 1.7 - Math.PI / 2) + 1) / 2,
    ParamHairSway: Math.sin(time * 1.2) * 0.45,
    ParamEyeBallX: clamp(focus.x) * 0.8,
    ParamEyeBallY: clamp(focus.y) * 0.8,
    ParamEyeLOpen: 1 - Math.max(blink, action === "blink" ? envelope : 0),
    ParamEyeROpen: 1 - Math.max(blink, action === "blink" ? envelope : 0)
  };

  if (action === "wink") {
    frame.ParamEyeLOpen = 1 - Math.max(blink, hold);
    frame.ParamEyeROpen = 1 - blink * (1 - hold);
    frame.ParamAngleZ += hold * 18;
  } else if (action === "shake") {
    const sway = Math.sin(actionProgress * Math.PI * 6) * envelope;
    frame.ParamAngleX = frame.ParamAngleX * (1 - envelope) + sway * 27;
    frame.ParamAngleZ += sway * 7;
    frame.ParamEyeBallX = frame.ParamEyeBallX * (1 - envelope) - sway * 0.55;
    frame.ParamHairSway += sway * 0.3;
  } else if (action === "lookAround") {
    const gaze = Math.sin(actionProgress * Math.PI * 2) * hold;
    // 张望期间由动作引导目光，首尾平滑交还给指针跟随。
    frame.ParamAngleX = frame.ParamAngleX * (1 - hold) + gaze * 28;
    frame.ParamAngleY += hold * 5;
    frame.ParamEyeBallX = frame.ParamEyeBallX * (1 - hold) + gaze * 0.95;
    frame.ParamEyeBallY = frame.ParamEyeBallY * (1 - hold) + hold * 0.15;
  } else if (action === "smile") {
    frame.ParamEyeLOpen = frame.ParamEyeROpen = 1 - Math.max(blink, hold);
    frame.ParamAngleZ -= hold * 16;
    frame.ParamAngleY += hold * 8;
    frame.ParamBreath += hold * 0.12;
  }

  // 最终限制在模型实际绑定的范围内，极端指针位置也不会把动作幅度叠加越界。
  frame.ParamAngleX = clamp(frame.ParamAngleX / 30) * 30;
  frame.ParamAngleY = clamp(frame.ParamAngleY / 30) * 30;
  frame.ParamAngleZ = clamp(frame.ParamAngleZ / 30) * 30;
  frame.ParamEyeBallX = clamp(frame.ParamEyeBallX);
  frame.ParamEyeBallY = clamp(frame.ParamEyeBallY);
  frame.ParamHairSway = clamp(frame.ParamHairSway);
  frame.ParamBreath = Math.min(1, Math.max(0, frame.ParamBreath));
  return frame;
}

/** Core 只从项目自身加载；失败后清理脚本，允许用户重试。 */
function loadCubismCore(): Promise<void> {
  if ("Live2DCubismCore" in window) return Promise.resolve();
  if (corePromise) return corePromise;
  corePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CORE_URL;
    script.async = true;
    const timeout = window.setTimeout(() => finish(new Error("Live2D 运行时加载超时")), 15000);
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (error) { script.remove(); reject(error); } else resolve();
    };
    script.onload = () => finish("Live2DCubismCore" in window ? undefined : new Error("Live2D 运行时不可用"));
    script.onerror = () => finish(new Error("Live2D 运行时加载失败"));
    document.head.appendChild(script);
  }).catch((error: unknown) => { corePromise = undefined; throw error; });
  return corePromise;
}

/** 提前确认贴图可解码，避免渲染库缓存失败的 ImageResource 导致无法重试。 */
function preloadTexture(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => finish(new Error("角色贴图加载超时")), 15000);
    const abort = () => finish(new DOMException("已离开形象馆", "AbortError"));
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
      if (error) { image.removeAttribute("src"); reject(error); } else resolve();
    };
    image.onload = () => finish();
    image.onerror = () => finish(new Error("角色贴图加载失败"));
    signal.addEventListener("abort", abort, { once: true });
    image.src = new URL("texture_00.png", new URL(MASCOT_LIVE2D_MODEL, window.location.href)).href;
  });
}

export interface MascotLive2DController {
  setPaused(paused: boolean): void;
  play(action: MascotLive2DAction): void;
  reset(): void;
  destroy(): void;
}

/** 在独立展示区创建 WebGL 模型，负责可见性、尺寸变化和完整资源回收。 */
export async function createMascotLive2D(host: HTMLElement, signal: AbortSignal, onActionEnd: () => void): Promise<MascotLive2DController> {
  await loadCubismCore();
  const [{ Application }, { Live2DModel, Live2DFactory }] = await Promise.all([import("pixi.js"), import("pixi-live2d-display/cubism4")]);
  signal.throwIfAborted();
  // Pixi 按 URL 缓存纹理；串行完成旧加载的清理，避免快速切换时销毁新模型共享的贴图。
  const previousLoad = modelLoadQueue;
  let releaseLoad!: () => void;
  modelLoadQueue = new Promise<void>((resolve) => { releaseLoad = resolve; });
  let model: Live2DModel<Cubism4InternalModel>;
  try {
    await previousLoad;
    signal.throwIfAborted();
    await preloadTexture(signal);
    const candidate = new Live2DModel<Cubism4InternalModel>({ autoInteract: false, autoUpdate: false });
    try {
      await Live2DFactory.setupLive2DModel(candidate, MASCOT_LIVE2D_MODEL, { autoInteract: false, autoUpdate: false });
    } catch (error) {
      // 模型已创建但后续步骤失败时，仍要归还原生内存。
      if (candidate.internalModel) candidate.destroy({ children: true, texture: true, baseTexture: true });
      else candidate.removeAllListeners();
      throw error;
    }
    model = candidate;
    if (signal.aborted) { model.destroy({ children: true, texture: true, baseTexture: true }); signal.throwIfAborted(); }
  } finally { releaseLoad(); }
  let app: InstanceType<typeof Application>;
  try {
    app = new Application({ backgroundAlpha: 0, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, autoStart: false, sharedTicker: false, width: host.clientWidth, height: host.clientHeight });
  } catch (error) {
    model.destroy({ children: true, texture: true, baseTexture: true });
    throw error;
  }
  const canvas = app.view as HTMLCanvasElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  app.stage.addChild(model);
  model.anchor.set(0.5, 0.5);
  const originalWidth = model.width;
  const originalHeight = model.height;
  let time = 0;
  let action: MascotLive2DAction = "idle";
  let actionStart = 0;
  let paused = true;
  let visible = true;
  let destroyed = false;
  let focus = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

  const applyParameters = () => {
    const frame = getMascotLive2DFrame(time, action, time - actionStart, focus);
    for (const [id, value] of Object.entries(frame)) model.internalModel.coreModel.setParameterValueById(id, value);
  };
  model.internalModel.on("beforeModelUpdate", applyParameters);
  const resize = () => {
    if (destroyed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    app.renderer.resize(width, height);
    model.scale.set(Math.min(width / originalWidth, height / originalHeight) * 0.98);
    model.position.set(width / 2, height / 2);
    app.render();
  };
  const update = () => {
    const dt = Math.min(app.ticker.deltaMS, 64);
    time += dt / 1000;
    const smoothing = 1 - Math.exp(-dt / 140);
    focus = { x: focus.x + (target.x - focus.x) * smoothing, y: focus.y + (target.y - focus.y) * smoothing };
    if (action !== "idle" && time - actionStart >= MASCOT_LIVE2D_ACTION_DURATIONS[action]) { action = "idle"; onActionEnd(); }
    model.update(dt);
  };
  const updatePlayback = () => { if (!destroyed) { if (paused || !visible || document.hidden) app.stop(); else app.start(); } };
  const pointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    target.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    target.y = 1 - (event.clientY - rect.top) / rect.height * 2;
  };
  const pointerLeave = () => { target.x = 0; target.y = 0; };
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerleave", pointerLeave);
  document.addEventListener("visibilitychange", updatePlayback);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updatePlayback(); });
  intersectionObserver.observe(host);
  app.ticker.maxFPS = 40;
  app.ticker.add(update);
  model.update(0);
  resize();

  return {
    setPaused(value) { paused = value; updatePlayback(); },
    play(value) { action = value; actionStart = time; },
    reset() { time = 0; action = "idle"; actionStart = 0; focus = { x: 0, y: 0 }; pointerLeave(); model.update(0); app.render(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", updatePlayback);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
      model.internalModel.off("beforeModelUpdate", applyParameters);
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    }
  };
}
