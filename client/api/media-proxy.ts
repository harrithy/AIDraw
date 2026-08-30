import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fetchPublicRemote, RemoteUrlPolicyError } from "./_remoteUrl.js";
import { isCrossSiteRequest, isRateLimited } from "./_requestGuard.js";

const MAX_PROXY_BYTES = 200 * 1024 * 1024;
const PROXY_TIMEOUT_MS = 60 * 1000;

const sendJson = (res: ServerResponse, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }
  if (isCrossSiteRequest(req)) {
    sendJson(res, 403, { error: "禁止跨站调用媒体代理" });
    return;
  }
  if (isRateLimited(req, "media-proxy", 60)) {
    res.setHeader("Retry-After", "60");
    sendJson(res, 429, { error: "请求过于频繁，请稍后再试" });
    return;
  }

  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const targetUrl = requestUrl.searchParams.get("url")?.trim();
  if (!targetUrl) {
    sendJson(res, 400, { error: "缺少合法的 url 参数（仅支持 http/https）" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const range = Array.isArray(req.headers.range) ? req.headers.range[0] : req.headers.range;
    const { response } = await fetchPublicRemote(targetUrl, {
      headers: {
        "user-agent": "aidraw-media-proxy/1.0",
        ...(range ? { range } : {})
      },
      signal: controller.signal
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
    if (!response.body) {
      sendJson(res, 502, { error: "上游未返回媒体内容" });
      return;
    }

    let streamedBytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        streamedBytes += chunk.length;
        if (streamedBytes > MAX_PROXY_BYTES) {
          callback(new Error("媒体文件过大，无法代理"));
          return;
        }
        callback(null, chunk);
      }
    });

    res.statusCode = response.status;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    if (contentLength > 0) res.setHeader("Content-Length", contentLength);
    const contentRange = response.headers.get("content-range");
    if (contentRange) res.setHeader("Content-Range", contentRange);
    const acceptRanges = response.headers.get("accept-ranges");
    if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);

    // 流式转发避免整个视频成为 Vercel Function 的大型响应缓冲区。
    const source = Readable.fromWeb(
      response.body as unknown as import("node:stream/web").ReadableStream
    );
    await pipeline(source, limiter, res);
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    const status = error instanceof RemoteUrlPolicyError ? 400 : controller.signal.aborted ? 504 : 502;
    sendJson(res, status, { error: `代理请求失败：${error instanceof Error ? error.message : "未知错误"}` });
  } finally {
    clearTimeout(timeout);
  }
}
