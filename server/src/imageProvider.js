import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { nanoid } from "nanoid";
import { generatedDir, getImageProviderSettings } from "./db.js";
import { simulateDrawing } from "./mockImage.js";

config({ path: join(process.cwd(), ".env") });

const NOWCODING_BASE_URL = process.env.NOWCODING_BASE_URL ?? "https://nowcoding.ai/v1";
const NOWCODING_API_KEY = process.env.NOWCODING_API_KEY ?? "";
const NOWCODING_IMAGE_MODEL = process.env.NOWCODING_IMAGE_MODEL ?? "gpt-image-2";

const getResolvedSettings = () => {
  const saved = getImageProviderSettings();
  return {
    baseUrl: saved.baseUrl || NOWCODING_BASE_URL,
    apiKey: saved.apiKey || NOWCODING_API_KEY,
    model: saved.model || NOWCODING_IMAGE_MODEL,
    saved
  };
};

const normalizeBase64 = (value) => {
  const raw = String(value ?? "").trim();
  const marker = ";base64,";
  const markerIndex = raw.indexOf(marker);
  return markerIndex >= 0 ? raw.slice(markerIndex + marker.length) : raw;
};

const extractBase64Image = (payload) => {
  const candidates = [
    payload?.data?.[0]?.b64_json,
    payload?.data?.[0]?.b64Json,
    payload?.output?.[0]?.b64_json,
    payload?.output?.[0]?.b64Json,
    payload?.b64_json,
    payload?.b64Json
  ];

  const b64 = candidates.find((value) => typeof value === "string" && value.trim());
  if (!b64) {
    throw new Error("Nowcoding response did not include b64_json");
  }
  return normalizeBase64(b64);
};

const buildPrompt = (job) => {
  return job.prompt.trim();
};

const callNowcodingGeneration = async (job, settings) => {
  const response = await fetch(`${settings.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: job.model || settings.model,
      prompt: buildPrompt(job),
      size: "auto",
      n: 1,
      thinking: job.thinking || "high",
      response_format: "b64_json"
    }),
    signal: AbortSignal.timeout(600_000)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `Nowcoding image generation failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  const imageBuffer = Buffer.from(extractBase64Image(payload), "base64");
  if (imageBuffer.byteLength === 0) {
    throw new Error("Nowcoding returned an empty image payload");
  }

  const fileName = `${job.id}-${nanoid(6)}.png`;
  writeFileSync(join(generatedDir, fileName), imageBuffer);
  return `/uploads/generated/${fileName}`;
};

export const getImageProviderStatus = () => {
  const settings = getResolvedSettings();
  return {
    textToImage: settings.apiKey ? "nowcoding" : "mock",
    imageToImage: "mock",
    hasNowcodingKey: Boolean(settings.apiKey),
    nowcodingBaseUrl: settings.baseUrl,
    nowcodingModel: settings.model,
    apiKeyMasked:
      settings.saved.apiKeyMasked ||
      (NOWCODING_API_KEY ? `${NOWCODING_API_KEY.slice(0, 4)}...${NOWCODING_API_KEY.slice(-4)}` : ""),
    usesSavedConfig: Boolean(settings.saved.baseUrl || settings.saved.apiKey || settings.saved.model)
  };
};

export const generateDrawing = async (job) => {
  const settings = getResolvedSettings();
  if (settings.apiKey && job.mode === "text-to-image") {
    return callNowcodingGeneration(job, settings);
  }

  return simulateDrawing(job);
};
