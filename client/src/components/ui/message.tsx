import { createRoot } from "react-dom/client";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type MessageType = "success" | "error" | "info";

type MessageOptions = {
  action?: {
    label: string;
    onClick: () => void;
  };
};

export const Message = {
  success: (content: string, options?: MessageOptions) => showMessage(content, "success", options),
  error: (content: string, options?: MessageOptions) => showMessage(content, "error", options),
  info: (content: string, options?: MessageOptions) => showMessage(content, "info", options),
};

function showMessage(content: string, type: MessageType, options?: MessageOptions) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let removeTimer: number | undefined;
  let isRemoving = false;

  const icons = {
    success: <CheckCircle2 className="text-green-500 dark:text-green-400" size={16} />,
    error: <AlertCircle className="text-red-500 dark:text-red-400" size={16} />,
    info: <Info className="text-blue-500 dark:text-blue-400" size={16} />,
  };

  const remove = () => {
    if (isRemoving) return;
    isRemoving = true;
    if (removeTimer !== undefined) window.clearTimeout(removeTimer);

    const el = container.querySelector<HTMLElement>("[data-message-toast]");
    if (el) {
      // 使用与清理计时一致的过渡，并保持最终透明状态，避免动画结束后短暂恢复可见
      el.classList.remove("animate-in", "fade-in", "slide-in-from-top-4");
      el.style.transition = "opacity 300ms ease, transform 300ms ease";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
      void el.offsetWidth;
      el.style.opacity = "0";
      el.style.transform = "translateY(-1rem)";
      window.setTimeout(() => {
        root.unmount();
        container.remove();
      }, 300);
    } else {
      root.unmount();
      container.remove();
    }
  };

  root.render(
    <div className="pointer-events-none fixed top-6 left-0 right-0 z-[9999] flex justify-center px-4">
      <div
        data-message-toast
        className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-[var(--panel)] px-4 py-2.5 shadow-lg animate-in fade-in slide-in-from-top-4"
      >
        {icons[type]}
        <span className="text-[14px] font-medium text-[var(--ink)]">{content}</span>
        {options?.action ? (
          <button
            type="button"
            className="message-action ml-1 rounded-md border border-[var(--line)] bg-[var(--panel-strong)] font-medium text-[var(--ink)]"
            onClick={() => {
              options.action?.onClick();
              remove();
            }}
          >
            {options.action.label}
          </button>
        ) : null}
      </div>
    </div>
  );

  removeTimer = window.setTimeout(remove, 3000);
}
