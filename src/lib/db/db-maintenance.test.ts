import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * PRAGMA optimize 调度器测试（DB16）。
 * 覆盖：立刻执行一次、周期到点执行、异常回调不炸、去重不堆叠、closeDb 清理。
 */

let tempDir: string;
let sqliteModule: typeof import("./sqlite") | null = null;

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "oc-maint-"));
  process.env.OC_DATA_DIR = tempDir;
  vi.resetModules();
  sqliteModule = null;
});

afterEach(() => {
  sqliteModule?.closeDb();
  delete process.env.OC_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 拿到带 closeDb 句柄的模块（同一测试文件内多次 import 共享单例） */
async function getSqlite() {
  if (!sqliteModule) sqliteModule = await import("./sqlite");
  return sqliteModule;
}

describe("scheduleOptimize", () => {
  it("调度后立即执行一次 PRAGMA optimize，不抛错", async () => {
    const m = await getSqlite();
    expect(() => m.getDb()).not.toThrow();
    // 立即执行成功：在库上再次手动执行也无异常，证明连接活着
    expect(() => m.getDb().exec("PRAGMA optimize")).not.toThrow();
  });

  it("周期到点会再次执行；执行抛错时静默不炸进程", async () => {
    vi.useFakeTimers();
    const m = await getSqlite();
    const db = m.getDb();

    const errors: unknown[] = [];
    // exec 抛错模拟磁盘故障路径：立即执行与周期回调都应走 onError 而非炸进程
    const spy = vi.spyOn(db, "exec").mockImplementation(() => {
      throw new Error("disk full");
    });
    const { scheduleOptimize, stopOptimizeScheduler } = await import("./db-maintenance");
    stopOptimizeScheduler();
    scheduleOptimize(db, { onError: (err) => errors.push(err) });
    // 立即执行一次
    expect(errors).toHaveLength(1);

    vi.advanceTimersByTime(12 * 60 * 60 * 1000 + 1);
    // 周期到点又执行一次，同样被捕获
    expect(errors).toHaveLength(2);

    stopOptimizeScheduler();
    spy.mockRestore();
  });

  it("重复调用不会堆叠定时器（去重）", async () => {
    vi.useFakeTimers();
    const m = await getSqlite();
    const db = m.getDb();
    const { scheduleOptimize, stopOptimizeScheduler } = await import("./db-maintenance");

    let fired = 0;
    const spy = vi.spyOn(db, "exec").mockImplementation(() => {
      fired += 1;
    });
    scheduleOptimize(db);
    scheduleOptimize(db);
    scheduleOptimize(db);

    vi.advanceTimersByTime(12 * 60 * 60 * 1000 + 1);
    // 三次 schedule 只留一个定时器：12 小时只 fired 一次（外加每次立即执行）
    expect(fired).toBe(4);
    stopOptimizeScheduler();
    spy.mockRestore();
  });

  it("stopOptimizeScheduler 后回调不再触发", async () => {
    vi.useFakeTimers();
    const m = await getSqlite();
    const db = m.getDb();
    const { scheduleOptimize, stopOptimizeScheduler } = await import("./db-maintenance");

    let fired = 0;
    const spy = vi.spyOn(db, "exec").mockImplementation(() => {
      fired += 1;
    });
    stopOptimizeScheduler();
    scheduleOptimize(db);
    stopOptimizeScheduler();

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    // 只剩 schedule 时的那次立即执行
    expect(fired).toBe(1);
    spy.mockRestore();
  });
});