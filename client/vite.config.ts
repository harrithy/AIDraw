import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: "../dist",
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
