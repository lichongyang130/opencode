/**
 * 进程内请求耗时分布统计（O11 的后半部分）。
 *
 * 限流用不到，这里单纯累积每个路由的请求计数与耗时直方图，
 * 供 /api/health 暴露，方便判断哪个接口在变慢。进程重启即清零，够用。
 */
import { currentRoute } from "./request-context";

const HISTOGRAM_BUCKETS = [50, 100, 250, 500, 1000, 2000, 5000, 10_000];

interface Counter {
  count: number;
  buckets: number[];
  totalMs: number;
  maxMs: number;
}

const counters = new Map<string, Counter>();

function keyFor(route: string): string {
  return route || "unknown";
}

function bucketFor(ms: number): number {
  return HISTOGRAM_BUCKETS.findIndex((b) => ms <= b);
}

export function recordDuration(ms: number): void {
  const key = keyFor(currentRoute() ?? "");
  const c = counters.get(key) ?? {
    count: 0,
    buckets: HISTOGRAM_BUCKETS.map(() => 0),
    totalMs: 0,
    maxMs: 0,
  };
  c.count += 1;
  c.totalMs += ms;
  c.maxMs = Math.max(c.maxMs, ms);
  const idx = bucketFor(ms);
  if (idx >= 0) c.buckets[idx] += 1;
  counters.set(key, c);
}

export function countActive(): number {
  return counters.size;
}

export function clearDurationStats(): void {
  counters.clear();
}

export interface DurationStats {
  route: string;
  count: number;
  avgMs: number;
  maxMs: number;
  buckets: { le: number; count: number }[];
}

/** 按路由导出耗时分布（桶边界固定，前端可画直方图） */
export function durationStats(): DurationStats[] {
  const out: DurationStats[] = [];
  for (const [route, c] of counters) {
    out.push({
      route,
      count: c.count,
      avgMs: c.count > 0 ? Math.round(c.totalMs / c.count) : 0,
      maxMs: c.maxMs,
      buckets: c.buckets.map((n, i) => ({ le: HISTOGRAM_BUCKETS[i], count: n })),
    });
  }
  return out;
}