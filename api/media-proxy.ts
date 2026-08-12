import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_PROXY_BYTES = 200 * 1024 * 1024;

const parseTargetUrl = (rawUrl: unknown): string | null => {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

const sendJson = (res: ServerResponse, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const targetUrl = parseTargetUrl(requestUrl.searchParams.get("url"));
  if (!targetUrl) {
    sendJson(res, 400, { error: "缺少合法的 url 参数（仅支持 http/https）" });
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "user-agent": "aidraw-media-proxy/1.0"
      }
    });

    if (!response.ok) {
      sendJson(res, response.status, { error: `上游返回 HTTP ${response.status}` });
      return;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_PROXY_BYTES) {
      sendJson(res, 413, { error: "媒体文件过大，无法代理" });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(buffer);
  } catch (error) {
    sendJson(res, 502, { error: `代理请求失败：${error instanceof Error ? error.message : "未知错误"}` });
  }
}
