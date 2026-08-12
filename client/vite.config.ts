import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import mediaProxyHandler from "../api/media-proxy";
import mediaUploadHandler from "../api/media-upload";

const mediaProxyPlugin = (): Plugin => ({
  name: "media-proxy",
  configureServer(server) {
    server.middlewares.use("/api/media-proxy", mediaProxyHandler);
    server.middlewares.use("/api/media-upload", mediaUploadHandler);
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
