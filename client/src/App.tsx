import { ChevronLeft, ChevronRight } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { WorkflowCanvas } from "./components/canvas/WorkflowCanvas";
import { CanvasToolbar } from "./components/layout/CanvasToolbar";
import { LeftSidebar } from "./components/layout/LeftSidebar";
import { ApiSettingsDialog } from "./components/modals/ApiSettingsDialog";
import { ImagePreview } from "./components/modals/ImagePreview";
import { OnboardingGuide } from "./components/modals/OnboardingGuide";
import { RegenerateEditDialog, type RegenerateEdits } from "./components/modals/RegenerateEditDialog";
import { ReleaseNotesDialog } from "./components/modals/ReleaseNotesDialog";
import { getUnreadReleasesCount } from "./lib/changelog";
import { CreateJobPanel } from "./components/panels/CreateJobPanel";
import { UploadedImageLibrary } from "./components/panels/UploadedImageLibrary";
import { Metric } from "./components/ui/Metric";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "./components/ui/dialog";
import { Message } from "./components/ui/message";
import { useAppAnimations } from "./hooks/useAppAnimations";
import { useCanvasInteractions } from "./hooks/useCanvasInteractions";
import { BOARD_PADDING, calculateLayoutPositions, getPositionedJobs, type LayoutDirection, type PositionedJob } from "./lib/canvas";
import { getJobOutputImages } from "./lib/jobImages";
import type {
  CreateJobPayload,
  DrawFolder,
  DrawJob,
  ImageProviderSettings,
  QueueStats,
  UploadedImage,
  UpdateImageProviderSettingsPayload
} from "./types";

const emptyQueue: QueueStats = {
  maxConcurrent: 30,
  running: 0,
  pending: 0
};

const emptyProviderSettings: ImageProviderSettings = {
  baseUrl: "https://duomiapi.com",
  model: "gpt-image-2",
  hasApiKey: false,
  apiKeyMasked: "",
  savedApiKeysMasked: [],
  providerId: "duomi",
  savedApiKeyProviderIds: [],
  activeApiKeyIndex: -1
};

const ONBOARDING_STORAGE_KEY = "aidraw-onboarding-v1";

