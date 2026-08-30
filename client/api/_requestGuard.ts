import type { IncomingMessage } from "node:http";

type RateWindow = { count: number; resetAt: number };
const rateWindows = new Map<string, RateWindow>();
const RATE_WINDOW_MS = 60 * 1000;
const MAX_TRACKED_CLIENTS = 1000;

const firstHeader = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getClientAddress = (req: IncomingMessage) =>
  firstHeader(req.headers["x-forwarded-for"])?.split(",", 1)[0]?.trim() ||
  req.socket.remoteAddress ||
  "unknown";

/** 拒绝浏览器明确标记的跨站调用，减少接口被其他站点直接盗用。 */
export const isCrossSiteRequest = (req: IncomingMessage) => {
  const fetchSite = firstHeader(req.headers["sec-fetch-site"]);
  if (fetchSite === "cross-site") return true;

  const origin = firstHeader(req.headers.origin);
  const host = firstHeader(req.headers["x-forwarded-host"]) || firstHeader(req.headers.host);
  if (!origin || !host) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
};

/** 单实例轻量限流；部署平台仍应再配置全局限流/WAF。 */
export const isRateLimited = (req: IncomingMessage, scope: string, limit: number) => {
  const now = Date.now();
  const key = `${scope}:${getClientAddress(req)}`;
  const current = rateWindows.get(key);
  if (!current || current.resetAt <= now) {
    if (rateWindows.size >= MAX_TRACKED_CLIENTS) {
      for (const [storedKey, window] of rateWindows) {
        if (window.resetAt <= now) rateWindows.delete(storedKey);
      }
      if (rateWindows.size >= MAX_TRACKED_CLIENTS) rateWindows.delete(rateWindows.keys().next().value as string);
    }
    rateWindows.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > limit;
};
