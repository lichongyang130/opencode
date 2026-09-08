import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSseStream } from "./useSseStream";

/**
 * AI15：useSseStream 收敛四处手写 reader 循环。
 * 用手工构造的 ReadableStream 精确编排分片边界，验证半包拼接与事件语义。
 */

function sseRes(chunks: string[], init?: ResponseInit) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(stream, {
    ...init,
    headers: { "Content-Type": "text/event-stream", ...(init?.headers ?? {}) },
  });
}

let seq = 0;
function pushChunk(parts: string[]) {
  return { chunkParts: parts };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const p = pushQueue[seq] ?? { chunkParts: [] };
      seq += 1;
      return sseRes(p.chunkParts);
    })
  );
});

let pushQueue: { chunkParts: string[] }[] = [];

beforeEach(() => {
  pushQueue = [];
  seq = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSseStream", () => {
  it("跨分片拼接 delta 事件并累积文本", async () => {
    pushQueue = [
      {
        // 故意把一个事件劈成两个 chunk：半包必须被正确缓冲
        chunkParts: ['data: {"type":"delta","del', 'ta":"你好"}\n\n', 'data: {"type":"delta","delta":"世界"}\n\n'],
      },
    ];
    const { result } = renderHook(() => useSseStream());

    await act(async () => {
      await result.current.start({ url: "/api/chat", method: "POST" });
    });

    expect(result.current.text).toBe("你好世界");
    expect(result.current.finished).toBe(true);
    expect(result.current.busy).toBe(false);
  });

  it("error 事件抛出为 reject，已累积文本保留", async () => {
    pushQueue = [
      {
        chunkParts: ['data: {"type":"delta","delta":"部分"}\n\n', 'data: {"type":"error","message":"上游超时"}\n\n'],
      },
    ];
    const { result } = renderHook(() => useSseStream());

    let caught: unknown = null;
    await act(async () => {
      await result.current
        .start({ url: "/api/chat", method: "POST" })
        .catch((e) => (caught = e));
    });

    expect((caught as Error).message).toBe("上游超时");
    expect(result.current.text).toBe("部分");
  });

  it("非 2xx 状态码抛「请求失败 <code>」", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseRes([], { status: 503 }))
    );
    const { result } = renderHook(() => useSseStream());

    await act(async () => {
      await expect(
        result.current.start({ url: "/api/chat", method: "POST" })
      ).rejects.toThrow("请求失败 503");
    });
  });

  it("stop() 中止后流结束且不抛错", async () => {
    let pullResolve: (() => void) | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode('data: {"type":"delta","delta":"前半"}\n\n'));
        // 挂住第二个 chunk：等 stop 之后再 close，模拟长连接被掐断
        void new Promise<void>((r) => (pullResolve = r)).then(() => controller.close());
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream, { headers: { "Content-Type": "text/event-stream" } }))
    );

    const { result } = renderHook(() => useSseStream());
    let running: Promise<string> | null = null;
    act(() => {
      running = result.current.start({ url: "/api/chat", method: "POST" });
    });

    await waitFor(() => expect(result.current.text).toBe("前半"));
    act(() => {
      result.current.stop();
      pullResolve?.();
    });
    await act(async () => {
      await running?.catch(() => "aborted-ok");
    });
    expect(result.current.busy).toBe(false);
  });

  it("并发 start 被忽略：同一时刻只有一条流", async () => {
    pushQueue = [{ chunkParts: ['data: {"type":"delta","delta":"a"}\n\n'] }];
    const { result } = renderHook(() => useSseStream());

    let p1: Promise<string> | null = null;
    act(() => {
      p1 = result.current.start({ url: "/api/chat", method: "POST" });
    });
    // busy 期间再次 start：直接返回当前文本，不重发请求
    let second: string | null = null;
    await act(async () => {
      second = await result.current.start({ url: "/api/chat", method: "POST" });
    });
    expect(second).toBe("");
    await act(async () => {
      await p1;
    });
    expect(result.current.text).toBe("a");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("onEvent 透传归一化后的事件（含旧事件名 token）", async () => {
    pushQueue = [{ chunkParts: ['data: {"type":"token","delta":"旧名"}\n\n'] }];
    const seen: string[] = [];
    const { result } = renderHook(() =>
      useSseStream((evt) => seen.push(evt.type))
    );

    await act(async () => {
      await result.current.start({ url: "/api/chat", method: "POST" });
    });

    expect(result.current.text).toBe("旧名");
    expect(seen).toEqual(["delta"]);
  });
});