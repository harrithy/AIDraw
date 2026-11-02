import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrawJob } from "../../types";
import { createCustomProviderTemplate } from "../customProviders";
import { createCredentialId } from "../jobCredentials";
import { CustomProvider, parseCustomResult } from "./CustomProvider";
import { getProviderForJob } from "./providerRegistry";
import type { StoredSettings } from "./types";

const config = { ...createCustomProviderTemplate(), baseUrl: "https://relay.example", models: ["my-model"] };
const settings: StoredSettings = { baseUrl: "https://duomiapi.com", providerId: "duomi", model: "gpt-image-2", apiKey: "other-key", customProviders: [{ config, apiKey: "relay-key" }] };
const job = (patch: Partial<DrawJob> = {}) => ({ id: "job", prompt: "cat", model: "my-model", customProviderId: config.id, customProviderConfig: config, size: "1024x1024", width: 1024, height: 1024, ...patch }) as DrawJob;

afterEach(() => vi.unstubAllGlobals());

describe("CustomProvider 真实协议适配", () => {
  it("同步结果生成多个媒体资产，并且使用绑定的中转 Key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ url: "https://cdn.example/a.png" }, { url: "https://cdn.example/b.png" }] })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new CustomProvider().createTask(job(), settings);
    expect(result.result).toMatchObject({ state: "succeeded", assets: [{ kind: "image", url: "https://cdn.example/a.png" }, { kind: "image", url: "https://cdn.example/b.png" }] });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).toMatchObject({ url: "https://relay.example/v1/images/generations", headers: { Authorization: "Bearer relay-key" }, body: { prompt: "cat", model: "my-model" } });
    expect(getProviderForJob(job(), { ...settings, apiKey: "" }).providerId).toBe("custom");
  });
  it("异步创建使用数字 ID，查询路径编码任务 ID", async () => {
    const asyncConfig = { ...config, mode: "async" as const, taskIdPath: "data.id", statusPath: "data.status", resultPath: "data.output[]", queryPath: "/tasks/{id}" };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 42 } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "completed", output: ["https://cdn.example/a.png"] } })));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new CustomProvider();
    const task = await provider.createTask(job({ customProviderConfig: asyncConfig }), settings);
    expect(task.taskId).toBe("42");
    expect(await provider.queryTask("id/42?x", job({ customProviderConfig: asyncConfig }), settings)).toMatchObject({ state: "succeeded" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).url).toContain("id%2F42%3Fx");
  });
  it("切换或编辑配置不会修改历史任务快照，并可使用保留的旧 Key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ url: "https://cdn.example/a.png" }] })));
    vi.stubGlobal("fetch", fetchMock);
    await new CustomProvider().createTask(job({ customCredentialId: createCredentialId("duomi", "old-key") }), {
      ...settings, customProviders: [{ config: { ...config, baseUrl: "https://changed.example" }, apiKey: "new-key", previousApiKeys: ["old-key"] }]
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ url: "https://relay.example/v1/images/generations", headers: { Authorization: "Bearer old-key" } });
  });
  it("中转已删除时禁止误用当前供应商凭据", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(new CustomProvider().createTask(job(), { ...settings, customProviders: [] })).rejects.toThrow("已删除");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("提交成功后字段映射错误标为结果未知，避免重复收费", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ unexpected: "ok" }))));
    await expect(new CustomProvider().createTask(job(), settings)).rejects.toThrow("提交结果未知");
  });
  it("区分远程失败、处理中、文本结果与无效 URL", () => {
    expect(parseCustomResult({ state: "failed", error: { message: "quota" } }, config)).toEqual({ state: "error", errorMessage: "quota" });
    expect(parseCustomResult({ state: "processing" }, config)).toEqual({ state: "running" });
    expect(parseCustomResult({ data: [{ text: "hello" }] }, { ...config, outputKind: "text", resultPath: "data[].text" }, true)).toEqual({ state: "succeeded", text: "hello" });
    expect(() => parseCustomResult({ data: [{ url: "javascript:alert(1)" }] }, config, true)).toThrow("HTTP(S)");
  });
});
