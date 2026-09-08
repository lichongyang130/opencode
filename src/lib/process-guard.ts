/**
 * 全局兜底钩子（O13）：uncaughtException 与 unhandledRejection。
 *
 * 默认情况下 Node 对这两类错误会打印一段堆栈后直接退出进程（uncaughtException）
 * 或静默吞掉（unhandledRejection，旧版有告警、新版可配置）。对常驻服务而言
 * 「进程突然没了」远比「某次请求失败」更糟，这里至少保证：
 * 1. 结构化记录现场，而不是丢进黑洞；
 * 2. 对外提供计数，health 接口可暴露出来表明「进程刚吞过一次未捕获异常」。
 *
 * 不在这里 process.exit()：退出会拖垮所有健康连接；交给底层平台的重启策略处置。
 * install 幂等，可在运行时多次调用（withRoute 入口也会兜底调用一次）。
 */
import { logger } from "./logger";

interface InstallState {
  installed?: boolean;
}

const state = (globalThis as unknown as { __ocProcessGuard?: InstallState }).__ocProcessGuard ?? {
  installed: false,
};

let uncaughtCount = 0;
let rejectionCount = 0;

export function processFaultCounts(): { uncaught: number; unhandled: number } {
  return { uncaught: uncaughtCount, unhandled: rejectionCount };
}

export function installProcessGuards(): void {
  if (state.installed) return;
  state.installed = true;
  (globalThis as unknown as { __ocProcessGuard?: InstallState }).__ocProcessGuard = state;

  process.on("uncaughtException", (err) => {
    uncaughtCount += 1;
    logger.error("未捕获异常", { err, kind: "uncaughtException" });
  });

  process.on("unhandledRejection", (reason) => {
    rejectionCount += 1;
    logger.error("未处理的 Promise 拒绝", { err: reason as unknown, kind: "unhandledRejection" });
  });
}