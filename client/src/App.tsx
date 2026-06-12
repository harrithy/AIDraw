import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderPlus,
  ImageUp,
  KeyRound,
  Layers,
  Loader2,
  Maximize2,
  Moon,
  MoreHorizontal,
  MousePointer2,
  Palette,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Sun,
  Upload,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  PointerEvent,
  WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { api } from "./api";
import type {
  CreateJobPayload,
  DrawFolder,
  DrawJob,
  DrawMode,
  ImageProviderSettings,
  QueueStats,
  UpdateImageProviderSettingsPayload
} from "./types";

gsap.registerPlugin(useGSAP);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const statusLabel: Record<DrawJob["status"], string> = {
  pending: "等待中",
  running: "绘制中",
  completed: "已完成",
  failed: "失败"
};

const modeLabel: Record<DrawMode, string> = {
  "text-to-image": "文生图",
  "image-to-image": "图生图"
};

const statusIcon = (status: DrawJob["status"]) => {
  if (status === "running") return <Loader2 className="spin" size={16} />;
  if (status === "pending") return <Clock size={16} />;
  if (status === "failed") return <AlertCircle size={16} />;
  return <Sparkles size={16} />;
};

const emptyQueue: QueueStats = {
  maxConcurrent: 10,
  running: 0,
  pending: 0
};

const emptyProviderSettings: ImageProviderSettings = {
  baseUrl: "https://nowcoding.ai/v1",
  model: "gpt-image-2",
  hasApiKey: false,
  apiKeyMasked: ""
};

type DragState = {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
};

/**
 * 🐱 卡片自由拖拽状态
 * 记录主人正在拖动哪张卡片，以及拖动起始位置
 */
type CardDragState = {
  jobId: string;
  startX: number; // 鼠标按下时的 clientX
  startY: number; // 鼠标按下时的 clientY
  posX: number;   // 卡片初始画布坐标 X
  posY: number;   // 卡片初始画布坐标 Y
};

type ThinkingValue = "high" | "medium" | "low" | "standard";

const CARD_WIDTH = 280;
const CARD_HEIGHT = 356;
const CARD_GAP_Y = 96;
const DEFAULT_CARD_X = 318;
const DEFAULT_CARD_Y = 150;
const BOARD_PADDING = 240;

type PositionedJob = {
  job: DrawJob;
  index: number;
  x: number;
  y: number;
};

const getDefaultCardPosition = (index: number) => ({
  x: DEFAULT_CARD_X,
  y: DEFAULT_CARD_Y + index * (CARD_HEIGHT + CARD_GAP_Y)
});

const getConnectionPath = (from: PositionedJob, to: PositionedJob) => {
  const fromCenter = {
    x: from.x + CARD_WIDTH / 2,
    y: from.y + CARD_HEIGHT / 2
  };
  const toCenter = {
    x: to.x + CARD_WIDTH / 2,
    y: to.y + CARD_HEIGHT / 2
  };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    const towardRight = dx >= 0;
    const start = {
      x: from.x + (towardRight ? CARD_WIDTH : 0),
      y: fromCenter.y
    };
    const end = {
      x: to.x + (towardRight ? 0 : CARD_WIDTH),
      y: toCenter.y
    };
    const distance = Math.abs(end.x - start.x);
    const handle = Math.min(Math.max(32, distance * 0.46), Math.max(1, distance / 2));
    const startHandleX = start.x + (towardRight ? handle : -handle);
    const endHandleX = end.x - (towardRight ? handle : -handle);
    return `M ${start.x} ${start.y} C ${startHandleX} ${start.y}, ${endHandleX} ${end.y}, ${end.x} ${end.y}`;
  }

  const towardBottom = dy >= 0;
  const start = {
    x: fromCenter.x,
    y: from.y + (towardBottom ? CARD_HEIGHT : 0)
  };
  const end = {
    x: toCenter.x,
    y: to.y + (towardBottom ? 0 : CARD_HEIGHT)
  };
  const distance = Math.abs(end.y - start.y);
  const handle = Math.min(Math.max(32, distance * 0.46), Math.max(1, distance / 2));
  const startHandleY = start.y + (towardBottom ? handle : -handle);
  const endHandleY = end.y - (towardBottom ? handle : -handle);
  return `M ${start.x} ${start.y} C ${start.x} ${startHandleY}, ${end.x} ${endHandleY}, ${end.x} ${end.y}`;
};

