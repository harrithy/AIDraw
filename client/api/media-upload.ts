import type { IncomingMessage, ServerResponse } from "node:http";
import { transferRemoteMedia, type MediaKind } from "./_mediaTransfer.js";

const MAX_JSON_BYTES = 32 * 1024;

type UploadRequest = IncomingMessage & { body?: unknown };

const sendJson = (res: ServerResponse, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
};

const parseJsonValue = (value: unknown) => {
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8"));
  if (typeof value === "string") return JSON.parse(value);
  if (value && typeof value === "object") return value;
  return null;
};

/** 读取很小的 JSON 请求体；远程媒体内容不会经过客户端请求体。 */
const readJsonBody = async (req: UploadRequest) => {
  if (req.body !== undefined) return parseJsonValue(req.body);
  const chunks: Buffer[] = [];
  let byteSize = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteSize += buffer.length;
    if (byteSize > MAX_JSON_BYTES) throw new Error("请求内容过大");
    chunks.push(buffer);
  }
  return parseJsonValue(Buffer.concat(chunks));
};

export default async function handler(req: UploadRequest, res: ServerResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  try {
    const payload = (await readJsonBody(req)) as {
      mediaUrl?: unknown;
      jobId?: unknown;
      expectedKind?: unknown;
    } | null;
    if (
      typeof payload?.mediaUrl !== "string" ||
      typeof payload.jobId !== "string" ||
      (payload.expectedKind !== "image" && payload.expectedKind !== "video")
    ) {
      sendJson(res, 400, { error: "缺少合法的 mediaUrl、jobId 或 expectedKind" });
      return;
    }

    const result = await transferRemoteMedia(payload.mediaUrl, payload.jobId, payload.expectedKind as MediaKind);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 502, { error: error instanceof Error ? error.message : "上传远程媒体失败" });
  }
}
