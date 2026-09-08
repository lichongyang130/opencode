/**
 * SSE 流式消费的统一实现。
 *
 * 原先 chat.ts 里 5 条链路各自手写了一遍 reader 循环，重复且行为不一致：
 * 中断原因分不清、建连失败没有重试、流断在中途时已生成的内容会被错误文案覆盖。
 * 这里收敛成一处，并明确四种终止语义（R8）与建连阶段的有限重试（R9）。
 */

import { FetchError, isOffline } from "@/lib/fetcher";
import { parseSseEvent } from "@/lib/sse-events";

/** 中断原因标记：借 AbortSignal.reason 传递，用于区分超时与用户主动停止 */
export const ABORT_TIMEOUT = "oc:abort-timeout";
export const ABORT_USER = "oc:abort-user";

export type StreamEndReason =
  /** 服务端正常关闭流 */
  | "done"
  /** 用户点了停止生成 */
  | "user-abort"
  /** 整体超时 */
  | "timeout"
  /** 流在中途断开 */
  | "interrupted";

export interface StreamResult {
  reason: StreamEndReason;
  /** 收到的事件条数，用来判断「是否已经产出过内容」 */
  events: number;
  /** interrupted 时的原始错误信息 */
  error?: string;
}

export interface StreamOptions<E> {
  /** HTTP 方法（默认 POST；research 重写等场景用 PUT） */
  method?: string;
  body: unknown;
  /** 外部中断信号（停止生成 / 整体超时），生命周期覆盖整条流 */
  signal: AbortSignal;
  onEvent: (evt: E) => void;
  /** 建连超时（只覆盖到响应头到达为止），默认 20s */
  connectTimeoutMs?: number;
  /** 建连失败的重试次数，默认 2 —— 只在「一个字节都没收到」时重试，避免内容重复 */
  retries?: number;
  onRetry?: (attempt: number) => void;
}

/** 只有网关类状态码值得重试：服务端已明确回 500 说明请求本身出了问题 */
const RETRIABLE_STATUS = new Set([502, 503, 504]);

function reasonOf(signal: AbortSignal): StreamEndReason {
  return signal.reason === ABORT_TIMEOUT ? "timeout" : "user-abort";
}

/**
 * 建连（带重试）后逐行消费 SSE。
 *
 * 关键取舍：只有「尚未收到任何字节」时才重发整个请求。
 * 流已经吐过内容再重发会让用户看到重复的半截回答，
 * 所以中途断开只回报 interrupted，把已收到的内容留在界面上。
 */
export async function streamSSE<E>(
  url: string,
  { method = "POST", body, signal, onEvent, connectTimeoutMs = 20_000, retries = 2, onRetry }: StreamOptions<E>
): Promise<StreamResult> {
  let events = 0;
  const payload = JSON.stringify(body);

  for (let attempt = 0; ; attempt += 1) {
    if (signal.aborted) return { reason: reasonOf(signal), events };
    if (isOffline()) throw new FetchError("offline", "当前网络已断开，请检查连接后重试");

    /*
     * linked 的生命周期必须覆盖「建连 + 整条流」：
     * 传给 fetch 的 signal 同时控制响应体流，若在拿到响应头后就解绑外部监听，
     * 用户点「停止生成」将无法真正掐断正在传输的流。
     */
    const linked = new AbortController();
    const forward = () => linked.abort(signal.reason ?? ABORT_USER);
    signal.addEventListener("abort", forward);
    let connectTimedOut = false;
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      connectTimedOut = true;
      linked.abort(ABORT_TIMEOUT);
    }, connectTimeoutMs);
    const clearConnectTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const release = () => {
      clearConnectTimer();
      signal.removeEventListener("abort", forward);
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: linked.signal,
      });
      // 响应头已到，剩下的时长由外部 signal 的整体超时兜住
      clearConnectTimer();
    } catch (e) {
      release();
      if (signal.aborted) return { reason: reasonOf(signal), events };
      const err = connectTimedOut
        ? new FetchError("timeout", `建立连接超时（超过 ${Math.round(connectTimeoutMs / 1000)} 秒）`)
        : new FetchError("network", e instanceof Error ? e.message : "网络请求失败");
      if (attempt < retries) {
        onRetry?.(attempt + 1);
        await backoff(attempt, signal);
        continue;
      }
      throw err;
    }

    if (!res.ok) {
      const message = await readError(res);
      release();
      if (attempt < retries && RETRIABLE_STATUS.has(res.status)) {
        onRetry?.(attempt + 1);
        await backoff(attempt, signal);
        continue;
      }
      throw new FetchError("http", message, res.status);
    }
    if (!res.body) {
      release();
      throw new FetchError("parse", "服务端未返回流式响应");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let received = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value?.byteLength ?? 0;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // 最后一段可能是半包，留到下一轮再拼
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const evt = parseSSELine<E>(trimmed);
          if (evt === null) continue;
          events += 1;
          onEvent(evt);
        }
      }
      return { reason: "done", events };
    } catch (e) {
      if (signal.aborted) return { reason: reasonOf(signal), events };
      const message = e instanceof Error ? e.message : "连接中断";
      // 一个字节都没收到，等价于建连失败，可以安全重发
      if (received === 0 && attempt < retries) {
        onRetry?.(attempt + 1);
        await backoff(attempt, signal);
        continue;
      }
      return { reason: "interrupted", events, error: message };
    } finally {
      release();
      // 提前 return 时主动释放底层连接，否则 keep-alive 连接会悬着
      void reader.cancel().catch(() => {});
    }
  }
}

/** 安全解析 `data: {...}`；半包或脏行返回 null 而不是抛错中断整条流（AI14：统一走 sse-events 协议归一） */
export function parseSSELine<T>(line: string): T | null {
  return parseSseEvent(line) as T | null;
}

async function readError(res: Response): Promise<string> {
  // 状态码放在开头固定成「请求失败 <code>」，便于用户与日志一眼对齐 HTTP 语义
  const base = `请求失败 ${res.status}`;
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    const detail = data.error || data.message;
    return detail ? `${base}：${detail}` : base;
  } catch {
    return base;
  }
}

function backoff(attempt: number, signal: AbortSignal): Promise<void> {
  const delay = Math.min(300 * 2 ** attempt, 2_000);
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, delay);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** 把终止语义翻成最终气泡内容与错误标记（R8：三种中断文案各不相同） */
export function finalizeStreamText(
  soFar: string,
  result: StreamResult,
  serverError?: string | null
): { content: string; error: boolean } {
  if (serverError) return { content: `⚠️ ${serverError}`, error: true };
  switch (result.reason) {
    case "user-abort":
      return { content: soFar || "已停止生成。", error: false };
    case "timeout":
      return soFar
        ? { content: `${soFar}\n\n⚠️ 模型响应超时，已保留上面的部分内容。`, error: false }
        : { content: "⚠️ 模型响应超时，请重试或换一个模型。", error: true };
    case "interrupted":
      return soFar
        ? { content: `${soFar}\n\n⚠️ 连接中断，已保留上面的部分内容。`, error: false }
        : { content: `⚠️ 连接中断：${result.error ?? "网络异常"}`, error: true };
    default:
      return { content: soFar, error: false };
  }
}
