/**
 * 前端统一 fetch 封装。
 *
 * 项目里 30+ 处前端 fetch 原先都没有超时：服务端不响应时请求会一直挂着，
 * 按钮永久转圈、用户既等不到结果也拿不到错误。这里统一加超时与错误归类。
 */

/** 网络错误的成因分类，决定 UI 展示哪种文案与是否可重试 */
export type NetErrorKind = "timeout" | "abort" | "offline" | "http" | "network" | "parse";

export class FetchError extends Error {
  kind: NetErrorKind;
  status?: number;
  constructor(kind: NetErrorKind, message: string, status?: number) {
    super(message);
    this.name = "FetchError";
    this.kind = kind;
    this.status = status;
  }
}

export interface FetchOptions extends RequestInit {
  /** 超时毫秒数，默认 30s；流式接口应显式传更大值或 0（不超时） */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 30_000;

/** 浏览器是否明确处于离线（navigator.onLine 为 false 才算，缺失时按在线处理） */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * 把外部传入的 signal 与内部超时 signal 合并。
 * 不用 AbortSignal.any —— Node 18 与部分浏览器版本没有，且要拿到 timer 句柄清理。
 */
function withTimeout(
  timeoutMs: number,
  external?: AbortSignal | null
): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
    timedOut: () => timedOut,
  };
}

/** 带超时的 fetch；失败一律抛 FetchError，调用方可按 kind 分支处理 */
export async function fetchWithTimeout(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT, signal, ...init }: FetchOptions = {}
): Promise<Response> {
  if (isOffline()) throw new FetchError("offline", "当前网络已断开，请检查连接后重试");

  const t = withTimeout(timeoutMs, signal);
  try {
    return await fetch(url, { ...init, signal: t.signal });
  } catch (e) {
    if (t.timedOut()) {
      throw new FetchError("timeout", `请求超时（超过 ${Math.round(timeoutMs / 1000)} 秒未响应）`);
    }
    // 外部 signal 触发的中断视为用户主动取消，不该弹错误提示
    if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) {
      throw new FetchError("abort", "请求已取消");
    }
    if (isOffline()) throw new FetchError("offline", "当前网络已断开，请检查连接后重试");
    throw new FetchError("network", e instanceof Error ? e.message : "网络请求失败");
  } finally {
    t.cleanup();
  }
}

/** 从错误响应体里尽量取出服务端给的 error 文案 */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    const detail = data.error || data.message;
    return detail ? `${detail}（HTTP ${res.status}）` : `请求失败（HTTP ${res.status}）`;
  } catch {
    return `请求失败（HTTP ${res.status}）`;
  }
}

/** 带超时的 JSON 请求：非 2xx 抛 FetchError("http")，解析失败抛 FetchError("parse") */
export async function fetchJSON<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetchWithTimeout(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new FetchError("http", await readErrorMessage(res), res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new FetchError("parse", "服务端返回的数据无法解析");
  }
}

/** 统一的用户可读文案（R8：区分用户主动停止 / 网络断开 / 服务端错误） */
export function describeNetError(e: unknown): string {
  if (e instanceof FetchError) return e.message;
  if (e instanceof Error) {
    if (e.name === "AbortError") return "请求已取消";
    return e.message || "网络请求失败";
  }
  return "网络请求失败";
}

/** 该错误是否值得自动重试（用户主动取消与 4xx 不重试） */
export function isRetriable(e: unknown): boolean {
  if (!(e instanceof FetchError)) return false;
  if (e.kind === "abort") return false;
  if (e.kind === "http") return (e.status ?? 0) >= 500;
  return e.kind === "timeout" || e.kind === "network";
}

/**
 * 指数退避重试（R9）。
 * onRetry 让调用方能提示"正在重连（第 n 次）"，shouldRetry 可覆盖默认判定。
 */
export async function retryWithBackoff<T>(
  task: (attempt: number) => Promise<T>,
  {
    retries = 2,
    baseDelayMs = 600,
    maxDelayMs = 4_000,
    shouldRetry = isRetriable,
    onRetry,
    signal,
  }: {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (e: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void;
    signal?: AbortSignal | null;
  } = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task(attempt);
    } catch (e) {
      lastError = e;
      const isLast = attempt === retries;
      if (isLast || signal?.aborted || !shouldRetry(e)) throw e;
      onRetry?.(attempt + 1, e);
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delay);
        // 等待期间被取消要立刻退出，否则停止生成后还会白等一轮退避
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      if (signal?.aborted) throw e;
    }
  }
  throw lastError;
}