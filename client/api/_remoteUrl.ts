import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 4;
const STANDARD_PORTS = new Set(["", "80", "443"]);

export class RemoteUrlPolicyError extends Error {}

const normalizeHostname = (hostname: string) =>
  hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();

const isBlockedIpv4 = (address: string) => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [first, second, third] = parts as [number, number, number, number];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
};

const ipv6ToBigInt = (rawAddress: string): bigint | null => {
  let address = rawAddress;
  if (address.includes(".")) {
    const separatorIndex = address.lastIndexOf(":");
    const ipv4 = address.slice(separatorIndex + 1).split(".").map(Number);
    if (ipv4.length !== 4 || ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null;
    }
    const high = ((ipv4[0] || 0) << 8) | (ipv4[1] || 0);
    const low = ((ipv4[2] || 0) << 8) | (ipv4[3] || 0);
    address = `${address.slice(0, separatorIndex)}:${high.toString(16)}:${low.toString(16)}`;
  }

  const compressedParts = address.split("::");
  if (compressedParts.length > 2) return null;
  const head = compressedParts[0] ? compressedParts[0].split(":") : [];
  const tail = compressedParts[1] ? compressedParts[1].split(":") : [];
  const missingGroups = 8 - head.length - tail.length;
  if ((compressedParts.length === 1 && missingGroups !== 0) || missingGroups < 0) return null;
  const groups = compressedParts.length === 2
    ? [...head, ...Array.from({ length: missingGroups }, () => "0"), ...tail]
    : head;
  if (groups.length !== 8) return null;

  return groups.reduce((value, group) => {
    const parsed = Number.parseInt(group || "0", 16);
    return (value << 16n) | BigInt(parsed);
  }, 0n);
};

const isInIpv6Prefix = (value: bigint, prefix: bigint, prefixLength: number) => {
  const shift = BigInt(128 - prefixLength);
  return value >> shift === prefix >> shift;
};

/** 判断 DNS 结果是否属于本机、私网、链路本地或保留地址。 */
export const isBlockedNetworkAddress = (rawAddress: string) => {
  const address = normalizeHostname(rawAddress).split("%", 1)[0] || "";
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family !== 6) return true;

  const value = ipv6ToBigInt(address);
  if (value === null || value === 0n || value === 1n) return true;
  const ipv4MappedPrefix = 0xffffn << 32n;
  if (isInIpv6Prefix(value, ipv4MappedPrefix, 96)) {
    const ipv4 = Number(value & 0xffffffffn);
    return isBlockedIpv4(
      [ipv4 >>> 24, (ipv4 >>> 16) & 255, (ipv4 >>> 8) & 255, ipv4 & 255].join(".")
    );
  }

  return (
    isInIpv6Prefix(value, 0xfc00n << 112n, 7) ||
    isInIpv6Prefix(value, 0xfe80n << 112n, 10) ||
    isInIpv6Prefix(value, 0xff00n << 112n, 8) ||
    isInIpv6Prefix(value, 0x20010db8n << 96n, 32) ||
    isInIpv6Prefix(value, 0x20010002n << 96n, 48) ||
    isInIpv6Prefix(value, 0x0064ff9bn << 96n, 96) ||
    isInIpv6Prefix(value, 0x2002n << 112n, 16) ||
    isInIpv6Prefix(value, 0n, 96)
  );
};

export const parseRemoteUrl = (rawUrl: string, baseUrl?: URL) => {
  let url: URL;
  try {
    url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
  } catch {
    throw new RemoteUrlPolicyError("媒体地址格式无效");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RemoteUrlPolicyError("媒体地址仅支持 http/https");
  }
  if (url.username || url.password) {
    throw new RemoteUrlPolicyError("媒体地址不能包含账号或密码");
  }
  if (!STANDARD_PORTS.has(url.port)) {
    throw new RemoteUrlPolicyError("媒体地址仅支持标准 HTTP/HTTPS 端口");
  }
  return url;
};

/** 解析主机名并确认所有 DNS 结果均为公网地址。 */
export const assertPublicRemoteUrl = async (url: URL) => {
  const hostname = normalizeHostname(url.hostname);
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa")
  ) {
    throw new RemoteUrlPolicyError("禁止访问本机或内网媒体地址");
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [hostname]
    : (await lookup(hostname, { all: true, verbatim: true })).map((result) => result.address);
  if (addresses.length === 0 || addresses.some(isBlockedNetworkAddress)) {
    throw new RemoteUrlPolicyError("禁止访问本机、私网或保留网络地址");
  }
};

/** fetch 每次跳转前都重新做 URL 与 DNS 安全检查，防止重定向绕过。 */
export const fetchPublicRemote = async (
  rawUrl: string,
  init: RequestInit = {}
): Promise<{ response: Response; finalUrl: URL }> => {
  let targetUrl = parseRemoteUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicRemoteUrl(targetUrl);
    const response = await fetch(targetUrl, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: targetUrl };
    }

    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new RemoteUrlPolicyError("上游重定向缺少 Location");
    if (redirectCount === MAX_REDIRECTS) {
      throw new RemoteUrlPolicyError("媒体地址重定向次数过多");
    }
    targetUrl = parseRemoteUrl(location, targetUrl);
  }

  throw new RemoteUrlPolicyError("媒体地址重定向次数过多");
};
