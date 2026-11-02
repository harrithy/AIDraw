import { describe, expect, it } from "vitest";
import { createCustomProviderTemplate, customEndpoint, readResponsePath, renderRequestTemplate, validateCustomProviderConfig } from "./customProviders";

const config = () => ({ ...createCustomProviderTemplate(), baseUrl: "https://relay.example/v1" });

describe("自定义中转协议边界", () => {
  it("保留变量的数组、数字类型和提示词中的特殊字符", () => {
    const prompt = "引号\"和换行\n提示词";
    expect(renderRequestTemplate({ prompt: "{{prompt}}", images: "{{images}}", width: "{{width}}", nested: ["prefix {{model}}"] }, {
      prompt, images: ["https://example.com/a.png"], width: 1024, model: "my-model"
    })).toEqual({ prompt, images: ["https://example.com/a.png"], width: 1024, nested: ["prefix my-model"] });
  });
  it("解析索引和数组路径，拒绝原型链读取", () => {
    const payload = { data: [{ url: "a" }, { url: "b" }] };
    expect(readResponsePath(payload, "$.data[].url")).toEqual(["a", "b"]);
    expect(readResponsePath(payload, "data[1].url")).toEqual(["b"]);
    expect(readResponsePath(payload, "__proto__.toString")).toEqual([]);
  });
  it("无参考图时省略对应可选字段，避免把空图片提交给中转", () => {
    expect(renderRequestTemplate({ prompt: "{{prompt}}", image: "{{image}}", images: "{{images}}" }, { prompt: "cat" })).toEqual({ prompt: "cat" });
  });
  it("兼容带 /v1 的 Base URL，避免重复拼接", () => {
    expect(customEndpoint(config(), "/v1/images/generations")).toBe("https://relay.example/v1/images/generations");
    expect(customEndpoint(config(), "/images/generations")).toBe("https://relay.example/v1/images/generations");
  });
  it.each(["javascript:alert(1)", "https://user:password@relay.example", "https://relay.example?key=secret"])("拒绝非法地址 %s", (baseUrl) => {
    expect(() => validateCustomProviderConfig({ ...config(), baseUrl })).toThrow();
  });
  it("归一化模型并阻止非法占位符、请求头和异步配置", () => {
    expect(validateCustomProviderConfig({ ...config(), models: [" one ", "one", "two"] }).models).toEqual(["one", "two"]);
    expect(() => validateCustomProviderConfig({ ...config(), requestBody: { key: "{{apiKey}}" } })).toThrow("未知模板变量");
    expect(() => validateCustomProviderConfig({ ...config(), authHeader: "Host" })).toThrow("请求头");
    expect(() => validateCustomProviderConfig({ ...config(), createPath: "//evil.example" })).toThrow("接口路径");
    expect(() => validateCustomProviderConfig({ ...config(), mode: "async", queryPath: "/tasks" })).toThrow("{id}");
    expect(() => validateCustomProviderConfig({ ...config(), mode: "async", failureValues: ["success"] })).toThrow("互不重叠");
  });
});
