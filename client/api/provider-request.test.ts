import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./provider-request";

vi.mock("node:dns/promises", () => {
  const lookup = vi.fn(async () => [{ address: "8.8.8.8", family: 4 }]);
  return { lookup, default: { lookup } };
});

const call = async (payload: unknown, headers: IncomingMessage["headers"] = {}, method = "POST") => {
  const req = Object.assign(Readable.from([JSON.stringify(payload)]), { method, headers, socket: { remoteAddress: "203.0.113.88" } }) as IncomingMessage;
  const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
  await handler(req, res as unknown as ServerResponse);
  return { status: res.statusCode, payload: JSON.parse(res.end.mock.calls[0][0]) };
};
afterEach(() => vi.unstubAllGlobals());

describe("自定义中转 JSON 代理", () => {
  it("转发公开端点、方法和鉴权，不跟随跳转", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ url: "https://cdn.example/a.png" }] })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await call({ url: "https://relay.example/generate", method: "POST", headers: { Authorization: "Bearer test-key" }, body: { prompt: "cat" } });
    expect(result.status).toBe(200);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", headers: { Authorization: "Bearer test-key" }, redirect: "manual", body: JSON.stringify({ prompt: "cat" }) });
  });
  it.each(["http://127.0.0.1/admin", "http://192.168.1.1", "http://169.254.169.254", "https://relay.example:8443", "https://user:secret@relay.example"])("阻止内网或非法目标 %s", async (url) => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await call({ url, method: "GET" })).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("跨站请求、危险头和重定向不透传凭据", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: "https://other.example" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await call({ url: "https://relay.example", method: "GET" }, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await call({ url: "https://relay.example", method: "GET", headers: { Cookie: "private" } })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await call({ url: "https://relay.example", method: "GET" })).payload.error).toContain("重定向");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("限制响应体，拒绝 HTML，并保留上游业务错误状态", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("oversized", { headers: { "content-length": String(9 * 1024 * 1024) } }))
      .mockResolvedValueOnce(new Response("<html>wrong endpoint</html>"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "quota" }), { status: 429 })));
    expect((await call({ url: "https://relay.example", method: "GET" })).status).toBe(413);
    expect((await call({ url: "https://relay.example", method: "GET" })).status).toBe(502);
    expect(await call({ url: "https://relay.example", method: "GET" })).toEqual({ status: 429, payload: { error: "quota" } });
  });
});
