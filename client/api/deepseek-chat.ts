import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { isCrossSiteRequest, isRateLimited } from "./_requestGuard.js";

/**
 * DeepSeek 官方 Chat Completions API 的同源代理。
 * 官方接口未开放浏览器 CORS，且 API Key 只能由浏览器本地持有，
 * 因此由本函数把请求转发到 POST https://api.deepseek.com/chat/completions。
 * 支持流式（SSE）转发：把上游 text/event-stream 逐块透传给前端。
 */
const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";
const REQUEST_TIMEOUT_MS = 55 * 1000;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_MESSAGES = 16;
const MAX_CONTENT_CHARS = 100_000;
const ALLOWED_MODELS = new Set(["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp"]);

type ChatRequest = {
  apiKey?: unknown;
  model?: unknown;
  messages?: unknown;
  temperature?: unknown;
  max_tokens?: unknown;
  stream?: unknown;
  thinking?: unknown;
  reasoning_effort?: unknown;
};

const sendJson = (res: ServerResponse, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
};

/** 读取较小的 JSON 请求体；超过上限直接报错。 */
const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let byteSize = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteSize += buffer.length;
    if (byteSize > MAX_BODY_BYTES) throw new Error("请求内容过大");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : null;
};

const isImageBlock = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const block = value as { type?: unknown; image_url?: unknown };
  if (block.type !== "image_url") return false;
  const imageUrl = (block.image_url ?? {}) as { url?: unknown };
  return typeof imageUrl.url === "string" && /^https?:\/\//i.test(imageUrl.url) && imageUrl.url.length <= 8192;
};

const isTextBlock = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const block = value as { type?: unknown; text?: unknown };
  return block.type === "text" && typeof block.text === "string";
};

const isChatMessage = (value: unknown): value is { role: string; content: string | unknown[] } => {
  if (!value || typeof value !== "object") return false;
  const message = value as { role?: unknown; content?: unknown };
  if (
    message.role !== "system" &&
    message.role !== "user" &&
    message.role !== "assistant"
  ) {
    return false;
  }
  if (typeof message.content === "string") return true;
  return (
    Array.isArray(message.content) &&
    message.content.length > 0 &&
    message.content.length <= 20 &&
    message.content.every((block) => isTextBlock(block) || isImageBlock(block))
  );
};

/** 提取消息的文本内容（图片按 URL 长度计入），用于总量校验。 */
const getMessageTextLength = (content: string | unknown[]) => {
  if (typeof content === "string") return content.length;
  return (content as unknown[]).reduce<number>((total, block) => {
    if (isTextBlock(block)) return total + (block as { text: string }).text.length;
    if (isImageBlock(block)) {
      return total + ((block as { image_url: { url: string } }).image_url.url.length);
    }
    return total;
  }, 0);
};

const parseUpstreamBody = (raw: string) => {
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }
  if (isCrossSiteRequest(req)) {
    sendJson(res, 403, { error: "禁止跨站调用 DeepSeek 润写" });
    return;
  }
  if (isRateLimited(req, "deepseek-chat", 30)) {
    res.setHeader("Retry-After", "60");
    sendJson(res, 429, { error: "润写请求过于频繁，请稍后再试" });
    return;
  }

  const payload = (await readJsonBody(req).catch(() => null)) as ChatRequest | null;
  if (!payload || typeof payload !== "object") {
    sendJson(res, 400, { error: "请求体必须是 JSON 对象" });
    return;
  }

  const { apiKey, model, messages, temperature, max_tokens, stream, thinking, reasoning_effort } = payload;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    sendJson(res, 400, { error: "缺少 DeepSeek API Key" });
    return;
  }
  if (typeof model !== "string" || !ALLOWED_MODELS.has(model)) {
    sendJson(res, 400, { error: "模型不受支持，请使用 deepseek-v4-pro 或 deepseek-v4-flash" });
    return;
  }
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES ||
    !messages.every(isChatMessage)
  ) {
    sendJson(res, 400, { error: "messages 格式不正确，需为 1-16 条 role/content 消息" });
    return;
  }
  const contentChars = (messages as Array<{ content: string | unknown[] }>).reduce<number>(
    (total, message) => total + getMessageTextLength(message.content),
    0
  );
  if (contentChars > MAX_CONTENT_CHARS) {
    sendJson(res, 413, { error: `文本内容过长，单次最多支持 ${MAX_CONTENT_CHARS} 字符` });
    return;
  }
  if (
    temperature !== undefined &&
    (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2)
  ) {
    sendJson(res, 400, { error: "temperature 需为 0 到 2 之间的数字" });
    return;
  }
  if (
    max_tokens !== undefined &&
    (typeof max_tokens !== "number" || !Number.isInteger(max_tokens) || max_tokens < 1 || max_tokens > 32768)
  ) {
    sendJson(res, 400, { error: "max_tokens 需为 1 到 32768 之间的整数" });
    return;
  }
  if (stream !== undefined && typeof stream !== "boolean") {
    sendJson(res, 400, { error: "stream 需为布尔值" });
    return;
  }
  if (
    thinking !== undefined &&
    (typeof thinking !== "object" ||
      thinking === null ||
      !["enabled", "disabled"].includes(String((thinking as { type?: unknown }).type)))
  ) {
    sendJson(res, 400, { error: "thinking 格式不正确，需为 { type: enabled|disabled }" });
    return;
  }
  if (
    reasoning_effort !== undefined &&
    (typeof reasoning_effort !== "string" || !["low", "high", "max"].includes(reasoning_effort))
  ) {
    sendJson(res, 400, { error: "reasoning_effort 需为 low / high / max" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const isStreaming = stream === true;
    const upstream = await fetch(DEEPSEEK_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
        "User-Agent": "aidraw-deepseek-proxy/1.0"
      },
      body: JSON.stringify({
        model,
        messages,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(max_tokens !== undefined ? { max_tokens } : {}),
        ...(thinking !== undefined ? { thinking } : {}),
        ...(reasoning_effort !== undefined ? { reasoning_effort } : {}),
        stream: isStreaming
      }),
      signal: controller.signal
    });

    if (!upstream.ok) {
      const upstreamBody = await upstream.text().catch(() => "");
      const parsedBody = parseUpstreamBody(upstreamBody);
      sendJson(
        res,
        upstream.status,
        parsedBody ?? { error: upstreamBody.trim() || `DeepSeek 返回 HTTP ${upstream.status}` }
      );
      return;
    }

    if (isStreaming) {
      // 透传上游 SSE 流，保证浏览器端能边生成边回填提示词。
      res.statusCode = upstream.status;
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      if (upstream.body) {
        const source = Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream);
        await pipeline(source, res);
      } else {
        res.end();
      }
      return;
    }

    const upstreamBody = await upstream.text().catch(() => "");
    const parsedBody = parseUpstreamBody(upstreamBody);
    sendJson(
      res,
      upstream.status,
      parsedBody ?? { error: upstreamBody.trim() || `DeepSeek 返回 HTTP ${upstream.status}` }
    );
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    sendJson(res, controller.signal.aborted ? 504 : 502, {
      error: `DeepSeek 请求失败：${error instanceof Error ? error.message : "未知错误"}`
    });
  } finally {
    clearTimeout(timeout);
  }
}
