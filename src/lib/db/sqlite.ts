import { DatabaseSync } from "node:sqlite";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { runMigrations, cjkSeg } from "./migrations";
import { scheduleOptimize, stopOptimizeScheduler } from "./db-maintenance";

/**
 * 数据库层：Node 22+ 内置 node:sqlite，零外部依赖、零下载。
 * 架构通过 migrations.ts (PRAGMA user_version) 进行严格版本化迁移与事务保护。
 *
 * 数据目录默认为 `<cwd>/data`，可用 OC_DATA_DIR 覆盖：
 * 测试需要每个用例跑在独立的临时库上，否则会互相污染并写坏开发库。
 */

let db: DatabaseSync | null = null;

/** 数据目录：优先取 OC_DATA_DIR，便于测试隔离（图片落盘目录也共用这里） */
export function dataDir(): string {
  return process.env.OC_DATA_DIR || path.join(process.cwd(), "data");
}

/** 关闭并释放单例，仅供测试在用例之间重置连接 */
export function closeDb(): void {
  stopOptimizeScheduler();
  db?.close();
  db = null;
}

/** health 探活：能否打开连接并完成一次最小查询（O7） */
export function dbHealthy(): boolean {
  try {
    getDb().prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

/** 最近一次自愈时归档的坏库路径，供上层提示用户去抢救数据 */
let quarantinedPath: string | null = null;
export function lastQuarantinedDb(): string | null {
  return quarantinedPath;
}

/**
 * 把坏掉的库文件连同 WAL/SHM 一起改名归档。
 * 不直接删：损坏的库多数还能用 sqlite3 的 recover 命令抢回大部分数据，
 * 直接 rm 等于替用户做了「放弃数据」的决定。
 */
function quarantine(file: string): string | null {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archived = `${file}.corrupt-${stamp}`;
  try {
    renameSync(file, archived);
  } catch {
    // 改名都失败（只读挂载 / 文件被占用）时只能删掉，否则应用永远起不来
    try {
      rmSync(file, { force: true });
    } catch {
      return null;
    }
    return null;
  }
  // WAL 与 SHM 属于旧库的一部分，留着会让新建的空库读到陈旧页
  for (const suffix of ["-wal", "-shm"]) {
    try {
      renameSync(`${file}${suffix}`, `${archived}${suffix}`);
    } catch {
      /* 不存在或无法改名都无所谓，新库会重建 */
    }
  }
  return archived;
}

/**
 * 打开数据库并确认它没坏（R15）。
 */
function openHealthy(file: string): DatabaseSync {
  let conn: DatabaseSync | null = null;
  try {
    conn = new DatabaseSync(file);
    const rows = conn.prepare("PRAGMA integrity_check(1)").all() as {
      integrity_check?: unknown;
    }[];
    const verdict = String(rows[0]?.integrity_check ?? "").toLowerCase();
    if (rows.length === 1 && verdict === "ok") {
      quarantinedPath = null;
      return conn;
    }
    throw new Error(`integrity_check 未通过：${verdict || "未知原因"}`);
  } catch (err) {
    try {
      conn?.close();
    } catch {
      /* 坏库的 close 也可能抛，忽略即可 */
    }
    quarantinedPath = quarantine(file);
    console.error(
      `[db] 数据库损坏，已重建空库；原库归档于 ${quarantinedPath ?? "（归档失败，已删除）"}`,
      err
    );
    return new DatabaseSync(file);
  }
}

export function getDb(): DatabaseSync {
  if (db) return db;

  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  db = openHealthy(path.join(dir, "dev.db"));
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  // WAL 文件会随写入持续增长，设置自动 checkpoint 阈值（页数）控制体积
  db.exec("PRAGMA wal_autocheckpoint = 512;");

  // 注册 CJK 切词函数：必须在 runMigrations 之前，因为 FTS 触发器体
  // 内引用了 oc_cjk_seg，迁移建触发器时就要能解析到该函数。
  // node:sqlite 按函数的 length 属性推断 SQL 参数个数，必须写显式单参
  // 包装（...rest 的 length 为 0，SQLite 会当零参函数报 wrong number of
  // arguments）。类型层面 @types/node 尚未收录 function()，做最小断言。
  (db as DatabaseSync & { function(name: string, fn: (input: string | null) => string): void }).function(
    "oc_cjk_seg",
    cjkSeg
  );

  // 执行结构化版本化迁移（DB5/DB6/DB7）
  runMigrations(db);

  // DB16: 低频 PRAGMA optimize（12 小时周期，实现与测试见 db-maintenance.ts）
  scheduleOptimize(db);

  return db;
}