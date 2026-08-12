import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Vercel Build Output API 组装脚本。
 * 由于 vercel.json 的 outputDirectory 模式会忽略项目根 api/ 目录，
 * 这里手动生成 .vercel/output：static（静态资源）+ functions（media-proxy 代理函数）。
 */
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const outputDir = join(root, ".vercel", "output");
const staticDir = join(outputDir, "static");
const funcDir = join(outputDir, "functions", "api", "media-proxy.func");

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
mkdirSync(funcDir, { recursive: true });

cpSync(join(root, "client", "dist"), staticDir, { recursive: true });

/**
 * Build Output API 至少需要 version: 3。先检查静态文件和函数，
 * 只有未命中时才回退到 SPA，避免 /api/media-proxy 被 index.html 吞掉。
 */
writeFileSync(
  join(outputDir, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/image-upload/(.*)", dest: "https://image.harrio.xyz/$1" },
        { handle: "filesystem" },
        { src: "/.*", dest: "/index.html" }
      ]
    },
    null,
    2
  ),
  "utf8"
);

const proxyHandler = `"use strict";

const MAX_PROXY_BYTES = 200 * 1024 * 1024;

const parseTargetUrl = (rawUrl) => {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

module.exports = async function handler(req, res) {
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
      headers: { "user-agent": "aidraw-media-proxy/1.0" }
    });

    if (!response.ok) {
      sendJson(res, response.status, { error: "上游返回 HTTP " + response.status });
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
    sendJson(res, 502, { error: "代理请求失败：" + (error instanceof Error ? error.message : "未知错误") });
  }
};
`;

writeFileSync(join(funcDir, "index.js"), proxyHandler, "utf8");
writeFileSync(join(funcDir, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2), "utf8");
writeFileSync(
  join(funcDir, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs20.x", handler: "index.js", launcherType: "Nodejs" }, null, 2),
  "utf8"
);

console.log("Vercel output written to .vercel/output (config + static + api/media-proxy.func)");
