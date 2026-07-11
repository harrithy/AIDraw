import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * 合并 CSS 类名（Tailwind 专用）
 * 先用 clsx 合并条件类名，再用 tailwind-merge 解决 Tailwind 类名冲突
 * 这是 shadcn/ui 的标准做法
 * @param inputs - 任意数量的类名参数（字符串、对象、数组均可）
 * @returns 合并后的最终类名字符串
 * @example
 * cn("px-4", isActive && "bg-blue-500", "px-2") // -> "px-2 bg-blue-500"（后面的 px-2 覆盖前面的 px-4）
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
