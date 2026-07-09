import { createRoot } from "react-dom/client";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type MessageType = "success" | "error" | "info";

export const Message = {
  success: (content: string) => showMessage(content, "success"),
  error: (content: string) => showMessage(content, "error"),
  info: (content: string) => showMessage(content, "info"),
};

function showMessage(content: string, type: MessageType) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const icons = {
    success: <CheckCircle2 className="text-green-500 dark:text-green-400" size={16} />,
    error: <AlertCircle className="text-red-500 dark:text-red-400" size={16} />,
    info: <Info className="text-blue-500 dark:text-blue-400" size={16} />,
  };

  const remove = () => {
    // We add an out-animation class
    const el = container.firstElementChild;
    if (el) {
      el.classList.add("animate-out", "fade-out", "slide-out-to-top-4");
      setTimeout(() => {
        root.unmount();
        container.remove();
      }, 300);
    } else {
      root.unmount();
      container.remove();
    }
  };

  root.render(
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-[var(--panel)] shadow-lg transition-all animate-in fade-in slide-in-from-top-4`}>
      {icons[type]}
      <span className="text-[14px] font-medium text-[var(--ink)]">{content}</span>
    </div>
  );

  setTimeout(remove, 3000);
}
