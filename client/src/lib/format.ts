/**
 * 格式化 ISO 日期字符串为中文友好格式
 * 输出格式：`MM/DD HH:mm`，例如 `07/11 14:30`
 * 使用 Intl.DateTimeFormat 原生 API，自动处理时区
 * @param value - ISO 日期字符串
 * @returns 格式化后的日期字符串
 */
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
