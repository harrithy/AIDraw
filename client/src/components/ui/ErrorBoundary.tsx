import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  LifeBuoy,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Terminal
} from "lucide-react";
import {
  FOLDER_STORE,
  JOB_STORE,
  openDb,
  SETTINGS_STORE,
  UPLOADED_IMAGE_STORE
} from "../../lib/storage/database";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  scope?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isExporting: boolean;
  exportNotice: string | null;
  copied: boolean;
  showDetails: boolean;
}

/**
 * 全局 / 局部 React 错误边界组件
 *
 * 核心特性：
 * 1. 拦截渲染层未捕获异常，彻底消除 React 19 白屏崩溃；
 * 2. 紧急数据抢救：即使组件树崩溃，仍可直接从 IndexedDB 读取并导出全部画布与任务备份；
 * 3. 界面偏好一键安全重置（清除损坏的 localStorage 偏好并刷新）；
 * 4. 友好的赛博猫娘自救界面，提供原地重试、页面刷新与一键复制诊断日志功能。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isExporting: false,
      exportNotice: null,
      copied: false,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error("[AIDraw ErrorBoundary Caught]", error, errorInfo);
  }

  /** 原地尝试恢复渲染 */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      exportNotice: null,
      copied: false,
      showDetails: false
    });
  };

  /** 完整页面刷新 */
  handleReload = (): void => {
    window.location.reload();
  };

  /** 清除界面偏好缓存并重新加载 */
  handleResetPreferences = (): void => {
    try {
      localStorage.removeItem("aidraw-ui-preferences");
      localStorage.removeItem("aidraw-page-preferences");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  /** 紧急从 IndexedDB 抢救导出全量数据 JSON */
  handleEmergencyBackup = async (): Promise<void> => {
    if (this.state.isExporting) return;
    this.setState({ isExporting: true, exportNotice: "正在从本地数据库提取全部备份..." });

    try {
      const db = await openDb();
      function readAllFromStore<T>(storeName: string): Promise<T[]> {
        return new Promise((resolve, reject) => {
          if (!db.objectStoreNames.contains(storeName)) {
            resolve([]);
            return;
          }
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve((req.result || []) as T[]);
          req.onerror = () => reject(req.error);
        });
      }

      const [folders, jobs, uploadedImages, settingsEntries] = await Promise.all([
        readAllFromStore(FOLDER_STORE),
        readAllFromStore(JOB_STORE),
        readAllFromStore(UPLOADED_IMAGE_STORE),
        readAllFromStore(SETTINGS_STORE)
      ]);

      const backupPackage = {
        format: "aidraw-emergency-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        reason: "crash-rescue",
        error: this.state.error?.message || "unknown",
        folders,
        jobs,
        uploadedImages,
        settings: settingsEntries
      };

      const jsonStr = JSON.stringify(backupPackage, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);

      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const fileName = `AIDraw-Rescue-Backup-${stamp}.json`;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      this.setState({
        isExporting: false,
        exportNotice: `已成功导出救灾备份！包含 ${folders.length} 个文件夹、${jobs.length} 个任务与 ${uploadedImages.length} 个素材记录。`
      });
    } catch (err) {
      console.error("紧急备份提取失败:", err);
      this.setState({
        isExporting: false,
        exportNotice: `提取备份失败: ${err instanceof Error ? err.message : "未知错误"}`
      });
    }
  };

  /** 复制错误诊断堆栈到剪贴板 */
  handleCopyDiagnostics = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const diagnosticText = [
      `=== AIDraw 异常诊断报告 ===`,
      `时间: ${new Date().toLocaleString()}`,
      `页面: ${window.location.href}`,
      `用户代理: ${navigator.userAgent}`,
      `范围: ${this.props.scope || "全局"}`,
      `错误名称: ${error?.name || "Error"}`,
      `错误信息: ${error?.message || "No message"}`,
      `堆栈轨迹:`,
      error?.stack || "无 JS 堆栈",
      `组件调用栈:`,
      errorInfo?.componentStack || "无组件栈"
    ].join("\n");

    try {
      await navigator.clipboard.writeText(diagnosticText);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      // 降级使用 textarea
      const el = document.createElement("textarea");
      el.value = diagnosticText;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2500);
    }
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, isExporting, exportNotice, copied, showDetails } = this.state;
    const { children, fallback, scope } = this.props;

    if (!hasError) {
      return children;
    }

    if (typeof fallback === "function") {
      return fallback(error || new Error("Unknown error"), this.handleReset);
    }

    if (fallback) {
      return fallback;
    }

    return (
      <div className="error-boundary-screen">
        <div className="error-boundary-backdrop-glow" />
        <div className="error-boundary-card">
          {/* 顶部徽标与状态 */}
          <div className="error-boundary-header">
            <div className="error-boundary-badge">
              <span className="error-badge-pulse" />
              <AlertTriangle size={14} className="text-amber-500" />
              <span>{scope ? `${scope}异常拦截` : "系统异常保护机制 · CRASH RESCUE"}</span>
            </div>
            <div className="error-boundary-subtag">
              <Sparkles size={13} />
              <span>数据安全保护中</span>
            </div>
          </div>

          {/* 标题与猫娘友好提示 */}
          <div className="error-boundary-title-row">
            <div className="error-boundary-icon-box">
              <LifeBuoy size={28} />
            </div>
            <div>
              <h1 className="error-boundary-title">
                {scope ? `${scope}渲染遇到了意外错误` : "系统核心检测到未捕获的渲染异常喵！"}
              </h1>
              <p className="error-boundary-desc">
                小雪已紧急拦截错误，成功避免了白屏崩溃。您的本地画布数据、历史任务和设置完好无损，请尝试以下修复措施：
              </p>
            </div>
          </div>

          {/* 错误提示条 */}
          {error?.message ? (
            <div className="error-boundary-message-box">
              <span className="error-prefix">{error.name || "Error"}:</span>
              <span className="error-text">{error.message}</span>
            </div>
          ) : null}

          {/* 导出状态通知 */}
          {exportNotice ? (
            <div className="error-boundary-notice-box">
              <Check size={16} className="text-emerald-500 flex-shrink-0" />
              <span>{exportNotice}</span>
            </div>
          ) : null}

          {/* 核心操作按钮网格 */}
          <div className="error-boundary-actions">
            <button
              type="button"
              className="error-action-btn primary"
              onClick={this.handleReload}
              title="重新加载网页"
            >
              <RefreshCw size={15} />
              <span>刷新重试</span>
            </button>

            <button
              type="button"
              className="error-action-btn secondary"
              onClick={this.handleReset}
              title="不刷新网页，重置当前组件错误状态"
            >
              <Sparkles size={15} />
              <span>原地恢复</span>
            </button>

            <button
              type="button"
              className="error-action-btn warning"
              onClick={this.handleEmergencyBackup}
              disabled={isExporting}
              title="直接从本地 IndexedDB 导出包含全部文件夹与任务的 JSON 备份"
            >
              <Download size={15} className={isExporting ? "animate-bounce" : ""} />
              <span>{isExporting ? "正在提取备份..." : "紧急导出全部数据备份"}</span>
            </button>

            <button
              type="button"
              className="error-action-btn subtle"
              onClick={this.handleResetPreferences}
              title="清除损坏的界面偏好缓存并刷新"
            >
              <RotateCcw size={15} />
              <span>重置界面偏好并刷新</span>
            </button>
          </div>

          {/* 详细调用栈排查区 */}
          <div className="error-boundary-details-section">
            <div className="error-boundary-details-header">
              <button
                type="button"
                className="error-details-toggle"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              >
                <Terminal size={14} />
                <span>技术诊断详情 (Stack Trace)</span>
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <button
                type="button"
                className="error-copy-btn"
                onClick={this.handleCopyDiagnostics}
                title="复制诊断日志到剪贴板"
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copied ? "已复制诊断日志" : "复制诊断报告"}</span>
              </button>
            </div>

            {showDetails ? (
              <div className="error-boundary-stack-container">
                <pre className="error-stack-code">
                  <code>
                    {error?.stack || "无 JavaScript 调用栈"}
                    {"\n\n=== Component Stack ===\n"}
                    {errorInfo?.componentStack || "无 React 组件栈"}
                  </code>
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
