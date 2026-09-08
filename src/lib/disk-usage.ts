/**
 * data/ 目录磁盘占用检查（O14）。
 *
 * 图片转存 + WAL 模式下数据目录会无界增长，磁盘写满会让 sqlite 写坏库。
 * 这里递归统计 data 目录里 DB / WAL / 图片文件的体积，超出阈值时打告警，
 * 并供 health 接口暴露，让运维能提前发现而非等写满才爆。
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./db/sqlite";
import { logger } from "./logger";

export interface DiskUsageBreakdown {
  dbBytes: number;
  walBytes: number;
  imagesBytes: number;
  otherBytes: number;
  totalBytes: number;
}

/** 告警阈值，可用 OC_DISK_WARN_BYTES 覆盖，默认 1 GiB */
export function warnThresholdBytes(): number {
  const n = Number(process.env.OC_DISK_WARN_BYTES ?? "");
  return Number.isFinite(n) && n > 0 ? n : 1024 * 1024 * 1024;
}

function walk(dir: string, out: { path: string; size: number }[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      out.push({ path: full, size: statSync(full).size });
    } catch {
      /* 文件可能刚好被删，忽略 */
    }
  }
}

export function measureDiskUsage(): DiskUsageBreakdown {
  const files: { path: string; size: number }[] = [];
  walk(dataDir(), files);

  let dbBytes = 0;
  let walBytes = 0;
  let imagesBytes = 0;
  let otherBytes = 0;
  const imagesRoot = path.join(dataDir(), "images");

  for (const f of files) {
    if (f.path.startsWith(`${imagesRoot}${path.sep}`)) {
      imagesBytes += f.size;
    } else if (f.path.endsWith("-wal")) {
      walBytes += f.size;
    } else if (f.path.endsWith(".db")) {
      dbBytes += f.size;
    } else {
      otherBytes += f.size;
    }
  }

  return {
    dbBytes,
    walBytes,
    imagesBytes,
    otherBytes,
    totalBytes: dbBytes + walBytes + imagesBytes + otherBytes,
  };
}

/** 超过阈值打 warn；返回是否超限，供 health 用「降级」状态表达 */
export function checkDiskUsage(): { usage: DiskUsageBreakdown; over: boolean } {
  const usage = measureDiskUsage();
  const over = usage.totalBytes > warnThresholdBytes();
  if (over) {
    logger.warn("数据目录磁盘占用超阈值", {
      totalBytes: usage.totalBytes,
      thresholdBytes: warnThresholdBytes(),
    });
  }
  return { usage, over };
}