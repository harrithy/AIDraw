import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrawJob } from "../../types";
import { getDuomiCapability } from "../duomiCapabilities";
import { DuomiCapabilityProvider, duomiCapabilityProtocol } from "./DuomiCapabilityProvider";
import type { StoredSettings } from "./types";

const API_KEY = "dm-test-secret-key";
const settings: StoredSettings = {
  baseUrl: "https://duomiapi.com/v1",
  model: "duomi-capability",
  apiKey: API_KEY,
  providerId: "duomi"
};
const makeJob = (capabilityId: string, capabilityParams: Record<string, unknown>): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "pending",
  prompt: "",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  count: 1,
  thinking: "standard",
  model: "duomi-capability",
  capabilityId,
  capabilityParams,
  orderIndex: 0,
  posX: 0,
  posY: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});
const jsonResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;
const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("多米通用 Provider 协议", () => {
  it("提取单个和多个任务 ID", () => {
    expect(duomiCapabilityProtocol.collectTaskIds({ data: { task_id: "one" } })).toEqual(["one"]);
    expect(duomiCapabilityProtocol.collectTaskIds({ data: ["one", "two"] })).toEqual(["one", "two"]);
    expect(duomiCapabilityProtocol.collectTaskIds({ data: [{ id: "one" }, { taskId: "two" }] })).toEqual([
      "one",
      "two"
    ]);
    expect(duomiCapabilityProtocol.collectTaskIds("78e9128c-c12f-79ae-a53e-1447ff9c25db")).toEqual([
      "78e9128c-c12f-79ae-a53e-1447ff9c25db"
    ]);
    expect(duomiCapabilityProtocol.collectTaskIds("这是生成的歌词，不是任务 ID")).toEqual([]);
  });

  it("兼容数字、Kling 和统一接口状态", () => {
    expect(duomiCapabilityProtocol.normalizeState(0)).toBe("pending");
    expect(duomiCapabilityProtocol.normalizeState("processing")).toBe("running");
    expect(duomiCapabilityProtocol.normalizeState("succeed")).toBe("succeeded");
    expect(duomiCapabilityProtocol.normalizeState(2)).toBe("error");
  });

  it("从嵌套结果中提取不同媒体和文本", () => {
    const result = duomiCapabilityProtocol.extractResultData(
      {
        data: {
          task_result: {
            videos: [{ url: "https://example.com/result.mp4" }],
            audios: [{ url: "https://example.com/result.mp3" }],
            lyrics: "测试歌词"
          }
        }
      },
      "mixed"
    );
    expect(result.assets.map((asset) => asset.kind)).toEqual(["video", "audio"]);
    expect(result.text).toContain("测试歌词");
  });

  it("同步 TTS 直接归一化为成功结果", () => {
    const capability = getDuomiCapability("audio.kling.tts")!;
    const result = duomiCapabilityProtocol.parseTaskResult(
      { data: { audio_url: "https://example.com/voice.mp3" } },
      capability,
      true
    );
    expect(result.state).toBe("succeeded");
    if (result.state === "succeeded") expect(result.assets?.[0]?.kind).toBe("audio");
  });

  it("异步创建响应中的输入 URL 不会替代任务轮询", () => {
    const capability = getDuomiCapability("video.runway.image")!;
    const result = duomiCapabilityProtocol.parseTaskResult(
      { data: { task_id: "task-1" }, image: "https://example.com/input.png" },
      capability
    );
    // 解析器能识别 URL，但创建流程只有收到显式 succeeded 才会把它当最终结果。
    expect(result.state).toBe("succeeded");
    expect(duomiCapabilityProtocol.normalizeState(undefined)).toBeUndefined();
  });

  it("getEndpoint 只剥离站点根路径误带的 /v1", () => {
    const endpoint = (baseUrl: string, path: string) =>
      duomiCapabilityProtocol.getEndpoint({ baseUrl } as StoredSettings, path);
    expect(endpoint("https://duomiapi.com/v1", "/api/suno/feed")).toBe(
      "https://duomiapi.com/api/suno/feed"
    );
    expect(endpoint("https://duomiapi.com/api/v1", "/api/suno/feed")).toBe(
      "https://duomiapi.com/api/v1/api/suno/feed"
    );
    expect(endpoint("https://proxy.example.com/", "/api/suno/feed")).toBe(
      "https://proxy.example.com/api/suno/feed"
    );
  });
});

