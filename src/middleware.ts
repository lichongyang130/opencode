import { NextResponse, type NextRequest } from "next/server";

/**
 * API 写操作统一守卫。
 *
 * 策略（两条通道，满足其一即放行）：
 * 1. 携带正确的 `Authorization: Bearer $OC_API_TOKEN`（供反向代理后的脚本/CLI 调用）；
 * 2. 请求来自本站页面（同源），由 Origin / Referer / Sec-Fetch-Site 判定。
 *
 * 这样浏览器内的正常操作无需改动，而跨站伪造请求（CSRF）与
 * 「直接拿 curl 打接口」的外部脚本会被拒绝。
 *
 * 注意：这是传输层面的来源校验，不等于多用户身份认证。
 * 若要区分不同用户的数据归属，仍需接入完整的登录体系。
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** 只读但会吐出全量数据的接口，同样纳入守卫 */
const GUARDED_READS = new Set(["/api/export"]);

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function isSameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return false;

  // Origin 最可靠：浏览器对跨站写请求一定会带上，且无法被脚本伪造
  const origin = hostOf(req.headers.get("origin"));
  if (origin) return origin === host;

  // 部分同源场景（如同源 fetch 被代理改写）只剩 Referer
  const referer = hostOf(req.headers.get("referer"));
  if (referer) return referer === host;

  // 现代浏览器补充信号；缺少全部来源头的请求（curl 等）视为不可信
  return req.headers.get("sec-fetch-site") === "same-origin";
}

export function middleware(req: NextRequest) {
  const id = crypto.randomUUID();

  // 无论放行还是拒绝都带 x-request-id，下游路由/日志借此把一次请求串起来
  const pass = () => {
    const res = NextResponse.next();
    res.headers.set("x-request-id", id);
    return res;
  };

  const method = req.method.toUpperCase();
  const needsGuard = !SAFE_METHODS.has(method) || GUARDED_READS.has(req.nextUrl.pathname);
  if (!needsGuard) return pass();

  const token = process.env.OC_API_TOKEN;
  if (token && req.headers.get("authorization") === `Bearer ${token}`) {
    return pass();
  }

  if (isSameOrigin(req)) return pass();

  const res = NextResponse.json(
    { error: "请求来源不被信任：请在本站页面内操作，或配置 OC_API_TOKEN 后携带 Bearer 令牌" },
    { status: 401 }
  );
  res.headers.set("x-request-id", id);
  return res;
}

export const config = {
  matcher: "/api/:path*",
};