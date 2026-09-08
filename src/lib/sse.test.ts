import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ABORT_TIMEOUT,
  ABORT_USER,
  finalizeStreamText,
  parseSSELine,
  streamSSE,
  type StreamResult,
} from "./sse";
import { FetchError } from "./fetcher";

/**
 * SSE 统一消费测试。
 *
 * 这一层收敛了原先散在 chat.ts 里的 5 份 reader 循环，最容易出问题的是终止语义：
 *  - 用户点停止 / 整体超时 / 流中途断开，三者的界面表现完全不同；
 *  - 重发只允许发生在「一个字节都没收到」时，否则用户会看到重复的半截回答；
 *  - 半包与脏行必须跳过而不是中断整条流。
 */

/** 一次性吐完给定分片后关闭的 SSE 响应 */
function sseOnce(chunks: string[], status = 200): Response {
  return new Response(
    new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    }),
    { status }
  );
}

/**
 * 手动可控的流，用来精确编排「流到一半发生了什么」。
 *
 * bind 必须在 mock fetch 里调用：真实 fetch 会在 signal 中断时让响应体流报错，
 * 这个行为正是 streamSSE 区分 user-abort / timeout 的依据，mock 里不补上就测不出来。
 */
function controlledSse() {
  let push!: (s: string) => void;
  let close!: () => void;
  let fail!: (e: unknown) => void;
  const stream = new ReadableStream({
    start(c) {
      const enc = new TextEncoder();
      push = (s) => c.enqueue(enc.encode(s));
      close = () => c.close();
      fail = (e) => {
        try {
          c.error(e);
        } catch {
          /* 已关闭的流再 error 会抛，忽略 */
        }
      };
    },
  });
  const bind = (signal?: AbortSignal | null) =>
    signal?.addEventListener("abort", () =>
      fail(Object.assign(new Error("aborted"), { name: "AbortError" }))
    );
  return { res: new Response(stream, { status: 200 }), push, close, fail, bind };
}

const jsonRes = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface Collected {
  events: unknown[];
  result: StreamResult;
}

/** 跑一条流并收集事件 */
async function run(
  responses: Array<Response | (() => Response | Promise<Response>)>,
  opts: { signal?: AbortSignal; retries?: number; onRetry?: (n: number) => void } = {}
): Promise<Collected> {
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const next = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return typeof next === "function" ? next() : next;
    })
  );
  const events: unknown[] = [];
  const result = await streamSSE<unknown>("https://h/api/chat", {
    body: { a: 1 },
    signal: opts.signal ?? new AbortController().signal,
    onEvent: (e) => events.push(e),
    retries: opts.retries ?? 0,
    onRetry: opts.onRetry,
  });
  return { events, result };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("parseSSELine", () => {
  it("解析合法的协议事件（AI14 归一后只认 SseEvent）", () => {
    expect(parseSSELine<{ type: string; delta: string }>('data: {"type":"delta","delta":"你"}')).toEqual({
      type: "delta",
      delta: "你",
    });
  });

  it("[DONE] 哨兵返回 null", () => {
    expect(parseSSELine("data: [DONE]")).toBeNull();
  });

  it("空载荷返回 null", () => {
    expect(parseSSELine("data:")).toBeNull();
    expect(parseSSELine("data:   ")).toBeNull();
  });

  it("坏 JSON 返回 null 而不是抛错", () => {
    expect(parseSSELine("data: {坏)")).toBeNull();
  });

  it("允许 data 与内容之间没有空格", () => {
    expect(parseSSELine('data:{"type":"delta","delta":"x"}')).toEqual({ type: "delta", delta: "x" });
  });

  it("非协议载荷（无 type 字段）在归一化后返回 null", () => {
    // AI14：parseSSELine 走 parseSseEvent 归一，非四类事件的载荷直接丢弃
    expect(parseSSELine('data: {"a":1}')).toBeNull();
  });
});