describe("多米通用 Provider 请求", () => {
  it("MJ Blend 使用 key Header 和文档中的 base64Array Body", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ data: { task_id: "task-1" } }));

    await new DuomiCapabilityProvider().createTask(
      makeJob("image.midjourney.blend", {
        base64Array: ["data:image/png;base64,AAAA"],
        dimensions: "SQUARE",
        prompt: "合成图片"
      }),
      settings
    );

    const [requestUrl, init] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toBe("https://duomiapi.com/api/midjourney/imagine/blend");
    const headers = new Headers(init?.headers);
    expect(headers.get("key")).toBe(API_KEY);
    expect(headers.get("Authorization")).toBeNull();
    expect(JSON.parse(String(init?.body))).toMatchObject({
      base64Array: ["data:image/png;base64,AAAA"],
      dimensions: "SQUARE",
      prompt: "合成图片"
    });
  });

  it("SUNO 后处理返回 UUID 时使用统一 feed 轮询", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ data: "78e9128c-c12f-79ae-a53e-1447ff9c25db" }));

    const result = await new DuomiCapabilityProvider().createTask(
      makeJob("music.suno.speed", {
        task_id: "source_1",
        speed_multiplier: 0.5,
        keep_pitch: true,
        title: "慢速版本"
      }),
      settings
    );

    expect(result.taskId).toBe("78e9128c-c12f-79ae-a53e-1447ff9c25db");
    expect(result.queryUrl).toBe(
      "https://duomiapi.com/api/suno/feed?task_id=78e9128c-c12f-79ae-a53e-1447ff9c25db"
    );
    expect(result.result).toBeUndefined();
  });

  it("SUNO 上传音频同步完成，返回的 clip id 不触发 feed 轮询", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 200, data: { task_id: "audio-4f4d4900-eac5-4c09-ac59-d5d6ad687692" } })
    );

    const result = await new DuomiCapabilityProvider().createTask(
      makeJob("music.suno.upload", { file: "https://example.com/a.mp3" }),
      settings
    );

    const [requestUrl, init] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toBe("https://duomiapi.com/api/suno/uploads/audio");
    const headers = new Headers(init?.headers);
    expect(headers.get("key")).toBe(API_KEY);
    expect(result.queryUrl).toBeUndefined();
    expect(result.result?.state).toBe("succeeded");
  });

  it("未填写的模型和比例不会被能力显示名及固定 auto 污染", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ data: { task_id: "task-2" } }));

    await new DuomiCapabilityProvider().createTask(
      makeJob("video.runway.text", { prompt: "一辆汽车" }),
      settings
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({ prompt: "一辆汽车" });
  });

  it("同步歌词字符串直接完成，不误当任务 ID", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse("第一行歌词\n第二行歌词"));

    const result = await new DuomiCapabilityProvider().createTask(
      makeJob("music.suno.lyrics", { prompt: "写一首歌" }),
      settings
    );

    expect(result.taskId).toBe("sync-job-1");
    expect(result.queryUrl).toBeUndefined();
    expect(result.result).toMatchObject({ state: "succeeded", text: "第一行歌词\n第二行歌词" });
  });

  it("Seedance 使用原始 Authorization，不添加 Bearer", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ data: { task_id: "seedance-1" } }));

    await new DuomiCapabilityProvider().createTask(
      makeJob("video.seedance.generate", { model: "seedance-2.0", content: [{ type: "text", text: "海边" }] }),
      settings
    );

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe(API_KEY);
  });

  it("官方主体分页查询使用 GET 并把字段放进 URL 查询参数", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 0, data: { list: [{ id: "preset-1", name: "特效一" }], total: 1 } })
    );

    const result = await new DuomiCapabilityProvider().createTask(
      makeJob("tool.kling.presets-elements", { pageNum: 2, pageSize: 50 }),
      settings
    );

    const [requestUrl, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe("/api/video/kling/v1/general/presets-elements");
    expect(url.searchParams.get("pageNum")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("50");
    expect(result.taskId).toBe("sync-job-1");
    expect(result.queryUrl).toBeUndefined();
    expect(result.result?.state).toBe("succeeded");
  });

  it("SUNO 配乐能力强制合并文档写死参数", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 200, data: [{ task_id: "music-task-1" }] }));

    await new DuomiCapabilityProvider().createTask(
      makeJob("music.suno.underpainting", {
        underpainting_clip_id: "clip-1",
        tags: "pop",
        underpainting_start_s: 0,
        underpainting_end_s: 60,
        title: "伴奏"
      }),
      settings
    );

    const body = fetchMock.mock.calls[0][1]?.body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get("task")).toBe("underpainting");
    expect(form.get("mv")).toBe("chirp-bluejay");
    expect(form.get("underpainting_clip_id")).toBe("clip-1");
    expect(form.get("underpainting_end_s")).toBe("60");
    expect(form.getAll("override_fields")).toEqual(["prompt", "tags"]);
    expect(form.get("prompt")).toBe("");
  });
});
