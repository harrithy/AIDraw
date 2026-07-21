import type { DrawJob } from "../../types";
import { dimensionsFromSize } from "../imageDimensions";
import type { CreatedProviderTask, ImageModelProvider, ProviderTaskResult, StoredSettings } from "./types";

const hashText = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const paletteFromPrompt = (prompt: string) => {
  const hash = hashText(prompt);
  const hueA = hash % 360;
  const hueB = (hueA + 74 + (hash % 40)) % 360;
  const hueC = (hueA + 176 + (hash % 80)) % 360;

  return {
    a: `hsl(${hueA}, 70%, 46%)`,
    b: `hsl(${hueB}, 62%, 58%)`,
    c: `hsl(${hueC}, 68%, 30%)`
  };
};

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");

export class MockProvider implements ImageModelProvider {
  async createTask(_job: DrawJob, _settings: StoredSettings): Promise<CreatedProviderTask> {
    const taskId = `mock-task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return { taskId };
  }

  async queryTask(taskId: string, job: DrawJob, _settings: StoredSettings): Promise<ProviderTaskResult> {
    await new Promise((resolve) => window.setTimeout(resolve, 1100 + Math.floor(Math.random() * 900)));

    const { width, height } = dimensionsFromSize(job.size || "auto");
    const palette = paletteFromPrompt(`${job.prompt}-${taskId}`);
    const modeLabel = job.mode === "image-to-image" ? "图生图" : "文生图";
    const prompt = escapeXml(job.prompt || "Untitled prompt");

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${palette.a}"/>
      <stop offset="52%" stop-color="${palette.b}"/>
      <stop offset="100%" stop-color="${palette.c}"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.2"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" filter="url(#grain)" opacity="0.28"/>
  <circle cx="${width * 0.22}" cy="${height * 0.2}" r="${Math.min(width, height) * 0.24}" fill="rgba(255,255,255,0.2)"/>
  <circle cx="${width * 0.82}" cy="${height * 0.76}" r="${Math.min(width, height) * 0.32}" fill="rgba(0,0,0,0.18)"/>
  <path d="M ${width * 0.06} ${height * 0.75} C ${width * 0.26} ${height * 0.48}, ${width * 0.42} ${height * 0.94}, ${width * 0.62} ${height * 0.55} S ${width * 0.84} ${height * 0.4}, ${width * 0.96} ${height * 0.28}" fill="none" stroke="rgba(255,255,255,0.42)" stroke-width="${Math.max(6, width * 0.018)}" stroke-linecap="round"/>
  <rect x="${width * 0.08}" y="${height * 0.08}" width="${width * 0.84}" height="${height * 0.84}" rx="24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
  <text x="${width * 0.1}" y="${height * 0.18}" fill="white" font-family="Georgia, serif" font-size="${Math.max(24, width * 0.06)}" font-weight="700">${modeLabel}</text>
  <text x="${width * 0.1}" y="${height * 0.28}" fill="rgba(255,255,255,0.88)" font-family="Segoe UI, sans-serif" font-size="${Math.max(14, width * 0.03)}">Browser mock output</text>
  <foreignObject x="${width * 0.1}" y="${height * 0.38}" width="${width * 0.78}" height="${height * 0.28}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font: 600 ${Math.max(15, width * 0.032)}px 'Segoe UI', sans-serif; color: white; line-height: 1.35; word-break: break-word;">
      ${prompt}
    </div>
  </foreignObject>
</svg>`.trim();

    return {
      state: "succeeded",
      imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    };
  }
}
