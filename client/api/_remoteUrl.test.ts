import { describe, expect, it } from "vitest";
import {
  assertPublicRemoteUrl,
  isBlockedNetworkAddress,
  parseRemoteUrl,
  RemoteUrlPolicyError
} from "./_remoteUrl";

describe("remote URL policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1"
  ])("拦截私网或保留地址 %s", (address) => {
    expect(isBlockedNetworkAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "允许常见公网地址 %s",
    (address) => {
      expect(isBlockedNetworkAddress(address)).toBe(false);
    }
  );

  it("拒绝非 HTTP 协议、URL 凭据和非标准端口", () => {
    expect(() => parseRemoteUrl("file:///etc/passwd")).toThrow(RemoteUrlPolicyError);
    expect(() => parseRemoteUrl("https://user:pass@example.com/a.png")).toThrow("账号或密码");
    expect(() => parseRemoteUrl("https://example.com:8080/a.png")).toThrow("标准 HTTP/HTTPS 端口");
  });

  it("拒绝 localhost 与私网 IP URL", async () => {
    await expect(assertPublicRemoteUrl(parseRemoteUrl("http://localhost/a.png"))).rejects.toThrow(
      "本机或内网"
    );
    await expect(assertPublicRemoteUrl(parseRemoteUrl("http://169.254.169.254/latest"))).rejects.toThrow(
      "私网或保留"
    );
    await expect(assertPublicRemoteUrl(parseRemoteUrl("http://2130706433/latest"))).rejects.toThrow(
      "私网或保留"
    );
  });
});
