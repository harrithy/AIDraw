import { ChevronLeft, ChevronRight } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { WorkflowCanvas } from "./components/canvas/WorkflowCanvas";
import { CanvasToolbar } from "./components/layout/CanvasToolbar";
import { LeftSidebar } from "./components/layout/LeftSidebar";
import { ApiSettingsDialog } from "./components/modals/ApiSettingsDialog";
import { ImagePreview } from "./components/modals/ImagePreview";
import { OnboardingGuide } from "./components/modals/OnboardingGuide";
import { CreateJobPanel } from "./components/panels/CreateJobPanel";
import { Metric } from "./components/ui/Metric";
import { useAppAnimations } from "./hooks/useAppAnimations";
import { useCanvasInteractions } from "./hooks/useCanvasInteractions";
import { BOARD_PADDING, getJobCardSize, type PositionedJob } from "./lib/canvas";
import type {
  CreateJobPayload,
  DrawFolder,
  DrawJob,
  ImageProviderSettings,
  QueueStats,
  UpdateImageProviderSettingsPayload
} from "./types";

const emptyQueue: QueueStats = {
  maxConcurrent: 10,
  running: 0,
  pending: 0
};

const emptyProviderSettings: ImageProviderSettings = {
  baseUrl: "https://duomiapi.com",
  model: "gpt-image-2",
  hasApiKey: false,
  apiKeyMasked: ""
};

const ONBOARDING_STORAGE_KEY = "aidraw-onboarding-v1";

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
  const [previewJob, setPreviewJob] = useState<DrawJob | null>(null);
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "done");
  const [leftOpen, setLeftOpen] = useState(() => window.matchMedia?.("(min-width: 721px)").matches ?? true);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = window.localStorage.getItem("aidraw-theme");
    const prefersDark = saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    document.documentElement.classList.toggle("dark", prefersDark);
    return prefersDark;
  });

  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? null;
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const inFlightJobs = jobs.filter((job) => job.status === "pending" || job.status === "running").length;

  const {
    canvasDrag,
    cardDrag,
    getCardDisplayPos,
    lockedCardPositionRef,
    moveCanvasDrag,
    resetCanvas,
    startCanvasDrag,
    stopCanvasDrag,
    wheelCanvas,
    zoomCanvas
  } = useCanvasInteractions({
    activeFolder,
    jobs,
    setFolders,
    setJobs,
    setNotice
  });

  const positionedJobs = useMemo<PositionedJob[]>(
    () =>
      jobs.map((job, index) => {
        const pos = getCardDisplayPos(job, index);
        return { job, index, x: pos.x, y: pos.y, cardSize: getJobCardSize(job) };
      }),
    [getCardDisplayPos, jobs]
  );

  const boardSize = useMemo(() => {
    const maxX = Math.max(...positionedJobs.map((item) => item.x + item.cardSize.cardWidth), 960);
    const maxY = Math.max(...positionedJobs.map((item) => item.y + item.cardSize.cardHeight), 720);
    return {
      width: maxX + BOARD_PADDING,
      height: maxY + BOARD_PADDING
    };
  }, [positionedJobs]);
  const jobAnimationKey = useMemo(
    () => jobs.map((job) => `${job.id}:${job.status}:${job.outputImageUrl ?? ""}`).join("|"),
    [jobs]
  );

  useAppAnimations({
    appRef,
    jobs,
    jobAnimationKey,
    leftOpen,
    notice,
    previewJob
  });

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
      baseUrl: health.imageProvider.duomiBaseUrl,
      model: health.imageProvider.duomiModel,
      hasApiKey: health.imageProvider.hasDuomiKey,
      apiKeyMasked: health.imageProvider.apiKeyMasked
    });
  }, []);

  const loadProviderSettings = useCallback(async () => {
    const settings = await api.getImageProviderSettings();
    setProviderSettings(settings);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("aidraw-theme", darkMode ? "dark" : "light");
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (onboardingOpen) setLeftOpen(true);
  }, [onboardingOpen]);

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
      setNotice(settings.hasApiKey ? "API 设置已保存，绘图将使用多米API" : "API 设置已保存");
      await loadQueue();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "API 设置保存失败");
      throw error;
    }
  };

  const finishOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
    setOnboardingOpen(false);
  };

  return (
    <main ref={appRef} className={`app-shell ${darkMode ? "dark" : ""}`}>
      <WorkflowCanvas
        activeFolder={activeFolder}
        boardSize={boardSize}
        isDragging={Boolean(canvasDrag || cardDrag)}
        isLoading={isLoading}
        positionedJobs={positionedJobs}
        draggingJobId={cardDrag?.jobId ?? null}
        onPointerDown={startCanvasDrag}
        onPointerMove={moveCanvasDrag}
        onPointerUp={stopCanvasDrag}
        onPointerCancel={stopCanvasDrag}
        onWheel={wheelCanvas}
        onMoveJob={moveJob}
        onPreviewJob={setPreviewJob}
        onRetryJob={retryDrawing}
      />

      <header className="floating-top">
        <div className="metrics">
          <Metric label="运行" value={`${queue.running}/${queue.maxConcurrent}`} />
          <Metric label="等待" value={String(queue.pending)} />
          <Metric label="完成" value={String(completedJobs)} />
          <Metric label="处理中" value={String(inFlightJobs)} />
        </div>
      </header>

      <CanvasToolbar
        zoom={activeFolder?.canvasZoom ?? 1}
        darkMode={darkMode}
        onZoomOut={() => zoomCanvas(-0.1)}
        onZoomIn={() => zoomCanvas(0.1)}
        onResetCanvas={resetCanvas}
        onSortByTime={() => void sortJobs("time")}
        onSortByName={() => void sortJobs("name")}
        onOpenApiSettings={() => setApiSettingsOpen(true)}
        onOpenGuide={() => setOnboardingOpen(true)}
        onToggleTheme={() => setDarkMode((value) => !value)}
      />

      <button
        type="button"
        className={`dock-toggle left ${leftOpen ? "open" : ""}`}
        onClick={() => setLeftOpen((value) => !value)}
        title={leftOpen ? "隐藏左侧面板" : "显示左侧面板"}
      >
        {leftOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      <LeftSidebar
        isOpen={leftOpen}
        folders={folders}
        activeFolderId={activeFolderId}
        folderName={folderName}
        onFolderNameChange={setFolderName}
        onCreateFolder={createFolder}
        onSelectFolder={setActiveFolderId}
      />

      {activeFolder ? (
        <CreateJobPanel
          variant="composer"
          notice={notice}
          isSubmitting={isSubmitting}
          onSubmit={submitJobs}
          onUploadImage={api.uploadImage}
        />
      ) : (
        <div className="bottom-composer-empty panel-empty" data-tour="composer">先创建文件夹，再开始绘图任务。</div>
      )}

      <ApiSettingsDialog
        open={apiSettingsOpen}
        settings={providerSettings}
        onOpenChange={setApiSettingsOpen}
        onSave={saveProviderSettings}
      />

      <ImagePreview job={previewJob} onClose={() => setPreviewJob(null)} />

      <OnboardingGuide
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onFinish={finishOnboarding}
      />
    </main>
  );
}

export default App;
