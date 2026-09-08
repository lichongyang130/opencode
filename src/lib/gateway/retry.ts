/**
 * 可重试错误分级与指数退避（AI1/AI2/AI3）。
 *
 * 为什么放在网关层而不是各 provider 里：三个 SSE 入口（chat/research/slides）
 * 共用同一套失败语义——429/5xx/网络中断值得重试，4xx 参数错误重试只会
 * 原样失败，必须直接抛给用户改请求。退避加抖动是为了错峰：同一时刻
 * 大量客户端一起重试会把刚恢复的上游再次打挂。
 */

/** 网关层统一的错误分类；message 面向用户可读，statusCode/retryAfter 供调度决策 */
export class GatewayError extends Error {
  readonly statusCode?: number;
  /** 上游 Retry-After 换算的毫秒数（AI3）；秒数或 HTTP 日期均可解析 */
  readonly retryAfterMs?: number;
  /** 4xx 参数类错误：重试无意义 */
  readonly fatal: boolean;

  constructor(
    message: string,
    opts?: { statusCode?: number; retryAfterMs?: number; fatal?: boolean }
  ) {
    super(message);
    this.name = "GatewayError";
    this.statusCode = opts?.statusCode;
    this.retryAfterMs = opts?.retryAfterMs;
    this.fatal = opts?.fatal ?? false;
  }
}

/** AbortError 不是网关错误，原样抛出（用户主动停止不该被当成失败重试） */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * 判断是否值得重试（AI2）：
 * - 显式 fatal（4xx 参数错误）不重试；
 * - 429 与 5xx 重试；
 * - 网络层错误（TypeError/fetch 抛出）重试；
 * - 4xx 其余值不重试。
 */
export function isRetryable(err: unknown): boolean {
  if (isAbortError(err)) return false;
  if (!(err instanceof GatewayError)) return true; // 网络错误 / provider 未分类异常
  if (err.fatal) return false;
  if (err.statusCode === 429) return true;
  if (err.statusCode !== undefined && err.statusCode >= 500) return true;
  return !err.statusCode; // 无状态码的网关错误（如供应商内部超时包装）
}

/** 解析上游 Retry-After 头：支持「秒数」与 HTTP-date 两种形态（AI3） */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  // 形态一：秒数（含小数）
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Number(trimmed) * 1000);
  }
  // 形态二：HTTP 日期
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - now);
  }
  return undefined;
}

export interface RetryOptions {
  /** 最大尝试次数（含首次；1 = 不重试） */
  retries?: number;
  /** 基础退避毫秒，指数递增的底数 */
  baseDelayMs?: number;
  /** 单次退避上限，避免长退避把请求拖死 */
  maxDelayMs?: number;
  /** 抖动比例（0-1）：退避 × (1 ± jitter/2)，错峰重试 */
  jitter?: number;
  /** 测试注入用：替代真实 sleep */
  sleep?: (ms: number) => Promise<void>;
  /** 每次放弃前的钩子（用于日志/指标） */
  onRetry?: (info: { attempt: number; delayMs: number; err: unknown }) => void;
}

/**
 * 带指数退避的执行包装（AI1）。fn 抛非重试错误立即透传；
 * 重试耗尽抛最后一次错误。返回值与 fn 一致。
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  // retries 语义是「含首次的尝试次数」，0/负数没有意义；钳到 1 保证 fn 至少执行一次，
  // 否则循环体直接跳过、抛出 undefined，调用方会看到「Unknown Error」
  const retries = Math.max(1, opts.retries ?? 2);
  const base = opts.baseDelayMs ?? 500;
  const maxDelay = opts.maxDelayMs ?? 8000;
  const jitter = opts.jitter ?? 0.5;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries || !isRetryable(err)) throw err;
      // 退避：指数 + 抖动；Retry-After 优先于计算值（AI3）。
      // clamp 顺序很关键：抖动可能把延迟抬过上限，必须先抖后 clamp。
      const exp = base * 2 ** (attempt - 1);
      let delay = exp;
      if (jitter > 0) {
        delay *= 1 - jitter / 2 + Math.random() * jitter;
      }
      delay = Math.min(delay, maxDelay);
      if (err instanceof GatewayError && err.retryAfterMs !== undefined) {
        delay = Math.max(delay, err.retryAfterMs);
      }
      opts.onRetry?.({ attempt, delayMs: delay, err });
      await sleep(delay);
    }
  }
  throw lastErr;
}