import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrawJob } from "../../types";
import { KlingProvider } from "./KlingProvider";
import type { StoredSettings } from "./types";

const API_KEY = "dm-test-secret-key";

const makeSettings = (overrides: Partial<StoredSettings> = {}): StoredSettings => ({
  baseUrl: "https://duomiapi.com/",
  model: "kling-v3",
  apiKey: API_KEY,
  providerId: "duomi",
  ...overrides
});

const makeJob = (overrides: Partial<DrawJob> = {}): DrawJob => ({
  id: "job-1",
  folderId: "folder-1",
  mode: "text-to-image",
  status: "pending",
  prompt: "  一只猫在沙滩上跑步  ",
  negativePrompt: "",
  width: 1024,
  height: 576,
  count: 1,
  thinking: "medium",
  model: "kling-v3",
  orderIndex: 0,
  posX: 0,
  posY: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

const jsonResponse = (body: unknown, init: { ok?: boolean; status?: number } = {}): Response =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body)
  }) as unknown as Response;

const fetchMock = vi.fn<typeof fetch>();

const provider = new KlingProvider();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
});

describe("KlingProvider.createTask", () => {
  it("无输入图时请求 text2video 端点，Authorization 不带 Bearer，body 含全部必填字段", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_id: "task-1" } }));

    const result = await provider.createTask(makeJob(), makeSettings());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/video/kling/v1/videos/text2video");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(API_KEY);
    expect(headers.get("Authorization")).not.toContain("Bearer");

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model_name: "kling-v3",
      prompt: "一只猫在沙滩上跑步",
      mode: "std",
      aspect_ratio: "16:9",
      duration: 5,
      cfg_scale: 0.5,
      sound: "off"
    });
    expect(body.image).toBeUndefined();
    expect(body.image_list).toBeUndefined();

    expect(result.taskId).toBe("task-1");
    expect(result.queryUrl).toContain("/api/video/kling/v1/videos/text2video/task-1");
  });

  it("thinking=high 映射 mode=pro，自定义 duration/size 如实传递", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_id: "task-2" } }));

    await provider.createTask(
      makeJob({ thinking: "high", duration: 10, size: "9:16", sound: "on" }),
      makeSettings({ baseUrl: "https://my-proxy.com" })
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://my-proxy.com/api/video/kling/v1/videos/text2video");
    const body = JSON.parse(String(init?.body));
    expect(body.mode).toBe("pro");
    expect(body.duration).toBe(10);
    expect(body.aspect_ratio).toBe("9:16");
    expect(body.sound).toBe("on");
  });

  it("aspect_ratio 不含冒号时回退为 16:9", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_id: "task-3" } }));

    await provider.createTask(makeJob({ size: "1024x1024" }), makeSettings());

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.aspect_ratio).toBe("16:9");
  });

  it("1 张输入图走 image2video 端点，body 含 image 字段", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_id: "task-img" } }));

    const result = await provider.createTask(
      makeJob({ inputImageUrl: "https://img.example.com/ref.png" }),
      makeSettings()
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/video/kling/v1/videos/image2video");
    const body = JSON.parse(String(init?.body));
    expect(body.image).toBe("https://img.example.com/ref.png");
    expect(body.image_list).toBeUndefined();
    expect(result.queryUrl).toContain("/api/video/kling/v1/videos/image2video/task-img");
  });

  it("inputImageUrl 为空数组但 inputImageUrl 有值时按单图处理", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_id: "task-img" } }));

    await provider.createTask(
      makeJob({ inputImageUrls: [], inputImageUrl: "https://img.example.com/ref.png" }),
      makeSettings()
    );

    expect(String(fetchMock.mock.calls[0][0])).toContain("/image2video");
  });

  it("多张输入图走 multi-image2video 端点，body 含 image_list 数组", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_id: "task-multi" } }));

    const result = await provider.createTask(
      makeJob({
        inputImageUrls: ["https://img.example.com/a.png", "https://img.example.com/b.png"]
      }),
      makeSettings()
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/video/kling/v1/videos/multi-image2video");
    const body = JSON.parse(String(init?.body));
    expect(body.image_list).toEqual([
      { image: "https://img.example.com/a.png" },
      { image: "https://img.example.com/b.png" }
    ]);
    expect(body.image).toBeUndefined();
    expect(result.queryUrl).toContain("/api/video/kling/v1/videos/multi-image2video/task-multi");
  });

  it("data URL 参考图直接抛错（中文提示）", async () => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      provider.createTask(
        makeJob({ inputImageUrl: "data:image/png;base64,iVBORw0KGgo=" }),
        makeSettings()
      )
    ).rejects.toThrow(/公网/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("本地相对路径参考图抛错", async () => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      provider.createTask(makeJob({ inputImageUrls: ["/images/local.png"] }), makeSettings())
    ).rejects.toThrow(/公网/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("响应缺少 task_id 时抛错", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: {} }));

    await expect(provider.createTask(makeJob(), makeSettings())).rejects.toThrow(/任务 id/);
  });

  it("响应为普通对象但无 data 时抛错", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 1 }));

    await expect(provider.createTask(makeJob(), makeSettings())).rejects.toThrow(/任务 id/);
  });

  it("响应有 message 但无 task_id 时仍抛错（错误信息为响应 message，属于实现现状）", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, message: "SUCCEED", data: {} }));

    await expect(provider.createTask(makeJob(), makeSettings())).rejects.toThrow();
  });

  it("HTTP 500 时抛出含状态码的中文错误", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse(null, { ok: false, status: 500 }));

    await expect(provider.createTask(makeJob(), makeSettings())).rejects.toThrow(/提交 Kling 视频生成任务失败：HTTP 500/);
  });

  it("HTTP 400 时优先提取响应体里的 message", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: "model unavailable", code: "MODEL", type: "invalid_request_error" } }, { ok: false, status: 400 })
    );

    await expect(provider.createTask(makeJob(), makeSettings())).rejects.toThrow(/model unavailable/);
  });

  it("fetch 超时（AbortError）时抛出中文超时提示", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          })
      )
    );

    const promise = provider.createTask(makeJob(), makeSettings());
    const expectation = expect(promise).rejects.toThrow(/超时，请稍后重试/);
    await vi.advanceTimersByTimeAsync(60 * 1000);
    await expectation;
  });
});

