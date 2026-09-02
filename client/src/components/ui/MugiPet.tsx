import { useEffect, useRef, useState } from "react";

/** Mugi 桌宠动作帧（GIF 静态资源）。 */
const FRAMES = {
  idle: "/mugi/idle.gif",
  walkLeft: "/mugi/run-left.gif",
  walkRight: "/mugi/run-right.gif",
  wave: "/mugi/waving.gif",
  jump: "/mugi/jumping.gif",
  heart: "/mugi/heart.gif",
  sleep: "/mugi/sleep.gif",
  coding: "/mugi/coding.gif",
  review: "/mugi/review.gif",
  waiting: "/mugi/waiting.gif",
  failed: "/mugi/failed.gif",
  lookA: "/mugi/look-a.gif",
  lookB: "/mugi/look-b.gif"
} as const;

type FrameKey = keyof typeof FRAMES;

type SpecialAction = {
  key: Exclude<FrameKey, "idle" | "walkLeft" | "walkRight">;
  weight: number;
  minMs: number;
  maxMs: number;
};

const SPECIAL_ACTIONS: SpecialAction[] = [
  { key: "wave", weight: 10, minMs: 1800, maxMs: 2800 },
  { key: "jump", weight: 10, minMs: 1600, maxMs: 3000 },
  { key: "heart", weight: 6, minMs: 2400, maxMs: 3600 },
  { key: "coding", weight: 5, minMs: 3200, maxMs: 5000 },
  { key: "review", weight: 5, minMs: 2600, maxMs: 4000 },
  { key: "waiting", weight: 6, minMs: 2400, maxMs: 3800 },
  { key: "failed", weight: 3, minMs: 1600, maxMs: 2400 },
  { key: "lookA", weight: 4, minMs: 2600, maxMs: 4200 },
  { key: "lookB", weight: 4, minMs: 2600, maxMs: 4200 },
  { key: "sleep", weight: 5, minMs: 6000, maxMs: 12000 }
];

const BUBBLE_LINES = [
  "喵～",
  "主人辛苦啦！",
  "今天也要加油喵！",
  "代码写完啦～",
  "要喝下午茶吗？☕",
  "看我看我～",
  "嘿嘿，被抓住啦～",
  "偷偷摸鱼中…"
];

const PET_WIDTH = 132;
const PET_HEIGHT = 132;
const WALK_SPEED_PX_PER_MS = 0.045;
const EDGE_PADDING = 8;
const TOP_PADDING = 64;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const pickSpecialAction = (): SpecialAction => {
  const total = SPECIAL_ACTIONS.reduce((sum, action) => sum + action.weight, 0);
  let roll = Math.random() * total;
  for (const action of SPECIAL_ACTIONS) {
    roll -= action.weight;
    if (roll <= 0) return action;
  }
  return SPECIAL_ACTIONS[0];
};

/**
 * Mugi 桌面宠物：在应用窗口内自动巡游移动的猫娘桌宠。
 * - 随机执行待机 / 左右踱步 / 挥手 / 跳跃 / 比心 / 敲代码 / 睡觉等动作
 * - 可拖动到任意位置；拖动后不会自动回位，只保留在窗口内
 * - 轻点触发随机动作并弹出小气泡台词
 * - 尊重系统「减少动效」设置：开启时保持呆立，不再自动巡游
 */