describe("正常流式消费", () => {
  it("逐条派发事件并以 done 收尾", async () => {
    const { events, result } = await run([
      sseOnce([
        'data: {"type":"token","delta":"你"}\n',
        'data: {"type":"token","delta":"好"}\n',
      ]),
    ]);
    expect(events).toEqual([
      { type: "delta", delta: "你" },
      { type: "delta", delta: "好" },
    ]);
    expect(result).toMatchObject({ reason: "done", events: 2 });
  });

  it("半包（分片断在 JSON 中间）能拼回完整事件", async () => {
    const { events, result } = await run([
      sseOnce(['data: {"type":"tok', 'en","delta":"拼"}\n', 'data: {"type":"token","delta":"好"}\n']),
    ]);
    expect(events).toEqual([
      { type: "delta", delta: "拼" },
      { type: "delta", delta: "好" },
    ]);
    expect(result.reason).toBe("done");
  });

  it("多字节字符跨分片切开不会乱码", async () => {
    const bytes = new TextEncoder().encode('data: {"type":"token","delta":"漢"}\n');
    const res = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(bytes.slice(0, 30));
          c.enqueue(bytes.slice(30));
          c.close();
        },
      }),
      { status: 200 }
    );
    const { events } = await run([res]);
    expect(events).toEqual([{ type: "delta", delta: "漢" }]);
  });

  it("跳过注释行、空行与非 data 行", async () => {
    const { events, result } = await run([
      sseOnce([": keep-alive\n", "\n", "event: ping\n", 'data: {"type":"token","delta":"x"}\n']),
    ]);
    expect(events).toHaveLength(1);
    expect(result.events).toBe(1);
  });

  it("脏 data 行不中断整条流", async () => {
    const { events, result } = await run([
      sseOnce([
        'data: {"type":"token","delta":"前"}\n',
        "data: {这行是坏的\n",
        'data: {"type":"token","delta":"后"}\n',
      ]),
    ]);
    expect(events).toEqual([
      { type: "delta", delta: "前" },
      { type: "delta", delta: "后" },
    ]);
    expect(result.reason).toBe("done");
  });

  it("空流也算正常结束", async () => {
    const { result } = await run([sseOnce([])]);
    expect(result).toMatchObject({ reason: "done", events: 0 });
  });

  it("POST 请求体是序列化后的 body", async () => {
    let init: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: unknown, i?: RequestInit) => {
        init = i;
        return sseOnce([]);
      })
    );
    await streamSSE("https://h/api/chat", {
      body: { hello: "world" },
      signal: new AbortController().signal,
      onEvent: () => {},
    });
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"hello":"world"}');
  });
});

