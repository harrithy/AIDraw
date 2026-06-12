import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

gsap.registerPlugin(useGSAP);

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

