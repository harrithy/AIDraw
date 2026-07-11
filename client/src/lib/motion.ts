/**
 * 检测用户是否开启了"减少动画"系统偏好
 * 遵循 `prefers-reduced-motion` 媒体查询，满足无障碍需求
 * @returns 如果用户偏好减少动画则返回 true
 */
export const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