describe("KlingProvider.queryTask", () => {
  it("task_status=succeed 且有视频地址时返回 succeeded", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse({
        code: 0,
        data: {
          task_status: "succeed",
          task_result: {
            videos: [{ id: "v1", url: "https://cdn.example.com/output.mp4", duration: "5" }]
          }
        }
      })
    );

    const job = makeJob({ queryUrl: "https://duomiapi.com/api/video/kling/v1/videos/text2video/task-1" });
    const result = await provider.queryTask("task-1", job, makeSettings());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(job.queryUrl);
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(API_KEY);
    expect(result).toEqual({ state: "succeeded", imageUrl: "https://cdn.example.com/output.mp4" });
  });

  it("task_status=succeed 但 videos 为空时抛错", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 0, data: { task_status: "succeed", task_result: { videos: [] } } })
    );

    await expect(provider.queryTask("task-1", makeJob(), makeSettings())).rejects.toThrow(
      /未返回视频地址/
    );
  });

  it("task_status=succeed 但 videos 内 url 均为空字符串时抛错", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse({
        code: 0,
        data: { task_status: "succeed", task_result: { videos: [{ id: "v1", url: "", duration: "5" }] } }
      })
    );

    await expect(provider.queryTask("task-1", makeJob(), makeSettings())).rejects.toThrow(
      /未返回视频地址/
    );
  });

  it.each([
    { status: "failed", source: "task_status_msg" },
    { status: "fail", source: "data.message" },
    { status: "error", source: "top.message" }
  ])("task_status=$status 且带 $source 时返回 error（错误信息优先取 task_status_msg）", async ({ status, source }) => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse({
        code: 0,
        message: "外层 message",
        data: {
          task_status: status,
          task_status_msg: "可灵任务失败：token 不足",
          message: "data 层 message"
        }
      })
    );

    const result = await provider.queryTask("task-1", makeJob(), makeSettings());
    expect(result.state).toBe("error");
    if (result.state === "error") {
      expect(result.errorMessage).toBe("可灵任务失败：token 不足");
      expect(result.errorMessage).not.toContain(source);
    }
  });

  it("failed 但无任何可读信息时使用 fallback 文案（含 taskId）", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_status: "failed" } }));

    const result = await provider.queryTask("task-abc", makeJob(), makeSettings());
    expect(result.state).toBe("error");
    if (result.state === "error") {
      expect(result.errorMessage).toContain("task-abc");
    }
  });

  it.each(["submitted", "processing", "queued", "unknown-status"])(
    "未知状态 %s 保守返回 pending",
    async (taskStatus) => {
      vi.stubGlobal("fetch", fetchMock);
      fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_status: taskStatus } }));

      const result = await provider.queryTask("task-1", makeJob(), makeSettings());
      expect(result).toEqual({ state: "pending" });
    }
  );

  it("HTTP 非 2xx 时抛错且错误信息含状态码", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse(null, { ok: false, status: 401 }));

    await expect(provider.queryTask("task-1", makeJob(), makeSettings())).rejects.toThrow(/401/);
  });

  it("HTTP 非 2xx 时优先提取响应体里的 message", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: "invalid api key", code: "AUTH", type: "invalid_request_error" } }, { ok: false, status: 403 })
    );

    await expect(provider.queryTask("task-1", makeJob(), makeSettings())).rejects.toThrow(
      /invalid api key/
    );
  });

  it("HTTP 200 但顶层 code 非 0 时返回 error（错误信息取顶层 message）", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 1, message: "任务不存在或已失效" }));

    const result = await provider.queryTask("task-1", makeJob(), makeSettings());
    expect(result).toEqual({ state: "error", errorMessage: "任务不存在或已失效" });
  });

  it("HTTP 200 但顶层 code 非 0 且 data 存在时仍按 API 级错误处理", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 4001, data: { task_status: "succeed" } }));

    const result = await provider.queryTask("task-1", makeJob(), makeSettings());
    expect(result.state).toBe("error");
    if (result.state === "error") {
      expect(result.errorMessage).toBe("Kling 任务查询失败");
    }
  });

  it("HTTP 200 但缺少 data 时返回 error（fallback 文案）", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0 }));

    const result = await provider.queryTask("task-1", makeJob(), makeSettings());
    expect(result.state).toBe("error");
    if (result.state === "error") {
      expect(result.errorMessage).toBe("Kling 任务查询失败");
    }
  });

  it("code=0 且 message=SUCCEED 时正常 task_status 不受影响", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, message: "SUCCEED", data: { task_status: "processing" } }));

    const result = await provider.queryTask("task-1", makeJob(), makeSettings());
    expect(result).toEqual({ state: "pending" });
  });

  it("无 queryUrl 时文生任务回退用 text2video 查询 URL", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_status: "processing" } }));

    await provider.queryTask("task-t", makeJob(), makeSettings());

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://duomiapi.com/api/video/kling/v1/videos/text2video/task-t"
    );
  });

  it("无 queryUrl 时 1 张输入图回退用 image2video 查询 URL", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_status: "processing" } }));

    await provider.queryTask("task-img", makeJob({ inputImageUrl: "https://img.example.com/ref.png" }), makeSettings());

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://duomiapi.com/api/video/kling/v1/videos/image2video/task-img"
    );
  });

  it("无 queryUrl 时多张输入图回退用 multi-image2video 查询 URL", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_status: "processing" } }));

    await provider.queryTask(
      "task-multi",
      makeJob({ inputImageUrls: ["https://img.example.com/a.png", "https://img.example.com/b.png"] }),
      makeSettings()
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://duomiapi.com/api/video/kling/v1/videos/multi-image2video/task-multi"
    );
  });

  it("无 queryUrl 时 taskId 中的特殊字符会被编码", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ code: 0, data: { task_status: "processing" } }));

    await provider.queryTask("task 1/2", makeJob(), makeSettings());

    expect(String(fetchMock.mock.calls[0][0])).toContain("/text2video/task%201%2F2");
  });
});