export function MugiPet() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: window.innerWidth - PET_WIDTH - 24, y: window.innerHeight - PET_HEIGHT - 110 });
  const dirRef = useRef(-1);
  const behaviorRef = useRef<"idle" | "walk" | "special">("idle");
  const stateUntilRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);
  const bubbleTimerRef = useRef(0);

  const [frame, setFrame] = useState<FrameKey>("idle");
  const [bubble, setBubble] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const applyPosition = () => {
    const root = rootRef.current;
    if (root) root.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
  };

  const clampPosition = () => {
    const maxX = Math.max(EDGE_PADDING, window.innerWidth - PET_WIDTH - EDGE_PADDING);
    const maxY = Math.max(TOP_PADDING, window.innerHeight - PET_HEIGHT - EDGE_PADDING);
    posRef.current.x = Math.min(Math.max(posRef.current.x, EDGE_PADDING), maxX);
    posRef.current.y = Math.min(Math.max(posRef.current.y, TOP_PADDING), maxY);
  };

  const scheduleNextState = () => {
    const now = Date.now();
    if (prefersReducedMotion()) {
      behaviorRef.current = "idle";
      setFrame("idle");
      stateUntilRef.current = now + 3000;
      return;
    }
    const roll = Math.random();
    if (roll < 0.42) {
      behaviorRef.current = "idle";
      setFrame("idle");
      stateUntilRef.current = now + rand(2600, 6500);
      return;
    }
    if (roll < 0.76) {
      behaviorRef.current = "walk";
      dirRef.current = Math.random() < 0.5 ? -1 : 1;
      setFrame(dirRef.current < 0 ? "walkLeft" : "walkRight");
      stateUntilRef.current = now + rand(2500, 5600);
      return;
    }
    const action = pickSpecialAction();
    behaviorRef.current = "special";
    setFrame(action.key);
    stateUntilRef.current = now + rand(action.minMs, action.maxMs);
  };

  const triggerInteraction = () => {
    if (prefersReducedMotion() && dragRef.current) return;
    const action = pickSpecialAction();
    behaviorRef.current = "special";
    setFrame(action.key);
    stateUntilRef.current = Date.now() + rand(1800, 3000);
    const line = BUBBLE_LINES[Math.floor(Math.random() * BUBBLE_LINES.length)];
    setBubble(line);
    window.clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = window.setTimeout(() => setBubble(null), 2600);
  };

  const tick = (ts: number) => {
    const dt = Math.min(64, ts - lastTsRef.current);
    lastTsRef.current = ts;
    if (!pausedRef.current && behaviorRef.current === "walk") {
      posRef.current.x += dirRef.current * WALK_SPEED_PX_PER_MS * dt;
      const minX = EDGE_PADDING;
      const maxX = window.innerWidth - PET_WIDTH - EDGE_PADDING;
      if (posRef.current.x <= minX) {
        posRef.current.x = minX;
        dirRef.current = 1;
        setFrame("walkRight");
      } else if (posRef.current.x >= maxX) {
        posRef.current.x = maxX;
        dirRef.current = -1;
        setFrame("walkLeft");
      }
      applyPosition();
    }
    if (Date.now() > stateUntilRef.current && dragRef.current === null) {
      scheduleNextState();
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    // 预先加载全部动作帧，避免切换时闪白。
    const seen = new Set<string>();
    for (const value of Object.values(FRAMES)) {
      if (!seen.has(value)) {
        seen.add(value);
        const image = new Image();
        image.src = value;
      }
    }
    clampPosition();
    applyPosition();
    scheduleNextState();
    lastTsRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(bubbleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: posRef.current.x,
      baseY: posRef.current.y,
      moved: false
    };
    pausedRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true;
    posRef.current.x = drag.baseX + deltaX;
    posRef.current.y = drag.baseY + deltaY;
    clampPosition();
    applyPosition();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    pausedRef.current = false;
    setDragging(false);
    if (!drag.moved) {
      triggerInteraction();
    } else {
      behaviorRef.current = "idle";
      setFrame("idle");
      stateUntilRef.current = Date.now() + 1200;
    }
    lastTsRef.current = performance.now();
  };

  return (
    <div
      ref={rootRef}
      className="mugi-pet-root"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 45,
        pointerEvents: "none",
        transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`
      }}
      aria-label="Mugi 桌宠"
    >
      <div className="flex flex-col items-center">
        {bubble ? (
          <div
            className="mugi-pet-bubble mb-1 max-w-[180px] rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] shadow-lg"
            role="status"
          >
            {bubble}
          </div>
        ) : null}
        <button
          type="button"
          className={`mugi-pet-body cursor-grab rounded-2xl transition-transform duration-200 ${dragging ? "cursor-grabbing scale-105" : "hover:scale-105"}`}
          style={{ pointerEvents: "auto", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="Mugi 桌宠：拖动移动，点击互动"
          aria-label="Mugi 桌宠（拖动移动，点击互动）"
        >
          <img src={FRAMES[frame]} alt="Mugi 桌宠动画" draggable={false} width={PET_WIDTH} height={PET_HEIGHT} className="h-auto w-[132px] select-none object-contain drop-shadow-md" />
        </button>
      </div>
    </div>
  );
}
