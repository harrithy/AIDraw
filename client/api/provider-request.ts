import type { IncomingMessage, ServerResponse } from "node:http";
import { assertPublicRemoteUrl, parseRemoteUrl, RemoteUrlPolicyError } from "./_remoteUrl.js";
import { isCrossSiteRequest, isRateLimited } from "./_requestGuard.js";

const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

/** 仅转发公开 HTTP(S) JSON 接口，不跟随重定向，避免把凭据带到其他主机。 */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const send = (status: number, payload: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(payload));
  };
  if (req.method !== "POST") return send(405, { error: "Method Not Allowed" });
  if (isCrossSiteRequest(req)) return send(403, { error: "禁止跨站调用中转代理" });
  if (isRateLimited(req, "provider-request", 240)) return send(429, { error: "请求过于频繁，请稍后再试" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    let raw: string;
    if (req.body !== undefined) {
      raw = typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
    } else {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_REQUEST_BYTES) return send(413, { error: "请求内容过大" });
        chunks.push(buffer);
      }
      raw = Buffer.concat(chunks).toString("utf8");
    }
    if (Buffer.byteLength(raw) > MAX_REQUEST_BYTES) return send(413, { error: "请求内容过大" });
    let payload: { url?: unknown; method?: unknown; headers?: unknown; body?: unknown };
    try { payload = JSON.parse(raw); } catch { return send(400, { error: "请求需为 JSON" }); }
    if (!payload || typeof payload.url !== "string" || !["GET", "POST"].includes(String(payload.method))) {
      return send(400, { error: "请提供有效地址和 GET/POST 方法" });
    }
    const url = parseRemoteUrl(payload.url);
    await assertPublicRemoteUrl(url);
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (payload.headers !== undefined) {
      if (!payload.headers || typeof payload.headers !== "object" || Array.isArray(payload.headers)) return send(400, { error: "请求头格式无效" });
      const entries = Object.entries(payload.headers);
      if (entries.length > 8) return send(400, { error: "请求头数量过多" });
      for (const [key, value] of entries) {
        if (!/^[a-zA-Z0-9-]+$/.test(key) || /^(host|cookie|content-length|connection|origin|referer|transfer-encoding|proxy-.*|sec-.*|x-forwarded-.*)$/i.test(key) || typeof value !== "string" || value.length > 8192 || /[\r\n]/.test(value)) {
          return send(400, { error: "请求头名称或内容无效" });
        }
        headers[key] = value;
      }
    }
    const upstream = await fetch(url, {
      method: String(payload.method), headers,
      ...(payload.method === "POST" ? { body: JSON.stringify(payload.body ?? {}) } : {}),
      redirect: "manual", signal: controller.signal
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      return send(400, { error: "中转地址发生重定向，请直接填写最终接口地址" });
    }
    if (Number(upstream.headers.get("content-length") || 0) > MAX_RESPONSE_BYTES) {
      await upstream.body?.cancel();
      return send(413, { error: "接口响应过大，请使用 URL 格式返回媒体结果" });
    }
    const reader = upstream.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return send(413, { error: "接口响应超过 8 MB，请使用 URL 格式返回媒体结果" });
      }
      chunks.push(value);
    }
    let result: unknown;
    try { result = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return send(502, { error: "上游未返回 JSON，请检查接口路径" }); }
    send(upstream.status, result);
  } catch (error) {
    // 不把上游请求头或含 Key 的请求内容回传到界面/日志。
    send(error instanceof RemoteUrlPolicyError ? 400 : controller.signal.aborted ? 504 : 502, {
      error: error instanceof RemoteUrlPolicyError ? error.message : controller.signal.aborted ? "中转请求超时" : "无法连接中转接口，请检查地址和网络"
    });
  } finally { clearTimeout(timeout); }
}
