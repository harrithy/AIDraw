import type { StoredSettings } from "./providers/types";

/** DeepSeek 官方 Chat Completions API 的润写模型。 */
export type DeepSeekModel = "deepseek-v4-pro" | "deepseek-v4-flash";

export const DEEPSEEK_DEFAULT_MODEL: DeepSeekModel = "deepseek-v4-pro";

export const DEEPSEEK_MODEL_LABELS: Record<DeepSeekModel, string> = {
  "deepseek-v4-pro": "deepseek-v4-pro（质量优先）",
  "deepseek-v4-flash": "deepseek-v4-flash（更快更省）"
};

/** 思考强度：off=关闭思考模式，其余为思考模式下的推理强度。 */
export type DeepSeekThinkingLevel = "off" | "low" | "high" | "max";

export const DEEPSEEK_THINKING_LABELS: Record<DeepSeekThinkingLevel, string> = {
  off: "关闭",
  low: "低",
  high: "高（官方默认）",
  max: "最高"
};

const REQUEST_TIMEOUT_MS = 120 * 1000;

/** 生图提示词润写风格。 */
export type PromptPolishStyle = "enhance" | "concise" | "english";

export const PROMPT_POLISH_STYLE_LABELS: Record<PromptPolishStyle, string> = {
  enhance: "细节增强",
  concise: "更简洁",
  english: "翻译成英文"
};

/** 各润写风格对应的 system 提示词，要求模型只输出润写结果本身。 */
export const PROMPT_POLISH_STYLE_PROMPTS: Record<PromptPolishStyle, string> = {
  enhance:
    "你是专业的 AI 绘画提示词专家。请把用户输入的描述改写为更详细、更有画面感的绘画提示词：保留原语言与核心主体，补充画面细节、构图、光影、材质、风格和氛围，使描述更具体生动。只输出改写后的提示词，不要任何解释或前后缀。",
  concise:
    "你是专业的 AI 绘画提示词专家。请压缩用户输入中的冗余，保留核心主体与关键元素，输出更简洁有力的绘画提示词。只输出压缩后的提示词，不要任何解释或前后缀。",
  english:
    "你是专业的 AI 绘画提示词专家。请把用户输入翻译成英文，并润色为结构清晰、细节丰富的英文绘画提示词（用逗号分隔关键词，包含主体、场景、风格、光影等）。只输出英文提示词，不要任何解释或前后缀。"
};

/**
 * 查找可用的 DeepSeek API Key。
 * DeepSeek 不作为绘图供应商激活，Key 以 deepseek 平台身份保存在凭据列表中；
 * 兼容早期版本把 DeepSeek 设为当前平台的情况。
 */
export const getDeepSeekApiKey = (settings: StoredSettings): string | undefined => {
  if (settings.providerId === "deepseek" && settings.apiKey.trim()) return settings.apiKey.trim();
  const savedKeys = settings.savedApiKeys ?? [];
  const savedProviderIds = settings.savedApiKeyProviderIds ?? [];
  const savedIndex = savedProviderIds.findIndex(
    (providerId, index) => providerId === "deepseek" && Boolean(savedKeys[index]?.trim())
  );
  return savedIndex >= 0 ? savedKeys[savedIndex].trim() : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (!isRecord(payload)) return fallback;
  const error = isRecord(payload.error) ? payload.error : undefined;
  const message = [error?.message, payload.message].filter(
    (value): value is string => typeof value === "string" && Boolean(value.trim())
  )[0];
  return message ?? fallback;
};

/** 从 OpenAI 兼容的 chat completion 响应中提取 assistant 文本内容。 */
export const extractDeepSeekContent = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) return undefined;
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const message = isRecord(choices[0]) ? choices[0].message : undefined;
  if (!isRecord(message)) return undefined;
  const content = message.content;
  if (typeof content === "string") return content.trim() || undefined;
  if (Array.isArray(content)) {
    return (
      content
        .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim() || undefined
    );
  }
  return undefined;
};

/** 追加一段 SSE 文本，返回其中完整事件（data: 载荷）与未完成的行缓冲。 */
export const splitSseBuffer = (buffer: string, chunk: string): { events: string[]; rest: string } => {
  const combined = buffer + chunk;
  const lines = combined.split("\n");
  const rest = lines.pop() ?? "";
  const events: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    events.push(trimmed.slice(5).trim());
  }
  return { events, rest };
};

/** 解析一条 SSE data 载荷，返回本次增量文本（[DONE] 或非 delta 内容返回空串）。 */
export const parseSseDelta = (data: string): string => {
  if (!data || data === "[DONE]") return "";
  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: unknown } }>;
    };
    const content = parsed?.choices?.[0]?.delta?.content;
    return typeof content === "string" ? content : "";
  } catch {
    return "";
  }
};

/**
 * 调用 DeepSeek 官方 API 流式润写文本。
 * 浏览器不直连 api.deepseek.com（官方接口未开放浏览器 CORS），
 * 统一通过同源无服务器函数 /api/deepseek-chat 转发；
 * 请求开启 stream: true，返回 SSE 增量，通过 onDelta 逐字回填。
 */
export const polishWithDeepSeek = async ({
  text,
  apiKey,
  style = "enhance",
  model = DEEPSEEK_DEFAULT_MODEL,
  thinking = "high",
  temperature = 1,
  onDelta
}: {
  text: string;
  apiKey: string;
  style?: PromptPolishStyle;
  model?: DeepSeekModel;
  /** 思考强度；off 表示关闭思考模式。思考模式下官方不支持 temperature，将自动忽略。 */
  thinking?: DeepSeekThinkingLevel;
  temperature?: number;
  onDelta?: (delta: string) => void;
}): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const thinkingEnabled = thinking !== "off";
  let response: Response;
  try {
    response = await fetch("/api/deepseek-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        model,
        messages: [
          { role: "system", content: PROMPT_POLISH_STYLE_PROMPTS[style] ?? PROMPT_POLISH_STYLE_PROMPTS.enhance },
          { role: "user", content: text }
        ],
        max_tokens: 4096,
        stream: true,
        ...(thinkingEnabled
          ? { thinking: { type: "enabled" }, reasoning_effort: thinking }
          : { thinking: { type: "disabled" }, temperature })
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("AI 提示词润写超时，请稍后重试");
    }
    if (error instanceof TypeError) {
      throw new Error("调用 DeepSeek 润写失败：网络不可达，或部署环境不支持 /api/deepseek-chat");
    }
    throw error;
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getErrorMessage(payload, `AI 提示词润写失败：HTTP ${response.status}`));
  }
  if (!response.body) throw new Error("DeepSeek 未返回润写数据流");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const { events, rest } = splitSseBuffer(buffer, decoder.decode(value, { stream: true }));
      buffer = rest;
      for (const event of events) {
        const delta = parseSseDelta(event);
        if (delta) {
          content += delta;
          onDelta?.(delta);
        }
      }
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error("AI 提示词润写超时，请稍后重试");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!content.trim()) throw new Error("DeepSeek 未返回润写结果");
  return content;
};

