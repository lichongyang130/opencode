/**
 * SSE 连接数上限与超时兜底（O12）。
 *
 * 流式接口（chat/research/slides）一旦客户端断了又没正常释放，底层 ReadableStream
 * 可能一直挂着不 close，连接越积越多把进程句柄耗光。这里用一个全局计数器
 * 限制同时活跃的流式连接数；每个 slot 自带硬超时，到点强制 abort 上游，
 * 保证再异常的路径也不会永久占用额度。
 */
import { logger } from "./logger";

const DEFAULT_MAX = 32;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;

let active = 0;

function limit(): number {
  const n = Number(process.env.OC_SSE_MAX_CONCURRENCY ?? "");
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX;
}

function timeoutMs(): number {
  const n = Number(process.env.OC_SSE_CONN_TIMEOUT_MS ?? "");
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

export interface SseSlot {
  /** 上游生成逻辑应 merge 这个 signal，超时/释放时中止模型请求 */
  signal: AbortSignal;
  release: () => void;
}

export function activeSseCount(): number {
  return active;
}

export function sseMaxConcurrency(): number {
  return limit();
}

/** 申请一个流式连接槽位；满员返回 null，调用方回 503 让客户端稍后重试 */
export function acquireSseSlot(): SseSlot | null {
  if (active >= limit()) return null;

  const controller = new AbortController();
  let released = false;
  const timer = setTimeout(() => {
    // 超时属异常路径，打 warn 记录（正常流程会在最后 release 前先 clearTimeout）
    logger.warn("SSE 连接超时，强制中止", { maxMs: timeoutMs() });
    controller.abort();
  }, timeoutMs());

  active += 1;

  return {
    signal: controller.signal,
    release: () => {
      if (released) return;
      released = true;
      clearTimeout(timer);
      active = Math.max(0, active - 1);
    },
  };
}