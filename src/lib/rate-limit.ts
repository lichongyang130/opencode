/**
 * 内存滑动窗口限流（O9/O10）。
 *
 * 进程内、按「IP + 路由」维度计数，单实例够用（项目无 Redis、刻意零依赖）。
 * AI 调用类路由消耗真金白银（token / 图片额度），单独设更严的配额；
 * 命中限额返回 429 并带 Retry-After，客户端可据此退避。
 */


const DEFAULT_LIMIT = 90;
const DEFAULT_WINDOW_MS = 60_000;

/** AI 路由更严：单位窗口内允许的请求数更少，防止脚本刷额度 */
const AI_LIMIT = 30;
const AI_WINDOW_MS = 60_000;

const AI_ROUTE_HINTS = ["chat", "research", "slides", "images", "ocr"];

type Timestamps = number[];

const buckets = new Map<string, Timestamps>();

export interface RateLimitPolicy {
  /** 窗口内允许的最大请求数；0 表示不限流 */
  limit: number;
  windowMs: number;
}

/** 根据路由名判断是否属于 AI 调用类，套用更严口径 */
export function isAiRoute(route: string): boolean {
  return AI_ROUTE_HINTS.some((h) => route.includes(h));
}

export function defaultPolicyFor(route: string): RateLimitPolicy {
  if (isAiRoute(route)) return { limit: AI_LIMIT, windowMs: AI_WINDOW_MS };
  return { limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS };
}

/** 只能拿到 IP 时兜底用稳定匿名键，避免不同 IP 落在同一桶错杀 */
function anonymousKey(route: string): string {
  return `anon::${route}`;
}

export function extractIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip");
  if (real?.trim()) return real.trim();
  return "unknown";
}

function now(): number {
  return Date.now();
}

function pruneOne(list: Timestamps, windowMs: number, since: number): void {
  while (list.length > 0 && list[0] <= since) list.shift();
}

/** 全局兜底清理：桶表过大时清一遍过期数据，防止无界增长 */
function sweep(windowMs: number): void {
  if (buckets.size < 10_000) return;
  const since = now() - windowMs;
  for (const [key, list] of buckets) {
    pruneOne(list, windowMs, since);
    if (list.length === 0) buckets.delete(key);
  }
}

export function clearRateLimitBuckets(): void {
  buckets.clear();
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  route: string,
  ip: string,
  policy: RateLimitPolicy
): RateLimitResult {
  if (policy.limit <= 0) {
    return { allowed: true, limit: 0, remaining: 0, retryAfterSec: 0 };
  }
  const key = `${ip}::${route}`;
  const since = now() - policy.windowMs;
  const list = buckets.get(key) ?? [];

  pruneOne(list, policy.windowMs, since);

  if (list.length >= policy.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((list[0] + policy.windowMs - now()) / 1000));
    sweep(policy.windowMs);
    return {
      allowed: false,
      limit: policy.limit,
      remaining: 0,
      retryAfterSec,
    };
  }

  list.push(now());
  buckets.set(key, list);
  sweep(policy.windowMs);
  return {
    allowed: true,
    limit: policy.limit,
    remaining: policy.limit - list.length,
    retryAfterSec: 0,
  };
}

export function rateLimitError(policy: RateLimitPolicy): Response {
  return Response.json(
    { error: "请求过于频繁，请稍后再试" },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(policy.windowMs / 1000)),
        "X-RateLimit-Limit": String(policy.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}