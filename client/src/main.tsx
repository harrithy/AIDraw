/**
 * 应用入口文件
 * 注册 GSAP React 插件，挂载 React 应用到 #root DOM 节点
 * 使用 StrictMode 开启 React 开发模式下的额外检查
 */
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// 注册 GSAP React hook 插件，使 useGSAP 可在组件中使用
gsap.registerPlugin(useGSAP);

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);