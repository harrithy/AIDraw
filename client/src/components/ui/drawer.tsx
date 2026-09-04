import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type DrawerProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * 右侧抽屉基元：基于 Radix Dialog 的非模态容器。
 * 不渲染遮罩、不锁定滚动、不拦截焦点，抽屉打开期间页面保持完全可交互；
 * 点击抽屉外部不会关闭；焦点在抽屉内时按 Esc 关闭，焦点在其他弹窗内时不抢 Esc。
 */
function Drawer({ open, onOpenChange, className, children, ...props }: DrawerProps) {
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !contentRef.current) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        const otherLayer = active.closest('[data-slot="dialog-content"], [data-slot="drawer"]');
        // 焦点在其他模态弹窗内时，把 Esc 留给那个弹窗处理。
        if (otherLayer && !contentRef.current.contains(active)) return;
      }
      event.preventDefault();
      onOpenChange(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          ref={contentRef}
          data-slot="drawer"
          className={cn("drawer", className)}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export { Drawer };
