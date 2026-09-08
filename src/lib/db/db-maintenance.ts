import type { DatabaseSync } from "node:sqlite";

/**
 * PRAGMA optimize 定期执行器（DB16）。
 *
 * 为什么独立成模块：官方建议 optimize 低频调用（近似「每个连接关闭前一次」），
 * 服务端是长驻单连接，折衷为 12 小时间隔；回调里的 try/catch 是
 * 「连接可能已被 closeDb」的防御路径，必须在模块内可独立测试，
 * 而不是藏在 sqlite.ts 的开库流程里变成不可测死分支。
 */

export const OPTIMIZE_INTERVAL_MS = 12 * 60 * 60 * 1000;

let optimizeTimer: ReturnType<typeof setInterval> | null = null;

/** 停掉定时器；closeDb 关连接时调用，防止回调在已关闭的库上反复抛错 */
export function stopOptimizeScheduler(): void {
  if (optimizeTimer) {
    clearInterval(optimizeTimer);
    optimizeTimer = null;
  }
}

/**
 * 立刻执行一次 PRAGMA optimize 并注册周期任务。
 * 立刻执行失败不抛（开库阶段问题不该阻断启动）；后续每轮失败同样静默，
 * 只记录到返回值供测试与诊断使用。
 */
export function scheduleOptimize(
  db: DatabaseSync,
  opts?: { onError?: (err: unknown) => void }
): void {
  const exec = () => {
    try {
      db.exec("PRAGMA optimize");
    } catch (err) {
      opts?.onError?.(err);
    }
  };
  exec();
  // 去重：热重载 / 测试反复 getDb 时不堆叠定时器（一个进程一个就够）
  if (optimizeTimer) return;
  optimizeTimer = setInterval(exec, OPTIMIZE_INTERVAL_MS);
  optimizeTimer.unref?.();
}