describe("中断语义", () => {
  it("开始前就已中断时直接返回 user-abort，不发请求", async () => {
    const fetchMock = vi.fn(async () => sseOnce([]));
    vi.stubGlobal("fetch", fetchMock);
    const ac = new AbortController();
    ac.abort(ABORT_USER);
    const r = await streamSSE("https://h/x", {
      body: {},
      signal: ac.signal,
      onEvent: () => {},
    });
    expect(r).toMatchObject({ reason: "user-abort", events: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("开始前已因超时中断时返回 timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseOnce([])));
    const ac = new AbortController();
    ac.abort(ABORT_TIMEOUT);
    const r = await streamSSE("https://h/x", { body: {}, signal: ac.signal, onEvent: () => {} });
    expect(r.reason).toBe("timeout");
  });

  it("流中途用户停止：保留已收事件数并返回 user-abort", async () => {
    const { res, push, bind } = controlledSse();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: unknown, init?: RequestInit) => {
        bind(init?.signal);
        return res;
      })
    );
    const ac = new AbortController();
    const events: unknown[] = [];
    const p = streamSSE<unknown>("https://h/x", {
      body: {},
      signal: ac.signal,
      onEvent: (e) => {
        events.push(e);
        // 收到第一个 token 就模拟用户点「停止生成」
        if (events.length === 1) ac.abort(ABORT_USER);
      },
    });
    push('data: {"type":"token","delta":"半"}\n');
    const r = await p;
    expect(r).toMatchObject({ reason: "user-abort", events: 1 });
  });

  it("流中途整体超时：返回 timeout", async () => {
    const { res, push, bind } = controlledSse();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: unknown, init?: RequestInit) => {
        bind(init?.signal);
        return res;
      })
    );
    const ac = new AbortController();
    const p = streamSSE<unknown>("https://h/x", {
      body: {},
      signal: ac.signal,
      onEvent: () => ac.abort(ABORT_TIMEOUT),
    });
    push('data: {"type":"token","delta":"半"}\n');
    const r = await p;
    expect(r.reason).toBe("timeout");
  });

  it("已产出内容后流断开：返回 interrupted 并带原因，不重发", async () => {
    const { res, push, fail } = controlledSse();
    const fetchMock = vi.fn(async () => res);
    vi.stubGlobal("fetch", fetchMock);
    const events: unknown[] = [];
    const p = streamSSE<unknown>("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: (e) => events.push(e),
      retries: 2,
    });
    push('data: {"type":"token","delta":"已生成"}\n');
    // 等这一片被消费掉，确保 received > 0
    await new Promise((r) => setTimeout(r, 10));
    fail(new Error("socket hang up"));
    const r = await p;
    expect(r).toMatchObject({ reason: "interrupted", events: 1 });
    expect(r.error).toContain("socket hang up");
    // 关键：已经吐过内容就绝不重发，否则界面会出现重复的半截回答
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("建连失败与重试", () => {
  it("建连失败时按 retries 重发并回报次数", async () => {
    const onRetry = vi.fn();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls < 3) throw new TypeError("Failed to fetch");
        return sseOnce(['data: {"type":"token","delta":"ok"}\n']);
      })
    );
    const events: unknown[] = [];
    const r = await streamSSE<unknown>("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: (e) => events.push(e),
      retries: 2,
      onRetry,
    });
    expect(r.reason).toBe("done");
    expect(calls).toBe(3);
    expect(onRetry.mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });

  it("重试用尽后抛 network 错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    const err = await streamSSE("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: () => {},
      retries: 1,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(FetchError);
    expect((err as FetchError).kind).toBe("network");
  });

  it("建连超时抛 timeout 并带秒数", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_u: string, init?: RequestInit) =>
          new Promise<Response>((_res, rej) => {
            init?.signal?.addEventListener("abort", () =>
              rej(Object.assign(new Error("aborted"), { name: "AbortError" }))
            );
          })
      )
    );
    const err = await streamSSE("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: () => {},
      retries: 0,
      connectTimeoutMs: 20,
    }).catch((e) => e);
    expect((err as FetchError).kind).toBe("timeout");
    expect((err as FetchError).message).toContain("建立连接超时");
  });

  it("建连阶段被用户取消时返回 user-abort 而不是抛错", async () => {
    const ac = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_u: string, init?: RequestInit) => {
        // 请求发出后立刻模拟用户点停止
        setTimeout(() => ac.abort(ABORT_USER), 0);
        return new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener("abort", () =>
            rej(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        });
      })
    );
    const r = await streamSSE("https://h/x", {
      body: {},
      signal: ac.signal,
      onEvent: () => {},
      retries: 2,
    });
    expect(r.reason).toBe("user-abort");
  });

  it("离线时直接抛 offline，不发请求", async () => {
    const fetchMock = vi.fn(async () => sseOnce([]));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: false });
    const err = await streamSSE("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: () => {},
    }).catch((e) => e);
    expect((err as FetchError).kind).toBe("offline");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("HTTP 错误响应", () => {
  it.each([502, 503, 504])("网关类 %i 会重试", async (status) => {
    const onRetry = vi.fn();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return calls < 2 ? jsonRes({ error: "上游繁忙" }, status) : sseOnce([]);
      })
    );
    const r = await streamSSE("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: () => {},
      retries: 2,
      onRetry,
    });
    expect(r.reason).toBe("done");
    expect(onRetry).toHaveBeenCalledWith(1);
  });

  it.each([400, 401, 429, 500])("非网关类 %i 不重试，直接抛", async (status) => {
    const fetchMock = vi.fn(async () => jsonRes({ error: "拒绝" }, status));
    vi.stubGlobal("fetch", fetchMock);
    const err = await streamSSE("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: () => {},
      retries: 2,
    }).catch((e) => e);
    expect((err as FetchError).status).toBe(status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("错误文案以「请求失败 <状态码>」开头（store 用例依赖这个格式）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ error: "上游异常" }, 500)));
    const err = await streamSSE("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: () => {},
      retries: 0,
    }).catch((e) => e);
    expect((err as FetchError).message).toBe("请求失败 500：上游异常");
  });

  it("错误体不是 JSON 时只保留状态码前缀", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 500 })));
    const err = await streamSSE("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: () => {},
      retries: 0,
    }).catch((e) => e);
    expect((err as FetchError).message).toBe("请求失败 500");
  });

  it("错误体只有 message 字段时同样能取到", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ message: "细节" }, 500)));
    const err = await streamSSE("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: () => {},
      retries: 0,
    }).catch((e) => e);
    expect((err as FetchError).message).toBe("请求失败 500：细节");
  });

  it("2xx 但没有响应体时抛 parse", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const err = await streamSSE("https://h/x", {
      body: {},
      signal: new AbortController().signal,
      onEvent: () => {},
    }).catch((e) => e);
    expect((err as FetchError).kind).toBe("parse");
  });
});

