import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * 出站请求安全校验（SSRF 防护）。
 *
 * 只允许访问公网 http/https 地址：先做 DNS 解析，再逐个比对目标 IP
 * 是否落在环回、私有、链路本地（含云元数据 169.254.169.254）等保留段内。
 * 重定向必须由调用方逐跳校验，否则可用 302 绕过首跳检查。
 */

export class BlockedAddressError extends Error {}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata", "metadata.google.internal"]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** IPv4 保留段：[起始, 掩码位数] */
const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8], // 本网络
  ["10.0.0.0", 8], // 私有
  ["100.64.0.0", 10], // 运营商级 NAT
  ["127.0.0.0", 8], // 环回
  ["169.254.0.0", 16], // 链路本地（含云元数据 169.254.169.254）
  ["172.16.0.0", 12], // 私有
  ["192.0.0.0", 24], // IETF 协议分配
  ["192.168.0.0", 16], // 私有
  ["198.18.0.0", 15], // 基准测试
  ["224.0.0.0", 4], // 组播
  ["240.0.0.0", 4], // 保留 + 广播
];

function isBlockedV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true;
  for (const [base, bits] of V4_BLOCKS) {
    const baseValue = ipv4ToInt(base);
    if (baseValue === null) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((value & mask) === (baseValue & mask)) return true;
  }
  return false;
}

/**
 * 把 IPv6 展开为 8 组 16 位数值，解析失败返回 null。
 *
 * 必须做数值化展开而不是正则匹配字面量：`new URL()` 会把
 * `[::ffff:127.0.0.1]` 规范化成 `[::ffff:7f00:1]`，
 * 只匹配点分十进制形式会漏掉规范化后的等价地址。
 */
function parseV6(raw: string): number[] | null {
  let ip = raw;
  // 内嵌 IPv4（::ffff:127.0.0.1 / ::127.0.0.1）先折算成两组 16 位
  const embedded = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) {
    const v4 = ipv4ToInt(embedded[2]);
    if (v4 === null) return null;
    ip = `${embedded[1]}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const segments = ip.split("::");
  if (segments.length > 2) return null;
  const parseGroups = (part: string): number[] =>
    part ? part.split(":").map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? Number.parseInt(h, 16) : Number.NaN)) : [];

  const left = parseGroups(segments[0]);
  const right = segments.length === 2 ? parseGroups(segments[1]) : [];
  if ([...left, ...right].some((n) => !Number.isInteger(n))) return null;

  if (segments.length === 1) return left.length === 8 ? left : null;
  const fill = 8 - left.length - right.length;
  if (fill < 1) return null;
  return [...left, ...Array<number>(fill).fill(0), ...right];
}

function isBlockedV6(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const groups = parseV6(ip);
  if (!groups) return true;

  // IPv4 映射（::ffff:x.x.x.x）与 IPv4 兼容（::x.x.x.x）交给 IPv4 规则判定；
  // `::` 与 `::1` 也落在这里，会被 0.0.0.0/8 规则拦下
  if (groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 0xffff || groups[5] === 0)) {
    const v4 = `${groups[6] >>> 8}.${groups[6] & 0xff}.${groups[7] >>> 8}.${groups[7] & 0xff}`;
    return isBlockedV4(v4);
  }
  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 唯一本地地址
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 链路本地
  return false;
}

function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedV4(ip);
  if (family === 6) return isBlockedV6(ip);
  return true;
}

/**
 * 校验单个 URL 是否可安全访问。
 * @throws {BlockedAddressError} 协议非法、主机名在黑名单、或解析到内网地址
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedAddressError("链接格式不正确");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedAddressError("只支持 http/https 链接");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) throw new BlockedAddressError("链接缺少主机名");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new BlockedAddressError("不允许访问本机地址");
  }

  // 字面量 IP 直接判定，无需 DNS
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new BlockedAddressError("不允许访问内网或保留地址");
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BlockedAddressError("无法解析该域名");
  }
  if (addresses.length === 0) throw new BlockedAddressError("无法解析该域名");
  // 任一解析结果落在内网即拒绝，避免 DNS 轮询绕过
  for (const { address } of addresses) {
    if (isBlockedIp(address)) throw new BlockedAddressError("该域名指向内网或保留地址");
  }
  return url;
}

/**
 * 带 SSRF 校验的 fetch：手动跟随重定向，且每一跳都重新校验目标地址。
 */
export async function safeFetch(
  raw: string,
  init: RequestInit & { maxRedirects?: number } = {}
): Promise<Response> {
  const { maxRedirects = 3, ...rest } = init;
  let target = raw;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicUrl(target);
    const res = await fetch(url, { ...rest, redirect: "manual" });
    if (res.status < 300 || res.status >= 400) return res;

    const location = res.headers.get("location");
    if (!location) return res;
    target = new URL(location, url).toString();
  }

  throw new BlockedAddressError("重定向次数过多");
}