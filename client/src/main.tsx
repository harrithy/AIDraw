/**
 * 应用入口文件
 * 注册 GSAP React 插件，挂载 React 应用到 #root DOM 节点
 * 使用 StrictMode 开启 React 开发模式下的额外检查
 */
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./styles.css";

// 注册 GSAP React hook 插件，使 useGSAP 可在组件中使用
gsap.registerPlugin(useGSAP);

// 形象馆使用独立地址和懒加载，工作区无需加载展示页或角色原图。
const MascotGallery = lazy(() => import("./components/pages/MascotGallery").then((module) => ({ default: module.MascotGallery })));
const isMascotGallery = window.location.pathname.replace(/\/+$/, "") === "/mascot";

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <ErrorBoundary>
      {isMascotGallery ? (
        <Suspense fallback={<div className="mascot-page-loading" role="status">正在布置形象馆…</div>}><MascotGallery /></Suspense>
      ) : <App />}
    </ErrorBoundary>
  </StrictMode>
);