describe("finalizeStreamText", () => {
  const done: StreamResult = { reason: "done", events: 1 };

  it("服务端 error 事件优先，文案带告警前缀并标记 error", () => {
    expect(finalizeStreamText("已有内容", done, "余额不足")).toEqual({
      content: "⚠️ 余额不足",
      error: true,
    });
  });

  it("正常结束原样返回已拼内容", () => {
    expect(finalizeStreamText("完整回答", done)).toEqual({ content: "完整回答", error: false });
  });

  it("用户停止且已有内容：保留内容且不算错误", () => {
    const r = finalizeStreamText("半截", { reason: "user-abort", events: 1 });
    expect(r).toEqual({ content: "半截", error: false });
  });

  it("用户停止且无内容：给出固定文案（store 用例断言这个字符串）", () => {
    const r = finalizeStreamText("", { reason: "user-abort", events: 0 });
    expect(r).toEqual({ content: "已停止生成。", error: false });
  });

  it("超时且已有内容：追加提示并保留内容", () => {
    const r = finalizeStreamText("半截", { reason: "timeout", events: 1 });
    expect(r.content).toContain("半截");
    expect(r.content).toContain("模型响应超时");
    expect(r.error).toBe(false);
  });

  it("超时且无内容：整条算失败", () => {
    const r = finalizeStreamText("", { reason: "timeout", events: 0 });
    expect(r.error).toBe(true);
    expect(r.content).toContain("模型响应超时");
  });

  it("中断且已有内容：追加提示并保留内容", () => {
    const r = finalizeStreamText("半截", { reason: "interrupted", events: 1, error: "reset" });
    expect(r.content).toContain("半截");
    expect(r.content).toContain("连接中断");
    expect(r.error).toBe(false);
  });

  it("中断且无内容：带上原始错误信息并标记失败", () => {
    const r = finalizeStreamText("", { reason: "interrupted", events: 0, error: "socket hang up" });
    expect(r).toEqual({ content: "⚠️ 连接中断：socket hang up", error: true });
  });

  it("中断且无内容也没有错误信息时给兜底文案", () => {
    const r = finalizeStreamText("", { reason: "interrupted", events: 0 });
    expect(r.content).toBe("⚠️ 连接中断：网络异常");
  });
});