function App() {
  const appRef = useRef<HTMLElement | null>(null);
  const [folders, setFolders] = useState<DrawFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DrawJob[]>([]);
  const [queue, setQueue] = useState<QueueStats>(emptyQueue);
  const [providerSettings, setProviderSettings] = useState<ImageProviderSettings>(emptyProviderSettings);
  const [folderName, setFolderName] = useState("");
  const [notice, setNotice] = useState("准备就绪");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canvasDrag, setCanvasDrag] = useState<DragState | null>(null);
  const [cardDrag, setCardDrag] = useState<CardDragState | null>(null);
  const [previewJob, setPreviewJob] = useState<DrawJob | null>(null);
  const [leftOpen, setLeftOpen] = useState(() => window.matchMedia?.("(min-width: 721px)").matches ?? true);
  const [rightOpen, setRightOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = window.localStorage.getItem("aidraw-theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const pendingCanvasRef = useRef({ panX: 0, panY: 0 });
  const pendingCardRef = useRef<{ jobId: string; posX: number; posY: number } | null>(null);
  const lockedCardPositionRef = useRef<{ jobId: string; posX: number; posY: number } | null>(null);
  const animatedJobIdsRef = useRef<Set<string>>(new Set());
  const animatedJobStatusRef = useRef<Map<string, DrawJob["status"]>>(new Map());

  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? null;
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const inFlightJobs = jobs.filter((job) => job.status === "pending" || job.status === "running").length;

  const getCardDisplayPos = useCallback(
    (job: DrawJob, index: number) => {
      if (job.hasCustomPosition && Number.isFinite(job.posX) && Number.isFinite(job.posY)) {
        return { x: job.posX, y: job.posY };
      }
      return getDefaultCardPosition(index);
    },
    []
  );

  const positionedJobs = useMemo<PositionedJob[]>(
    () =>
      jobs.map((job, index) => {
        const pos = getCardDisplayPos(job, index);
        return { job, index, x: pos.x, y: pos.y };
      }),
    [getCardDisplayPos, jobs]
  );

  const boardSize = useMemo(() => {
    const maxX = Math.max(...positionedJobs.map((item) => item.x + CARD_WIDTH), 960);
    const maxY = Math.max(...positionedJobs.map((item) => item.y + CARD_HEIGHT), 720);
    return {
      width: maxX + BOARD_PADDING,
      height: maxY + BOARD_PADDING
    };
  }, [positionedJobs]);
  const jobAnimationKey = useMemo(
    () => jobs.map((job) => `${job.id}:${job.status}:${job.outputImageUrl ?? ""}`).join("|"),
    [jobs]
  );

  const loadFolders = useCallback(async () => {
    const nextFolders = await api.listFolders();
    setFolders(nextFolders);
    setActiveFolderId((current) => current ?? nextFolders[0]?.id ?? null);
  }, []);

  const loadJobs = useCallback(async (folderId: string) => {
    const nextJobs = await api.listJobs(folderId);
    const lockedPosition = lockedCardPositionRef.current;
    setJobs(
      lockedPosition
        ? nextJobs.map((job) =>
            job.id === lockedPosition.jobId
              ? {
                  ...job,
                  posX: lockedPosition.posX,
                  posY: lockedPosition.posY,
                  hasCustomPosition: true
                }
              : job
          )
        : nextJobs
    );
  }, []);

  const loadQueue = useCallback(async () => {
    const health = await api.health();
    setQueue(health.queue);
    setProviderSettings({
      baseUrl: health.imageProvider.nowcodingBaseUrl,
      model: health.imageProvider.nowcodingModel,
      hasApiKey: health.imageProvider.hasNowcodingKey,
      apiKeyMasked: health.imageProvider.apiKeyMasked
    });
  }, []);

  const loadProviderSettings = useCallback(async () => {
    const settings = await api.getImageProviderSettings();
    setProviderSettings(settings);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("aidraw-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!previewJob) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewJob(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewJob]);

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true);
        await Promise.all([loadFolders(), loadQueue(), loadProviderSettings()]);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "加载失败");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadFolders, loadProviderSettings, loadQueue]);

  useEffect(() => {
    if (!activeFolderId) {
      lockedCardPositionRef.current = null;
      setJobs([]);
      return;
    }

    lockedCardPositionRef.current = null;
    void loadJobs(activeFolderId).catch((error) => {
      setNotice(error instanceof Error ? error.message : "任务加载失败");
    });
  }, [activeFolderId, loadJobs]);

  useEffect(() => {
    if (!activeFolderId) return;

    const timer = window.setInterval(() => {
      void Promise.all([loadJobs(activeFolderId), loadQueue()]).catch((error) => {
        setNotice(error instanceof Error ? error.message : "状态同步失败");
      });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [activeFolderId, loadJobs, loadQueue]);

  useEffect(() => {
    const shell = appRef.current;
    if (!shell) return;

    // 面板开合依赖 CSS transform，清掉历史动效留下的内联样式。
    const panels = Array.from(shell.querySelectorAll<HTMLElement>(".left-panel, .right-panel"));
    if (panels.length === 0) return;

    gsap.killTweensOf(panels);
    gsap.set(panels, { clearProps: "transform,opacity,visibility" });
  }, [leftOpen, rightOpen]);

  useGSAP(
    () => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

      const timeline = gsap.timeline({
        defaults: { duration: 0.56, ease: "power3.out" }
      });
      const animateIn = (selector: string, vars: gsap.TweenVars, position?: gsap.Position) => {
        const targets = gsap.utils.toArray<HTMLElement>(selector);
        if (targets.length > 0) {
          timeline.from(targets, vars, position);
        }
      };

      animateIn(".canvas-stage", { autoAlpha: 0, duration: 0.36, ease: "power1.out", clearProps: "opacity,visibility" });
      animateIn(".left-panel.open > *", { y: 10, autoAlpha: 0, stagger: 0.04, clearProps: "transform,opacity,visibility" }, "<0.08");
      animateIn(".right-panel.open > *", { y: 10, autoAlpha: 0, stagger: 0.04, clearProps: "transform,opacity,visibility" }, "<");
      animateIn(".floating-toolbar", { y: -12, autoAlpha: 0, clearProps: "transform,opacity,visibility" }, "<0.08");
      animateIn(".dock-toggle", { scale: 0.86, autoAlpha: 0, stagger: 0.05, clearProps: "transform,opacity,visibility" }, "<0.05");
      animateIn(".metric", { y: -10, autoAlpha: 0, stagger: 0.06, clearProps: "transform,opacity,visibility" }, "<0.04");
    },
    { scope: appRef }
  );

  useGSAP(
    () => {
      const shell = appRef.current;
      if (!shell) return;

      const knownJobIds = animatedJobIdsRef.current;
      const knownStatuses = animatedJobStatusRef.current;
      const nextJobIds = new Set(jobs.map((job) => job.id));
      const cardElements = Array.from(shell.querySelectorAll<HTMLElement>(".job-card"));
      const cardByJobId = new Map(cardElements.map((card) => [card.dataset.jobId, card]));
      const enteringCards: HTMLElement[] = [];
      const changedCards: HTMLElement[] = [];

      jobs.forEach((job) => {
        const card = cardByJobId.get(job.id);
        if (!card) return;

        if (!knownJobIds.has(job.id)) {
          enteringCards.push(card);
        } else if (knownStatuses.get(job.id) !== job.status) {
          changedCards.push(card);
        }

        knownJobIds.add(job.id);
        knownStatuses.set(job.id, job.status);
      });

      for (const jobId of Array.from(knownJobIds)) {
        if (!nextJobIds.has(jobId)) {
          knownJobIds.delete(jobId);
          knownStatuses.delete(jobId);
        }
      }

      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

      if (enteringCards.length > 0) {
        // 新任务卡片出现时，轻轻上浮进入画布。
        gsap.fromTo(
          enteringCards,
          { y: 24, scale: 0.97, autoAlpha: 0 },
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.5,
            ease: "back.out(1.45)",
            stagger: 0.07,
            clearProps: "transform,visibility"
          }
        );
      }

      if (changedCards.length > 0) {
        const changedImages = changedCards
          .map((card) => card.querySelector<HTMLElement>(".job-image"))
          .filter((element): element is HTMLElement => Boolean(element));

        gsap.fromTo(
          changedCards,
          { borderColor: "rgba(47, 118, 96, 0.52)" },
          {
            borderColor: "var(--line)",
            duration: 0.7,
            ease: "power2.out",
            clearProps: "borderColor"
          }
        );

        gsap.fromTo(
          changedImages,
          { scale: 0.985, filter: "brightness(1.12)" },
          {
            scale: 1,
            filter: "brightness(1)",
            duration: 0.7,
            ease: "power2.out",
            clearProps: "transform,filter"
          }
        );
      }
    },
    { dependencies: [jobAnimationKey], scope: appRef }
  );

  useGSAP(
    () => {
      if (!previewJob?.outputImageUrl || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

      gsap.fromTo(
        ".image-preview-backdrop",
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.18, ease: "power1.out" }
      );
      gsap.fromTo(
        ".image-preview-panel",
        { y: 18, scale: 0.97, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.34, ease: "power3.out" }
      );
    },
    { dependencies: [previewJob?.id], scope: appRef }
  );

  useGSAP(
    () => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

      gsap.fromTo(
        ".notice-line",
        { y: 6, autoAlpha: 0.72 },
        { y: 0, autoAlpha: 1, duration: 0.26, ease: "power2.out", clearProps: "transform,visibility" }
      );
    },
    { dependencies: [notice], scope: appRef }
  );

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;

    try {
      const folder = await api.createFolder(name);
      setFolders((current) => [folder, ...current]);
      setActiveFolderId(folder.id);
      setFolderName("");
      setNotice(`已创建文件夹：${folder.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建文件夹失败");
    }
  };

  const updateCanvas = useCallback(
    (patch: Partial<Pick<DrawFolder, "canvasZoom" | "canvasPanX" | "canvasPanY">>, persist = true) => {
      if (!activeFolder) return;
      const nextFolder = { ...activeFolder, ...patch };
      setFolders((current) =>
        current.map((folder) => (folder.id === activeFolder.id ? nextFolder : folder))
      );
      if (persist) {
        void api.updateFolder(activeFolder.id, patch).catch((error) => {
          setNotice(error instanceof Error ? error.message : "画布状态保存失败");
        });
      }
    },
    [activeFolder]
  );

  const zoomCanvas = (delta: number) => {
    if (!activeFolder) return;
    const canvasZoom = Math.min(1.8, Math.max(0.55, Number((activeFolder.canvasZoom + delta).toFixed(2))));
    updateCanvas({ canvasZoom });
  };

  const resetCanvas = () => {
    updateCanvas({ canvasZoom: 1, canvasPanX: 0, canvasPanY: 0 });
  };

  /**
   * 🐱 画布 Pointer Down 事件
   * - 点击空白区域 → 开始画布平移（pan）
   * - 点击卡片（非按钮） → 开始卡片自由拖拽
   * - 点击按钮/输入框等 → 不处理，让它们自己响应
   */
  const startCanvasDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!activeFolder || event.button !== 0) return;
    const target = event.target as HTMLElement | null;

    // 点击交互元素时不触发任何拖拽
    if (target?.closest("button, input, textarea, select, label, a")) return;

    // 检测是否点击了卡片 → 卡片自由拖拽
    const cardEl = target?.closest(".job-card") as HTMLElement | null;
    if (cardEl) {
      const jobId = cardEl.dataset.jobId;
      if (!jobId) return;
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      const displayPos = getCardDisplayPos(job, jobs.findIndex((j) => j.id === jobId));
      setCardDrag({
        jobId,
        startX: event.clientX,
        startY: event.clientY,
        posX: displayPos.x,
        posY: displayPos.y
      });
      pendingCardRef.current = { jobId, posX: displayPos.x, posY: displayPos.y };
      lockedCardPositionRef.current = { jobId, posX: displayPos.x, posY: displayPos.y };
      return;
    }

    // 否则 → 画布平移
    event.currentTarget.setPointerCapture(event.pointerId);
    pendingCanvasRef.current = {
      panX: activeFolder.canvasPanX,
      panY: activeFolder.canvasPanY
    };
    setCanvasDrag({
      startX: event.clientX,
      startY: event.clientY,
      panX: activeFolder.canvasPanX,
      panY: activeFolder.canvasPanY
    });
  };

  /**
   * 🐱 画布 Pointer Move 事件
   * - 卡片拖拽中：根据鼠标位移和缩放比例更新卡片画布坐标
   * - 画布平移中：更新画布 pan 偏移
   */
  const moveCanvasDrag = (event: PointerEvent<HTMLDivElement>) => {
    // 卡片自由拖拽
    if (cardDrag) {
      const zoom = activeFolder?.canvasZoom ?? 1;
      // 屏幕像素位移 ÷ 缩放 = 画布坐标位移
      const deltaX = (event.clientX - cardDrag.startX) / zoom;
      const deltaY = (event.clientY - cardDrag.startY) / zoom;
      const nextPosX = cardDrag.posX + deltaX;
      const nextPosY = cardDrag.posY + deltaY;
      pendingCardRef.current = {
        jobId: cardDrag.jobId,
        posX: nextPosX,
        posY: nextPosY
      };
      lockedCardPositionRef.current = {
        jobId: cardDrag.jobId,
        posX: nextPosX,
        posY: nextPosY
      };

      setJobs((current) =>
        current.map((j) =>
          j.id === cardDrag.jobId
            ? { ...j, posX: nextPosX, posY: nextPosY, hasCustomPosition: true }
            : j
        )
      );
      return;
    }

    // 画布平移
    if (!canvasDrag || !activeFolder) return;
    const nextPan = {
      canvasPanX: canvasDrag.panX + event.clientX - canvasDrag.startX,
      canvasPanY: canvasDrag.panY + event.clientY - canvasDrag.startY
    };
    pendingCanvasRef.current = {
      panX: nextPan.canvasPanX,
      panY: nextPan.canvasPanY
    };
    updateCanvas(nextPan, false);
  };

  /**
   * 🐱 画布 Pointer Up 事件
   * - 卡片拖拽结束：持久化保存卡片新位置到服务器
   * - 画布平移结束：持久化保存画布偏移
   */
  const stopCanvasDrag = (event: PointerEvent<HTMLDivElement>) => {
    // 卡片拖拽结束 → 保存位置
    if (cardDrag) {
      const nextPosition = pendingCardRef.current;
      if (nextPosition) {
        lockedCardPositionRef.current = nextPosition;
        void api
          .updateJobPosition(nextPosition.jobId, nextPosition.posX, nextPosition.posY)
          .then((updatedJob) => {
            setJobs((current) => current.map((job) => (job.id === updatedJob.id ? updatedJob : job)));
          })
          .catch((error) => {
            setNotice(error instanceof Error ? error.message : "位置保存失败");
          })
          .finally(() => {
            if (lockedCardPositionRef.current?.jobId === nextPosition.jobId) {
              lockedCardPositionRef.current = null;
            }
          });
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setCardDrag(null);
      pendingCardRef.current = null;
      return;
    }

    // 画布平移结束
    if (!activeFolder || !canvasDrag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setCanvasDrag(null);
    void api
      .updateFolder(activeFolder.id, {
        canvasPanX: pendingCanvasRef.current.panX,
        canvasPanY: pendingCanvasRef.current.panY
      })
      .catch((error) => {
        setNotice(error instanceof Error ? error.message : "画布状态保存失败");
      });
  };

  const wheelCanvas = (event: WheelEvent<HTMLDivElement>) => {
    if (!activeFolder) return;
    event.preventDefault();
    zoomCanvas(event.deltaY > 0 ? -0.08 : 0.08);
  };

  const sortJobs = async (mode: "time" | "name") => {
    if (!activeFolder) return;
    const ordered = [...jobs].sort((a, b) => {
      if (mode === "time") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return a.prompt.localeCompare(b.prompt, "zh-CN");
    });
    await persistOrder(ordered);
    setNotice(mode === "time" ? "已按生成时间排序" : "已按提示词排序");
  };

  const persistOrder = async (orderedJobs: DrawJob[]) => {
    if (!activeFolder) return;
    setJobs(orderedJobs.map((job, index) => ({ ...job, orderIndex: index })));
    try {
      const nextJobs = await api.reorderJobs(
        activeFolder.id,
        orderedJobs.map((job) => job.id)
      );
      setJobs(nextJobs);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "排序保存失败");
      void loadJobs(activeFolder.id);
    }
  };

  const moveJob = async (jobId: string, direction: -1 | 1) => {
    const index = jobs.findIndex((job) => job.id === jobId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= jobs.length) return;

    const ordered = [...jobs];
    const [job] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, job);
    await persistOrder(ordered);
  };

  const submitJobs = async (payload: CreateJobPayload) => {
    if (!activeFolder) return;
    try {
      setIsSubmitting(true);
      const created = await api.createJobs(activeFolder.id, payload);
      setJobs((current) => [...current, ...created].sort((a, b) => a.orderIndex - b.orderIndex));
      await loadQueue();
      setNotice(`已加入 ${created.length} 个绘图任务`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "任务创建失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryDrawing = async (jobId: string) => {
    if (!activeFolder) return;
    try {
      const retried = await api.retryJob(jobId);
      setJobs((current) => current.map((job) => (job.id === retried.id ? retried : job)));
      await loadQueue();
      setNotice("已重新加入绘制队列");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "重新绘制失败");
    }
  };

  const saveProviderSettings = async (payload: UpdateImageProviderSettingsPayload) => {
    try {
      const settings = await api.updateImageProviderSettings(payload);
      setProviderSettings(settings);
      setNotice(settings.hasApiKey ? "API 设置已保存，文生图将使用 Nowcoding" : "API 设置已保存");
      await loadQueue();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "API 设置保存失败");
      throw error;
    }
  };

  return (
    <main ref={appRef} className={`app-shell ${darkMode ? "dark" : ""}`}>
      <section className="canvas-layer">
        <div
          className={`canvas-stage ${canvasDrag || cardDrag ? "dragging" : ""}`}
          onPointerDown={startCanvasDrag}
          onPointerMove={moveCanvasDrag}
          onPointerUp={stopCanvasDrag}
          onPointerCancel={stopCanvasDrag}
          onWheel={wheelCanvas}
        >
          {jobs.length === 0 ? (
            <EmptyCanvas isLoading={isLoading} />
          ) : (
            <div
              className="canvas-board"
              style={{
                width: `${boardSize.width}px`,
                height: `${boardSize.height}px`,
                transform: `translate(${activeFolder?.canvasPanX ?? 0}px, ${
                  activeFolder?.canvasPanY ?? 0
                }px) scale(${activeFolder?.canvasZoom ?? 1})`
              }}
            >
              <WorkflowLinks positionedJobs={positionedJobs} />
              {positionedJobs.map(({ job, index, x, y }) => {
                const isDragging = cardDrag?.jobId === job.id;
                return (
                  <JobCard
                    key={job.id}
                    job={job}
                    index={index}
                    total={jobs.length}
                    posX={x}
                    posY={y}
                    isDragging={isDragging}
                    onMove={moveJob}
                    onPreview={setPreviewJob}
                    onRetry={retryDrawing}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      <header className="floating-top">
        <div className="metrics">
          <Metric label="运行" value={`${queue.running}/${queue.maxConcurrent}`} />
          <Metric label="等待" value={String(queue.pending)} />
          <Metric label="完成" value={String(completedJobs)} />
          <Metric label="处理中" value={String(inFlightJobs)} />
        </div>
      </header>

      <div className="canvas-toolbar floating-toolbar">
        <div className="tool-group">
          <button type="button" onClick={() => zoomCanvas(-0.1)} title="缩小">
            <ZoomOut size={17} />
          </button>
          <span>{Math.round((activeFolder?.canvasZoom ?? 1) * 100)}%</span>
          <button type="button" onClick={() => zoomCanvas(0.1)} title="放大">
            <ZoomIn size={17} />
          </button>
          <button type="button" onClick={resetCanvas} title="重置画布">
            <Maximize2 size={17} />
          </button>
        </div>
        <div className="tool-group">
          <button type="button" onClick={() => void sortJobs("time")} title="按生成时间排序">
            <Clock size={17} />
          </button>
          <button type="button" onClick={() => void sortJobs("name")} title="按提示词排序">
            <RefreshCw size={17} />
          </button>
          <button type="button" onClick={() => setDarkMode((value) => !value)} title="切换暗黑模式">
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`dock-toggle left ${leftOpen ? "open" : ""}`}
        onClick={() => setLeftOpen((value) => !value)}
        title={leftOpen ? "隐藏左侧面板" : "显示左侧面板"}
      >
        {leftOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      <button
        type="button"
        className={`dock-toggle right ${rightOpen ? "open" : ""}`}
        onClick={() => setRightOpen((value) => !value)}
        title={rightOpen ? "隐藏右侧面板" : "显示右侧面板"}
      >
        {rightOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <aside className={`floating-panel left-panel ${leftOpen ? "open" : "closed"}`}>
        <div className="brand">
          <div className="brand-mark">
            <Palette size={24} />
          </div>
          <div>
            <p>AIDraw</p>
            <span>AI 绘图工作流</span>
          </div>
        </div>

        <form className="folder-form" onSubmit={createFolder}>
          <input
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="新文件夹名称"
          />
          <button type="submit" title="创建文件夹">
            <FolderPlus size={18} />
          </button>
        </form>

        <div className="folder-list">
          {folders.map((folder) => (
            <button
              type="button"
              key={folder.id}
              className={`folder-item ${folder.id === activeFolderId ? "active" : ""}`}
              onClick={() => setActiveFolderId(folder.id)}
            >
              <Layers size={17} />
              <span>{folder.name}</span>
              <small>{formatDate(folder.createdAt)}</small>
            </button>
          ))}
        </div>
      </aside>

      <aside className={`floating-panel right-panel ${rightOpen ? "open" : "closed"}`}>
        {activeFolder ? (
          <CreateJobPanel isSubmitting={isSubmitting} onSubmit={submitJobs} />
        ) : (
          <div className="panel-empty">
            <Plus size={28} />
            <p>先创建文件夹，再开始绘图任务。</p>
          </div>
        )}

        <ApiSettingsPanel settings={providerSettings} onSave={saveProviderSettings} />

        <div className="notice-line">
          <MousePointer2 size={16} />
          <span>{notice}</span>
        </div>
      </aside>

      <ImagePreview job={previewJob} onClose={() => setPreviewJob(null)} />
    </main>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EmptyCanvas({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="empty-canvas">
      {isLoading ? <Loader2 className="spin" size={28} /> : <WandSparkles size={30} />}
      <h2>{isLoading ? "正在加载画布" : "画布还没有图片"}</h2>
      <p>从右侧选择文生图或图生图，生成结果会按照当前文件夹集中展示。</p>
    </div>
  );
}

function WorkflowLinks({ positionedJobs }: { positionedJobs: PositionedJob[] }) {
  if (positionedJobs.length < 2) return null;

  return (
    <svg className="workflow-links" aria-hidden="true" focusable="false">
      <defs>
        <marker
          id="workflow-arrow"
          markerWidth="13"
          markerHeight="13"
          refX="11"
          refY="6.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 1 1 L 12 6.5 L 1 12 z" />
        </marker>
      </defs>
      {positionedJobs.slice(0, -1).map((item, index) => {
        const next = positionedJobs[index + 1];
        return (
          <path
            key={`${item.job.id}-${next.job.id}`}
            className="workflow-link"
            d={getConnectionPath(item, next)}
            markerEnd="url(#workflow-arrow)"
          />
        );
      })}
    </svg>
  );
}

type JobCardProps = {
  job: DrawJob;
  index: number;
  total: number;
  /** 🐱 卡片在画布上的 X 坐标 */
  posX: number;
  /** 🐱 卡片在画布上的 Y 坐标 */
  posY: number;
  /** 🐱 当前是否正在被拖拽 */
  isDragging: boolean;
  onMove: (jobId: string, direction: -1 | 1) => void;
  onPreview: (job: DrawJob) => void;
  onRetry: (jobId: string) => void;
};

/**
 * 🐱 单个绘图任务卡片
 * 使用绝对定位放在画布上，主人可以随意拖动喵~
 */
function JobCard({
  job,
  index,
  total,
  posX,
  posY,
  isDragging,
  onMove,
  onPreview,
  onRetry
}: JobCardProps) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const canRetry = job.status === "completed" || job.status === "failed";
  const sizeLabel = job.width && job.height ? `${job.width}x${job.height}` : "auto";

  return (
    <article
      className={`job-card status-${job.status}${toolsOpen ? " tools-open" : ""}${isDragging ? " card-dragging" : ""}`}
      data-job-id={job.id}
      style={{
        left: `${posX}px`,
        top: `${posY}px`
      }}
    >
      <div className="job-card-header">
        <h3>{job.prompt}</h3>

        <div className="job-actions">
          <button
            type="button"
            className="job-tools-toggle"
            onClick={() => setToolsOpen((value) => !value)}
            aria-expanded={toolsOpen}
            title={toolsOpen ? "收起工具栏" : "展开工具栏"}
          >
            <MoreHorizontal size={15} />
          </button>
          {toolsOpen ? (
            <>
              <button type="button" onClick={() => onMove(job.id, -1)} disabled={index === 0} title="上移">
                <ArrowUp size={15} />
              </button>
              <button type="button" onClick={() => onMove(job.id, 1)} disabled={index === total - 1} title="下移">
                <ArrowDown size={15} />
              </button>
              {canRetry ? (
                <button type="button" onClick={() => onRetry(job.id)} title="重新绘制">
                  <RotateCcw size={15} />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className={`job-image ${job.outputImageUrl ? "has-output" : ""}`}>
        {job.outputImageUrl ? (
          <button type="button" className="job-image-button" onClick={() => onPreview(job)} title="放大预览">
            <img src={job.outputImageUrl} alt={job.prompt} />
          </button>
        ) : (
          <div className="job-placeholder">
            {statusIcon(job.status)}
            <span>{statusLabel[job.status]}</span>
          </div>
        )}
      </div>

      <div className="job-body">
        <div className="job-meta-line" aria-label="任务参数">
          <span className="job-meta-item">
            <em>时间</em>
            <strong>{formatDate(job.createdAt)}</strong>
          </span>
          <span className="job-meta-item">
            <em>Thinking</em>
            <strong>{job.thinking || "high"}</strong>
          </span>
          <span className="job-meta-item">
            <em>尺寸</em>
            <strong>{sizeLabel}</strong>
          </span>
        </div>
        {job.errorMessage ? <small className="error-text">{job.errorMessage}</small> : null}
      </div>
    </article>
  );
}

function ImagePreview({ job, onClose }: { job: DrawJob | null; onClose: () => void }) {
  if (!job?.outputImageUrl) return null;

  return (
    <div className="image-preview-backdrop" role="dialog" aria-modal="true" aria-label="图片预览" onClick={onClose}>
      <div className="image-preview-panel" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="image-preview-close" onClick={onClose} title="关闭预览">
          <X size={18} />
        </button>
        <img src={job.outputImageUrl} alt={job.prompt} />
        <div className="image-preview-caption">
          <strong>{job.prompt}</strong>
          <span>{formatDate(job.createdAt)} · thinking {job.thinking || "high"} · {job.width}x{job.height}</span>
        </div>
      </div>
    </div>
  );
}

type CreateJobPanelProps = {
  isSubmitting: boolean;
  onSubmit: (payload: CreateJobPayload) => Promise<void>;
};

function CreateJobPanel({ isSubmitting, onSubmit }: CreateJobPanelProps) {
  const [mode, setMode] = useState<DrawMode>("text-to-image");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [thinking, setThinking] = useState<ThinkingValue>("high");
  const [strength, setStrength] = useState(0.55);
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [uploadedName, setUploadedName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadError("");
      const uploaded = await api.uploadImage(file);
      setInputImageUrl(uploaded.url);
      setUploadedName(uploaded.originalName);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败");
      setInputImageUrl("");
      setUploadedName("");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      setUploadError("请先填写提示词");
      return;
    }
    if (mode === "image-to-image" && !inputImageUrl) {
      setUploadError("图生图需要先上传原图");
      return;
    }

    setUploadError("");
    await onSubmit({
      mode,
      prompt: nextPrompt,
      inputImageUrl: mode === "image-to-image" ? inputImageUrl : undefined,
      width: 1024,
      height: 1024,
      count,
      strength: mode === "image-to-image" ? strength : undefined,
      thinking,
      model: "gpt-image-2"
    });
  };

  return (
    <form className="create-panel" onSubmit={submit}>
      <div className="panel-title">
        <div>
          <p className="eyebrow">绘图任务</p>
          <h2>创建绘制</h2>
        </div>
        <Play size={24} />
      </div>

      <div className="mode-switch" role="tablist" aria-label="绘图模式">
        <button
          type="button"
          className={mode === "text-to-image" ? "selected" : ""}
          onClick={() => setMode("text-to-image")}
        >
          文生图
        </button>
        <button
          type="button"
          className={mode === "image-to-image" ? "selected" : ""}
          onClick={() => setMode("image-to-image")}
        >
          图生图
        </button>
      </div>

      {mode === "image-to-image" ? (
        <label className="upload-box">
          <input type="file" accept="image/*" onChange={uploadImage} />
          {isUploading ? <Loader2 className="spin" size={22} /> : <Upload size={22} />}
          <span>{uploadedName || "上传原图"}</span>
        </label>
      ) : null}

      <label>
        提示词
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="描述你想生成的画面"
        />
      </label>

      <div className="form-grid">
        <label>
          数量
          <input
            type="number"
            min={1}
            max={8}
            value={count}
            onChange={(event) => setCount(Math.min(8, Math.max(1, Number(event.target.value) || 1)))}
          />
        </label>
        <label>
          Size
          <input value="auto" readOnly />
        </label>
      </div>

      <div className="form-grid">
        <label>
          Thinking
          <select value={thinking} onChange={(event) => setThinking(event.target.value as ThinkingValue)}>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
            <option value="standard">standard</option>
          </select>
        </label>
        {mode === "image-to-image" ? (
          <label>
            强度
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={strength}
              onChange={(event) => setStrength(Math.min(1, Math.max(0.1, Number(event.target.value) || 0.55)))}
            />
          </label>
        ) : (
          <label>
            模型
            <input value="gpt-image-2" readOnly />
          </label>
        )}
      </div>

      {uploadError ? <small className="error-text">{uploadError}</small> : null}

      <button className="submit-button" type="submit" disabled={isSubmitting || isUploading}>
        {isSubmitting ? <Loader2 className="spin" size={18} /> : <ImageUp size={18} />}
        {isSubmitting ? "加入中" : "加入绘制队列"}
      </button>
    </form>
  );
}

type ApiSettingsPanelProps = {
  settings: ImageProviderSettings;
  onSave: (payload: UpdateImageProviderSettingsPayload) => Promise<void>;
};

function ApiSettingsPanel({ settings, onSave }: ApiSettingsPanelProps) {
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

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const payload: UpdateImageProviderSettingsPayload = {
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      clearApiKey
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
    <form className="settings-panel" onSubmit={save}>
      <div className="panel-title compact">
        <div>
          <p className="eyebrow">接口设置</p>
          <h2>Nowcoding</h2>
        </div>
        <Settings size={22} />
      </div>

      <div className={`provider-badge ${settings.hasApiKey ? "ready" : ""}`}>
        {settings.hasApiKey ? <CheckCircle2 size={17} /> : <KeyRound size={17} />}
        <span>{settings.hasApiKey ? "已保存 API Key" : "未配置 API Key"}</span>
        {settings.apiKeyMasked ? <small>{settings.apiKeyMasked}</small> : null}
      </div>

      <label>
        Base URL
        <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://nowcoding.ai/v1" />
      </label>

      <label>
        Model
        <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-image-2" />
      </label>

      <label>
        API Key
        <input
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            if (event.target.value) setClearApiKey(false);
          }}
          placeholder={settings.hasApiKey ? "留空则保留已保存 Key" : "输入 API Key"}
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

export default App;
