import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { isCrossSiteRequest, isRateLimited } from "./_requestGuard";

const makeRequest = (
  headers: IncomingMessage["headers"] = {},
  remoteAddress = "203.0.113.10"
) => ({ headers, socket: { remoteAddress } }) as IncomingMessage;

describe("media request guard", () => {
  it("拒绝浏览器明确标记的跨站请求", () => {
    expect(isCrossSiteRequest(makeRequest({ "sec-fetch-site": "cross-site" }))).toBe(true);
  });

  it("同源 Origin 与 Host 可以通过", () => {
    expect(
      isCrossSiteRequest(
        makeRequest({ origin: "https://aidraw.example.com", host: "aidraw.example.com" })
      )
    ).toBe(false);
  });

  it("Origin 与 Host 不一致时拒绝", () => {
    expect(
      isCrossSiteRequest(
        makeRequest({ origin: "https://evil.example.com", host: "aidraw.example.com" })
      )
    ).toBe(true);
  });

  it("按接口和客户端地址限制请求次数", () => {
    const request = makeRequest({ "x-forwarded-for": "198.51.100.50" });
    const scope = `test-${crypto.randomUUID()}`;
    expect(isRateLimited(request, scope, 2)).toBe(false);
    expect(isRateLimited(request, scope, 2)).toBe(false);
    expect(isRateLimited(request, scope, 2)).toBe(true);
  });
});
