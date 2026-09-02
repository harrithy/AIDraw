import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import deepseekChatHandler from "./api/deepseek-chat";
import mediaProxyHandler from "./api/media-proxy";
import mediaUploadHandler from "./api/media-upload";

const mediaProxyPlugin = (): Plugin => ({
  name: "media-proxy",
  configureServer(server) {
    server.middlewares.use("/api/media-proxy", mediaProxyHandler);
    server.middlewares.use("/api/media-upload", mediaUploadHandler);
    server.middlewares.use("/api/deepseek-chat", deepseekChatHandler);
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
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(moduleId) {
          if (
            moduleId.includes("/node_modules/react/") ||
            moduleId.includes("/node_modules/react-dom/") ||
            moduleId.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (moduleId.includes("/node_modules/gsap/") || moduleId.includes("/node_modules/@gsap/")) {
            return "motion-vendor";
          }
          if (
            moduleId.includes("/node_modules/radix-ui/") ||
            moduleId.includes("/node_modules/@radix-ui/") ||
            moduleId.includes("/node_modules/lucide-react/")
          ) {
            return "ui-vendor";
          }
        }
      }
    }
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
