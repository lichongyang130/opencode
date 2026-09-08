/**
 * 健康检查（O7）。
 *
 * 返回 DB 可连通性、顶号 selflegacy 威胁、WAL 大小、磁盘占用、进程 uptime、
 * 版本号与最近一次 DB 自愈的归档路径。任何一项不健康都返回 503，供编排平台
 * （K8s liveness / 负载均衡健康探测）据此摘除流量。
 */
import { dbHealthy, lastQuarantinedDb } from "@/lib/db/sqlite";
import { checkDiskUsage, warnThresholdBytes } from "@/lib/disk-usage";
import { activeSseCount, sseMaxConcurrency } from "@/lib/sse-registry";
import { processFaultCounts } from "@/lib/process-guard";
import { durationStats } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const healthy = dbHealthy();
  const { usage, over } = checkDiskUsage();
  const quarantined = lastQuarantinedDb();
  const faults = processFaultCounts();

  // DB 不可用或磁盘超阈值或进程刚吞过未捕获异常，都算降级
  const ok = healthy && !over && faults.uncaught === 0 && faults.unhandled === 0;

  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      db: healthy ? "ok" : "error",
      disk: {
        totalBytes: usage.totalBytes,
        dbBytes: usage.dbBytes,
        walBytes: usage.walBytes,
        imagesBytes: usage.imagesBytes,
        warnThresholdBytes: warnThresholdBytes(),
        overThreshold: over,
      },
      uptimeSec: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? "0.1.0",
      sse: { active: activeSseCount(), max: sseMaxConcurrency() },
      faults,
      ...(quarantined ? { quarantined } : {}),
      metrics: durationStats(),
    },
    { status: ok ? 200 : 503 }
  );
}