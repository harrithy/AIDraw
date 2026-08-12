import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** 本地开发用的媒体代理中间件：与 vercel 的 api/media-proxy.ts 保持同逻辑，绕过浏览器 CORS 限制。 */
const mediaProxyMiddleware = async (req: IncomingMessage, res: ServerResponse) => {
  const sendJson = (status: number, payload: Record<string, unknown>) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  };

  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const rawUrl = requestUrl.searchParams.get("url");
  let targetUrl: string | null = null;
  if (typeof rawUrl === "string" && rawUrl.trim()) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") targetUrl = parsed.toString();
    } catch {
      targetUrl = null;
    }
  }
  if (!targetUrl) {
    sendJson(400, { error: "缺少合法的 url 参数（仅支持 http/https）" });
    return;
  }

  try {
    const response = await fetch(targetUrl, { headers: { "user-agent": "aidraw-media-proxy/1.0" } });
    if (!response.ok) {
      sendJson(response.status, { error: `上游返回 HTTP ${response.status}` });
      return;
    }
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(buffer);
  } catch (error) {
    sendJson(502, { error: `代理请求失败：${error instanceof Error ? error.message : "未知错误"}` });
  }
};

const mediaProxyPlugin = (): Plugin => ({
  name: "media-proxy",
  configureServer(server) {
    server.middlewares.use("/api/media-proxy", mediaProxyMiddleware);
  }
});

export default defineConfig({
  plugins: [react(), tailwindcss(), mediaProxyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/image-upload": {
        target: "https://image.harrio.xyz",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/image-upload/, "")
      }
    }
  }
});
