import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredSettings } from "./providers/types";
import {
  extractDeepSeekContent,
  getDeepSeekApiKey,
  parseSseDelta,
  polishWithDeepSeek,
  splitSseBuffer
} from "./deepseekApi";

const makeSettings = (overrides: Partial<StoredSettings> = {}): StoredSettings => ({
  baseUrl: "https://duomiapi.com",
  model: "gpt-image-2",
  apiKey: "",
  providerId: "duomi",
  ...overrides
});

/** 构造按顺序产出指定文本 chunk 的流式 Response（不依赖 happy-dom 的流实现）。 */
const streamResponse = (chunks: string[]): Response => {
  let index = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () =>
          index < chunks.length
            ? Promise.resolve({ done: false, value: new TextEncoder().encode(chunks[index++]) })
            : Promise.resolve({ done: true, value: undefined })
      })
    }
  } as unknown as Response;
};

const errorResponse = (body: unknown, status: number): Response =>
  ({
    ok: false,
    status,
    json: () => Promise.resolve(body)
  }) as unknown as Response;

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("polishWithDeepSeek（流式）", () => {
  it("默认思考开启（high）且支持模型覆盖，逐段解析 SSE 并累计内容与回调增量", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"一只"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"橘猫"}}]}\n\n',
        "data: [DONE]\n\n"
      ])
    );

    const deltas: string[] = [];
    const polished = await polishWithDeepSeek({
      text: "橘猫",
      apiKey: "sk-deepseek-test",
      style: "english",
      model: "deepseek-v4-flash",
      thinking: "max",
      onDelta: (delta) => deltas.push(delta)
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/deepseek-chat");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });

    const body = JSON.parse(String(init?.body)) as {
      apiKey: string;
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
      thinking: { type: string };
      reasoning_effort: string;
      temperature?: number;
    };
    expect(body.apiKey).toBe("sk-deepseek-test");
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.stream).toBe(true);
    expect(body.thinking).toEqual({ type: "enabled" });
    expect(body.reasoning_effort).toBe("max");
    expect(body.temperature).toBeUndefined();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[0].content).toContain("英文");
    expect(body.messages[1]).toEqual({ role: "user", content: "橘猫" });

    expect(polished).toBe("一只橘猫");
    expect(deltas).toEqual(["一只", "橘猫"]);
  });

  it("思考模式关闭时发送 thinking disabled 并启用 temperature", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(streamResponse(["data: [DONE]\n\n"]));

    await expect(
      polishWithDeepSeek({ text: "橘猫", apiKey: "sk-deepseek-test", style: "concise", thinking: "off" })
    ).rejects.toThrow("未返回润写结果");

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as {
      thinking: { type: string };
      reasoning_effort?: string;
      temperature?: number;
    };
    expect(url).toBe("/api/deepseek-chat");
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.temperature).toBe(1);
  });

  it("上游错误时透出 DeepSeek 错误信息", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      errorResponse({ error: { message: "Authentication Fails, Your api key is invalid" } }, 401)
    );

    await expect(
      polishWithDeepSeek({ text: "测试", apiKey: "sk-invalid", style: "enhance" })
    ).rejects.toThrow("Authentication Fails");
  });

  it("流结束仍无内容时报错", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(streamResponse(["data: [DONE]\n\n"]));

    await expect(
      polishWithDeepSeek({ text: "测试", apiKey: "sk-deepseek-test", style: "concise" })
    ).rejects.toThrow("未返回润写结果");
  });
});

describe("SSE 解析", () => {
  it("splitSseBuffer 提取完整 data 事件并保留未完成缓冲", () => {
    expect(splitSseBuffer("", 'data: {"a":1}\n\n')).toEqual({ events: ['{"a":1}'], rest: "" });
    expect(splitSseBuffer('data: {"a":1}\n', 'data: {"b":2}\n')).toEqual({
      events: ['{"a":1}', '{"b":2}'],
      rest: ""
    });
    // 跨 chunk 的行缓冲保留在 rest 中
    const partial = splitSseBuffer("", 'data: {"a"');
    expect(partial.events).toEqual([]);
    expect(partial.rest).toBe('data: {"a"');
  });

  it("parseSseDelta 提取 delta.content 并忽略 DONE/非 delta", () => {
    expect(parseSseDelta('{"choices":[{"delta":{"content":"你好"}}]}')).toBe("你好");
    expect(parseSseDelta("[DONE]")).toBe("");
    expect(parseSseDelta("")).toBe("");
    expect(parseSseDelta('{"choices":[{"delta":{"content":""}}]}')).toBe("");
    expect(parseSseDelta("not-json")).toBe("");
  });
});

describe("getDeepSeekApiKey", () => {
  it("优先使用当前平台为 deepseek 的激活 Key，其次查找凭据列表中的 deepseek Key", () => {
    expect(
      getDeepSeekApiKey(
        makeSettings({
          providerId: "deepseek",
          apiKey: "sk-active-deepseek",
          savedApiKeys: ["sk-active-deepseek"],
          savedApiKeyProviderIds: ["deepseek"]
        })
      )
    ).toBe("sk-active-deepseek");

    expect(
      getDeepSeekApiKey(
        makeSettings({
          providerId: "duomi",
          apiKey: "sk-duomi-key",
          savedApiKeys: ["sk-duomi-key", "sk-polish-key"],
          savedApiKeyProviderIds: ["duomi", "deepseek"]
        })
      )
    ).toBe("sk-polish-key");
  });

  it("没有配置 DeepSeek Key 时返回 undefined", () => {
    expect(
      getDeepSeekApiKey(
        makeSettings({
          savedApiKeys: ["sk-duomi-key"],
          savedApiKeyProviderIds: ["duomi"]
        })
      )
    ).toBeUndefined();
  });
});

describe("extractDeepSeekContent", () => {
  it("从 OpenAI 兼容响应中提取 assistant 内容，兼容分片数组", () => {
    expect(extractDeepSeekContent({ choices: [{ message: { content: "文本" } }] })).toBe("文本");
    expect(extractDeepSeekContent({ choices: [{ message: { content: [{ text: "A" }, { text: "B" }] } }] })).toBe("AB");
    expect(extractDeepSeekContent({ choices: [{ message: { content: "  " } }] })).toBeUndefined();
    expect(extractDeepSeekContent(null)).toBeUndefined();
  });
});