/** 获取任务最近一次生成结果的时间，用于判断哪个结果盒子最新。 */
const getLatestOutputTime = (job: DrawJob) => {
  const timestamp = Date.parse(job.completedAt ?? job.updatedAt ?? job.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

/** 轮询结果没有实际变化时复用原数组，避免无意义的全画布渲染。 */
const areJobSnapshotsEqual = (current: DrawJob[], next: DrawJob[]) =>
  current.length === next.length &&
  current.every(
    (job, index) =>
      job.id === next[index]?.id &&
      job.updatedAt === next[index]?.updatedAt &&
      job.posX === next[index]?.posX &&
      job.posY === next[index]?.posY &&
      job.hasCustomPosition === next[index]?.hasCustomPosition
  );

/**
 * 应用根组件
 *
 * 管理应用的全局状态：
 * - 文件夹 CRUD（创建/重命名/删除/选择）
 * - 任务列表的加载、定时轮询
 * - 任务创建、重试、排序、拖拽
 * - 画布交互（缩放/平移/卡片拖拽）
 * - API 配置管理
 * - 深色模式切换
 * - 新手引导流程
 *
 * 子组件通过 props 接收数据和回调，保持单向数据流
 */
function App() {
  const appRef = useRef<HTMLElement | null>(null);
  const [folders, setFolders] = useState<DrawFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DrawJob[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isImageLibraryLoading, setIsImageLibraryLoading] = useState(false);
  const [queue, setQueue] = useState<QueueStats>(emptyQueue);
  const [providerSettings, setProviderSettings] = useState<ImageProviderSettings>(emptyProviderSettings);
  const [folderName, setFolderName] = useState("");
  const [notice, setNotice] = useState("准备就绪");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewJob, setPreviewJob] = useState<DrawJob | null>(null);
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false);
  // 新手引导：检查 localStorage，已完成则跳过
  const [onboardingOpen, setOnboardingOpen] = useState(() => window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "done");
  // 版本更新公告：自动检查未读数量并在部署更新后自动弹窗提醒
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(() => getUnreadReleasesCount());
  // 左侧面板：宽屏默认展开，窄屏默认收起
  const [leftOpen, setLeftOpen] = useState(() => window.matchMedia?.("(min-width: 721px)").matches ?? true);
  // 深色模式：优先读 localStorage，默认深色
  const [darkMode, setDarkMode] = useState(() => {
    const saved = window.localStorage.getItem("aidraw-theme");
    const prefersDark = saved ? saved === "dark" : true;
    document.documentElement.classList.toggle("dark", prefersDark);
    return prefersDark;
  });
  const [imageToUse, setImageToUse] = useState<string | null>(null);
  const [editingRetryJob, setEditingRetryJob] = useState<DrawJob | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearFailedConfirm, setShowClearFailedConfirm] = useState(false);
  const [isClearingFailed, setIsClearingFailed] = useState(false);

  // 页面加载或新手引导结束后，若存在未读版本更新，自动弹出更新公告
  useEffect(() => {
    if (!onboardingOpen && unreadAnnouncementsCount > 0) {
      const timer = window.setTimeout(() => {
        setAnnouncementOpen(true);
      }, 400);
      return () => window.clearTimeout(timer);
    }
  }, [onboardingOpen]);

  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? null;
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const inFlightJobs = jobs.filter((job) => job.status === "pending" || job.status === "running").length;
  const failedJobsCount = useMemo(() => jobs.filter((job) => job.status === "failed").length, [jobs]);

  const {
    canvasDrag,
    cardDrag,
    focusCanvasOnJob,
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
    () => getPositionedJobs(jobs),
    [jobs]
  );

  /** 当前文件夹中最近完成、且确实包含图片或视频结果的任务卡片。 */
  const latestOutputJob = useMemo(
    () =>
      positionedJobs.reduce<PositionedJob | null>((latest, current) => {
        if (
          current.job.folderId !== activeFolderId ||
          getJobOutputImages(current.job).length === 0
        ) {
          return latest;
        }
        if (!latest) return current;
        return getLatestOutputTime(current.job) >= getLatestOutputTime(latest.job) ? current : latest;
      }, null),
    [activeFolderId, positionedJobs]
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
    () => jobs.map((job) => `${job.id}:${job.status}:${job.outputImageUrl ?? ""}:${job.outputAssets?.length ?? 0}:${job.outputText ?? ""}`).join("|"),
    [jobs]
  );

  useAppAnimations({
    appRef,
    jobs,
    jobAnimationKey,
    leftOpen,
    notice
  });

  const loadFolders = useCallback(async () => {
    const nextFolders = await api.listFolders();
    setFolders(nextFolders);
    setActiveFolderId((current) =>
      current && nextFolders.some((folder) => folder.id === current)
        ? current
        : nextFolders[0]?.id ?? null
    );
    return nextFolders;
  }, []);

  /**
   * 加载指定文件夹内的所有绘图任务。
   * 包含防锁冲突处理：如果在拖拽任务卡片期间，轮询到了新数据，则不更新 React 状态，避免卡片抖动和位置冲突。
   */
  const loadJobs = useCallback(async (folderId: string) => {
    const nextJobs = await api.listJobs(folderId);

    // 拖拽期间卡片由 DOM translate 临时移动。此时替换 jobs 会让 React 的 left/top
    // 与 translate 同时包含拖拽位移，造成长按超过轮询周期后位置被重复计算。
    if (lockedCardPositionRef.current) return;

    setJobs((current) => (areJobSnapshotsEqual(current, nextJobs) ? current : nextJobs));
  }, []);

  /**
   * 加载当前文件夹下用户已上传的参考图列表。
   */
  const loadUploadedImages = useCallback(async (folderId: string) => {
    const nextImages = await api.listUploadedImages(folderId);
    setUploadedImages(nextImages);
  }, []);

  /**
   * 轮询或刷新当前系统的后台队列并发状况，以及当前的 API 提供商配置信息。
   */
  const loadQueue = useCallback(async () => {
    const health = await api.health();
    setQueue(health.queue);
    setProviderSettings({
      baseUrl: health.imageProvider.baseUrl,
      model: health.imageProvider.model,
      hasApiKey: health.imageProvider.hasApiKey,
      apiKeyMasked: health.imageProvider.apiKeyMasked,
      savedApiKeysMasked: health.imageProvider.savedApiKeysMasked,
      providerId: health.imageProvider.providerId,
      savedApiKeyProviderIds: health.imageProvider.savedApiKeyProviderIds,
      activeApiKeyIndex: health.imageProvider.activeApiKeyIndex
    });
  }, []);

  /**
   * 从数据库加载已保存的 API 提供商配置。
   */
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
    setPreviewJob((current) => {
      if (!current) return current;
      const latestJob = jobs.find((job) => job.id === current.id);
      return latestJob && latestJob.updatedAt !== current.updatedAt ? latestJob : current;
    });
  }, [jobs]);

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
      setUploadedImages([]);
      setIsImageLibraryLoading(false);
      return;
    }

    lockedCardPositionRef.current = null;
    setUploadedImages([]);
    setIsImageLibraryLoading(true);
    void Promise.all([loadJobs(activeFolderId), loadUploadedImages(activeFolderId)])
      .catch((error) => {
        setNotice(error instanceof Error ? error.message : "文件夹数据加载失败");
      })
      .finally(() => setIsImageLibraryLoading(false));
  }, [activeFolderId, loadJobs, loadUploadedImages]);

  // 定期轮询：每 2.5 秒同步任务状态和队列信息
  useEffect(() => {
    if (!activeFolderId) return;

    const timer = window.setInterval(() => {
      void Promise.all([loadJobs(activeFolderId), loadQueue()]).catch((error) => {
        setNotice(error instanceof Error ? error.message : "状态同步失败");
      });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [activeFolderId, loadJobs, loadQueue]);

  // 监听跨标签页状态变更，即时刷新本地界面
  useEffect(() => {
    const handleStateUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      void (async () => {
        try {
          const nextFolders = await loadFolders();
          const activeFolderStillExists = Boolean(
            activeFolderId && nextFolders.some((folder) => folder.id === activeFolderId)
          );
          if (activeFolderStillExists && (detail?.folderId === activeFolderId || !detail?.folderId)) {
            await Promise.all([loadJobs(activeFolderId!), loadUploadedImages(activeFolderId!)]);
          }
          await loadQueue();
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "状态同步失败");
        }
      })();
    };

    window.addEventListener("aidraw-state-update", handleStateUpdate);
    return () => window.removeEventListener("aidraw-state-update", handleStateUpdate);
  }, [activeFolderId, loadFolders, loadJobs, loadQueue, loadUploadedImages]);

  /**
   * 创建文件夹并自动选中
   */
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

  /**
   * 重命名文件夹
   * @param folderId - 文件夹 ID
   * @param newName - 新名称
   */
  const renameFolder = async (folderId: string, newName: string) => {
    try {
      const updated = await api.updateFolder(folderId, { name: newName });
      setFolders((current) => current.map((f) => (f.id === folderId ? updated : f)));
      setNotice(`已重命名文件夹：${updated.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "重命名失败");
    }
  };

  /**
   * 删除文件夹（如果当前正选中该文件夹则清空选中）
   * @param folderId - 文件夹 ID
   */
  const deleteFolder = async (folderId: string) => {
    try {
      await api.deleteFolder(folderId);
      setFolders((current) => current.filter((f) => f.id !== folderId));
      if (activeFolderId === folderId) {
        setActiveFolderId(null);
      }
      setNotice("文件夹已删除");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "删除失败");
    }
  };

  /**
   * 排序任务 — 按时间或按提示词（中文拼音排序）
   * @param mode - "time" 按创建时间，"name" 按提示词
   */
  const sortJobs = async (mode: "time" | "name") => {
    if (!activeFolder) return;
    const ordered = [...jobs].sort((a, b) => {
      if (mode === "time") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return a.prompt.localeCompare(b.prompt, "zh-CN");
    });
    await persistOrder(ordered);
    setNotice(mode === "time" ? "已按生成时间排序" : "已按提示词排序");
  };

  /** 将画布定位到当前文件夹最近生成出结果的图片或视频盒子。 */
  const jumpToLatestOutput = () => {
    if (!latestOutputJob) {
      setNotice("当前文件夹还没有已生成的图片或视频");
      return;
    }
    focusCanvasOnJob(latestOutputJob);
    setNotice("已跳转到最新生成盒子");
  };

  /**
   * 持久化任务顺序到服务器
   * 乐观更新本地 state -> 发请求保存 -> 失败时回滚
   * @param orderedJobs - 按新顺序排列的任务列表
   */
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

  /**
   * 上下移动任务（改变 orderIndex）
   * @param jobId - 任务 ID
   * @param direction - -1 上移，1 下移
   */
  const moveJob = async (jobId: string, direction: -1 | 1) => {
    const index = jobs.findIndex((job) => job.id === jobId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= jobs.length) return;

    const ordered = [...jobs];
    const [job] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, job);
    await persistOrder(ordered);
  };

  /**
   * 删除指定的任务盒子
   * @param jobId - 任务 ID
   */
  const deleteJob = async (jobId: string) => {
    try {
      await api.deleteJob(jobId);
      setJobs((current) => current.filter((j) => j.id !== jobId));
      setPreviewJob((current) => (current?.id === jobId ? null : current));
      setNotice("盒子已删除");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "删除盒子失败");
    }
  };

  /**
   * 提交绘图任务
   * 创建任务后自动刷新队列状态
   * @param payload - 任务创建参数
   */
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

  /**
   * 上传本地参考图片到图床并记录到当前文件夹中。
   * @param file - 本地图片文件
   */
  const uploadImage = async (file: File) => {
    if (!activeFolderId) throw new Error("请先选择文件夹");
    return api.uploadImage(activeFolderId, file);
  };

  /** 将任务的最新图片或视频上传到图床，并同步到当前文件夹的素材库。 */
  const uploadLatestJobMedia = async (jobId: string) => {
    const uploaded = await api.uploadLatestJobMedia(jobId);
    setUploadedImages((current) => [uploaded, ...current.filter((image) => image.id !== uploaded.id)]);
    setNotice("最新结果已上传到图床和素材库");
  };

  /**
   * 从当前文件夹的素材库中移除指定记录。
   * @param imageId - 素材 ID
   */
  const deleteUploadedImage = async (imageId: string) => {
    try {
      await api.deleteUploadedImage(imageId);
      setNotice("已从素材列表移除");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "素材移除失败");
      throw error;
    }
  };

  /**
   * 在新建任务时，使用图片库中的指定图片作为垫图参考图。
   * @param url - 图片公网 URL
   */
  const useUploadedImage = (url: string) => {
    setImageToUse(url);
    setNotice("已添加到参考图片");
  };

  /**
   * 一键清理当前文件夹所有生成失败的任务盒子
   */
  const clearFailedJobs = async () => {
    if (!activeFolderId || failedJobsCount === 0) return;
    try {
      setIsClearingFailed(true);
      const count = await api.deleteFailedJobs(activeFolderId);
      setJobs((current) => current.filter((j) => j.status !== "failed"));
      setPreviewJob((current) => (current?.status === "failed" ? null : current));
      setEditingRetryJob((current) => (current?.status === "failed" ? null : current));
      setShowClearFailedConfirm(false);
      setNotice(`已清理 ${count} 个生成失败的盒子`);
      Message.success(`已清理 ${count} 个生成失败的盒子喵！`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "清理失败盒子出错");
      Message.error(error instanceof Error ? error.message : "清理失败盒子出错");
    } finally {
      setIsClearingFailed(false);
    }
  };

  /**
   * 按指定模板重新排列并重置当前文件夹中的所有盒子坐标
   * @param direction - 排版方向：horizontal | vertical | grid
   * @param gridColumns - 每行数量（针对 grid 模式）
   */
  const applyLayout = async (direction: LayoutDirection, gridColumns: number) => {
    if (!activeFolderId || jobs.length === 0) return;

    try {
      const positions = calculateLayoutPositions(jobs, {
        direction,
        gridColumns,
        gapX: 320,
        gapY: 240,
        startX: 318,
        startY: 150
      });

      const updatedJobs = await api.batchUpdateJobPositions(activeFolderId, positions);
      setJobs(updatedJobs);
      resetCanvas();

      const templateNameMap: Record<LayoutDirection, string> = {
        horizontal: "从左往右",
        vertical: "从上往下",
        grid: `蛇形网格（每行 ${gridColumns} 个）`
      };

      const name = templateNameMap[direction] || "指定模板";
      setNotice(`已按【${name}】重置画布排版`);
      Message.success(`已按【${name}】重置画布排版喵！`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "重置排版失败");
      Message.error(error instanceof Error ? error.message : "重置排版失败");
    }
  };

  /**
   * 重试绘图 — 将失败/已完成任务重新加入队列
   * @param jobId - 任务 ID
   */
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

  /**
   * 编辑参数后重绘 — 用编辑弹窗返回的新参数就地更新任务并重新入队
   * @param jobId - 任务 ID
   * @param edits - 编辑后的绘图参数
   */
  const confirmRegenerate = async (jobId: string, edits: RegenerateEdits) => {
    try {
      setIsRegenerating(true);
      const updated = await api.regenerateJobWithEdits(jobId, edits);
      setJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)));
      await loadQueue();
      setEditingRetryJob(null);
      setNotice("已用新参数重新加入绘制队列");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "重新绘制失败");
    } finally {
      setIsRegenerating(false);
    }
  };

  /**
   * 保存 API 设置（Base URL / Model / API Key）
   * 保存成功后刷新队列状态以切换真实 API / Mock 模式
   * @param payload - API 配置更新参数
   */
  const saveProviderSettings = async (payload: UpdateImageProviderSettingsPayload) => {
    try {
      const settings = await api.updateImageProviderSettings(payload);
      setProviderSettings(settings);
      const providerLabel = settings.providerId === "grsai" ? "Grsai" : "多米API";
      setNotice(settings.hasApiKey ? `API 设置已保存，绘图将使用 ${providerLabel}` : "API 设置已保存");
      await loadQueue();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "API 设置保存失败");
      throw error;
    }
  };

  /**
   * 完成新手引导，记录到 localStorage 不再弹出
   */
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
        isCanvasDragging={Boolean(canvasDrag)}
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
        onEditRetryJob={setEditingRetryJob}
        onDeleteJob={deleteJob}
        onUploadLatestMedia={uploadLatestJobMedia}
        onUseImage={setImageToUse}
      />

      <header className="floating-top">
        <div className="metrics">
          <Metric label="运行" value={`${queue.running}/${queue.maxConcurrent}`} />
          <Metric label="等待" value={String(queue.pending)} />
          <Metric label="完成" value={String(completedJobs)} />
          <Metric label="处理中" value={String(inFlightJobs)} />
        </div>
        {activeFolder ? (
          <UploadedImageLibrary
            folderId={activeFolder.id}
            folderName={activeFolder.name}
            images={uploadedImages}
            isLoading={isImageLibraryLoading}
            onUseImage={useUploadedImage}
            onDeleteImage={deleteUploadedImage}
          />
        ) : null}
      </header>

      <CanvasToolbar
        zoom={activeFolder?.canvasZoom ?? 1}
        darkMode={darkMode}
        onZoomOut={() => zoomCanvas(-0.1)}
        onZoomIn={() => zoomCanvas(0.1)}
        onResetCanvas={resetCanvas}
        hasLatestOutput={Boolean(latestOutputJob)}
        onJumpToLatestOutput={jumpToLatestOutput}
        onSortByTime={() => void sortJobs("time")}
        onSortByName={() => void sortJobs("name")}
        onOpenAnnouncement={() => setAnnouncementOpen(true)}
        unreadAnnouncementsCount={unreadAnnouncementsCount}
        onOpenApiSettings={() => setApiSettingsOpen(true)}
        onOpenGuide={() => setOnboardingOpen(true)}
        onToggleTheme={() => setDarkMode((value) => !value)}
        failedJobsCount={failedJobsCount}
        onClearFailedJobs={() => setShowClearFailedConfirm(true)}
        onApplyLayout={applyLayout}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        jobs={jobs}
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
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
      />

      {activeFolder ? (
        <CreateJobPanel
          activeFolderId={activeFolderId}
          apiProviderId={providerSettings.providerId}
          variant="composer"
          notice={notice}
          isSubmitting={isSubmitting}
          usedImage={imageToUse}
          onSubmit={submitJobs}
          onUploadImage={uploadImage}
          onImageUsed={() => setImageToUse(null)}
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

      <ImagePreview job={previewJob} onClose={() => setPreviewJob(null)} onUseImage={(url) => { setImageToUse(url); setPreviewJob(null); }} />

      <RegenerateEditDialog
        apiProviderId={providerSettings.providerId}
        open={Boolean(editingRetryJob)}
        job={editingRetryJob}
        isSubmitting={isRegenerating}
        onClose={() => setEditingRetryJob(null)}
        onUploadImage={uploadImage}
        onConfirm={confirmRegenerate}
      />

      <OnboardingGuide
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onFinish={finishOnboarding}
      />

      <ReleaseNotesDialog
        open={announcementOpen}
        onOpenChange={setAnnouncementOpen}
        onAcknowledge={() => setUnreadAnnouncementsCount(getUnreadReleasesCount())}
      />

      <Dialog open={showClearFailedConfirm} onOpenChange={setShowClearFailedConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清理失败盒子</DialogTitle>
            <DialogDescription>
              确定要清理当前文件夹中所有生成失败的图片盒子吗？共 {failedJobsCount} 个盒子将被删除，此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearFailedConfirm(false)} disabled={isClearingFailed}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void clearFailedJobs()}
              disabled={isClearingFailed}
            >
              {isClearingFailed ? "正在清理..." : "确定清理"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default App;
