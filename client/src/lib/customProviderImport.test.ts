import { afterEach, describe, expect, it, vi } from "vitest";
import { createCustomProviderTemplate } from "./customProviders";
import { importCustomProviderJson, recognizeCustomProviderDocument } from "./customProviderImport";

vi.mock("./storage/settings", async () => ({
  ...(await vi.importActual<typeof import("./storage/settings")>("./storage/settings")),
  getSettings: vi.fn(async () => ({ savedApiKeys: ["deepseek-test-key"], savedApiKeyProviderIds: ["deepseek"] }))
}));
afterEach(() => vi.unstubAllGlobals());

describe("自定义中转文档导入", () => {
  it("文字文档通过已有 DeepSeek 接口识别，结果仍经过本地校验", async () => {
    const config = { ...createCustomProviderTemplate(), baseUrl: "https://relay.example", models: ["custom-model"] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(config) } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const parsed = await recognizeCustomProviderDocument("POST /v1/images/generations，返回 data 数组中的 url", config);
    expect(parsed.models).toEqual(["custom-model"]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/deepseek-chat");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ apiKey: "deepseek-test-key", stream: false });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...config, baseUrl: "javascript:bad" }) } }] })));
    await expect(recognizeCustomProviderDocument("接口文档", config)).rejects.toThrow("HTTP(S)");
  });
  it("导入 OpenAPI 并识别异步路径、鉴权、字段层级和模型", () => {
    const document = {
      openapi: "3.0.0", info: { title: "My Relay" }, servers: [{ url: "https://relay.example" }],
      components: { securitySchemes: { key: { type: "apiKey", in: "header", name: "X-API-Key" } }, schemas: {
        Input: { properties: { prompt: { type: "string" }, model: { enum: ["my-model"] }, steps: { default: 20 } } }
      } },
      paths: {
        "/generate": { post: { requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Input" } } } }, responses: { "200": { content: { "application/json": { schema: { properties: { task: { properties: { task_id: { type: "string" } } } } } } } } } } },
        "/tasks/{task_id}": { get: { responses: { "200": { content: { "application/json": { schema: { properties: { task: { properties: { status: { type: "string" }, images: { type: "array", items: { properties: { url: { type: "string" } } } } } } } } } } } } } }
      }
    };
    expect(importCustomProviderJson(JSON.stringify(document))).toMatchObject({ name: "My Relay", baseUrl: "https://relay.example", models: ["my-model"], mode: "async", authHeader: "X-API-Key", authPrefix: "", requestBody: { prompt: "{{prompt}}", model: "{{model}}", steps: 20 }, queryPath: "/tasks/{id}", taskIdPath: "task.task_id", statusPath: "task.status", resultPath: "task.images[].url" });
  });
  it("配置 JSON 导入保留本地 ID，不覆盖别的中转", () => {
    const fallback = createCustomProviderTemplate();
    const imported = importCustomProviderJson(JSON.stringify({ ...fallback, id: "foreign-id", baseUrl: "https://relay.example" }), fallback);
    expect(imported.id).toBe(fallback.id);
  });
  it("拒绝缺少提交接口和缺失必填参数的文档", () => {
    expect(() => importCustomProviderJson(JSON.stringify({ paths: {} }))).toThrow("提交接口");
    expect(() => importCustomProviderJson(JSON.stringify({ paths: { "/create": { post: { requestBody: { content: { "application/json": { schema: { required: ["special"], properties: { special: { type: "string" } } } } } } } } } }))).toThrow("special");
  });
});
