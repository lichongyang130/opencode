import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FetchError,
  describeNetError,
  fetchJSON,
  fetchWithTimeout,
  isOffline,
  isRetriable,
  retryWithBackoff,
} from "./fetcher";

/**
 * 前端 fetch 封装测试。
 *
 * 重点钉住三件事：
 *  1) 超时一定会触发（原先 30+ 处 fetch 没有超时，服务端不响应时按钮永久转圈）；
 *  2) 超时 / 用户取消 / 离线 / HTTP 错误必须落到不同的 kind，UI 才能给出对的文案；
 *  3) 重试只覆盖真正可重试的错误，且退避等待期间被取消要立刻退出。
 */

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** 永不 settle 的 fetch，只在收到 abort 时才 reject —— 用来复现「服务端不响应」 */
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    const abortError = () => Object.assign(new Error("aborted"), { name: "AbortError" });
    // 传入时就已中断的 signal 不会再派发 abort 事件，必须先判一次，
    // 否则 mock 永不 settle，测试只会等到超时而看不出真实行为
    if (init?.signal?.aborted) return Promise.reject(abortError());
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(abortError()));
    });
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  // 顺序要紧：useRealTimers 必须先于 restoreAllMocks。
  // 反过来会把「假的、已停用的 setTimeout」还原成全局实现，后面所有用例的定时器都不再触发
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("isOffline", () => {
  it("navigator.onLine 为 false 时判定离线", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isOffline()).toBe(true);
  });

  it("onLine 为 true 时判定在线", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(isOffline()).toBe(false);
  });

  it("navigator 缺失时按在线处理（服务端渲染场景）", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isOffline()).toBe(false);
  });

  it("onLine 字段缺失时不误判为离线", () => {
    vi.stubGlobal("navigator", {});
    expect(isOffline()).toBe(false);
  });
});

describe("fetchWithTimeout", () => {
  it("正常响应原样返回", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ ok: true })));
    const res = await fetchWithTimeout("https://h/x");
    expect(res.status).toBe(200);
  });

  it("超时抛 FetchError('timeout') 并带上秒数", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const err = await fetchWithTimeout("https://h/x", { timeoutMs: 20 }).catch((e) => e);
    expect(err).toBeInstanceOf(FetchError);
    expect((err as FetchError).kind).toBe("timeout");
    expect((err as FetchError).message).toContain("请求超时");
  });

  it("timeoutMs 为 0 时不设超时", async () => {

    const spy = vi.spyOn(globalThis, "setTimeout");
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ ok: true })));
    await fetchWithTimeout("https://h/x", { timeoutMs: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("外部 signal 中断归类为 abort，不当成错误提示", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const ac = new AbortController();
    const p = fetchWithTimeout("https://h/x", { signal: ac.signal, timeoutMs: 5_000 });
    ac.abort();
    const err = await p.catch((e) => e);
    expect((err as FetchError).kind).toBe("abort");
    expect((err as FetchError).message).toBe("请求已取消");
  });

  it("传入已中断的 signal 时立刻取消，不发真实请求", async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const ac = new AbortController();
    ac.abort();
    const err = await fetchWithTimeout("https://h/x", { signal: ac.signal }).catch((e) => e);
    expect((err as FetchError).kind).toBe("abort");
  });

  it("离线时直接抛 offline，不浪费一次请求", async () => {
    const fetchMock = vi.fn(async () => jsonRes({}));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: false });
    const err = await fetchWithTimeout("https://h/x").catch((e) => e);
    expect((err as FetchError).kind).toBe("offline");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetch 抛普通错误归类为 network 并保留原始信息", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    const err = await fetchWithTimeout("https://h/x").catch((e) => e);
    expect((err as FetchError).kind).toBe("network");
    expect((err as FetchError).message).toBe("Failed to fetch");
  });

  it("请求过程中变成离线时归类为 offline", async () => {
    let offline = false;
    vi.stubGlobal("navigator", {
      get onLine() {
        return !offline;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        offline = true;
        throw new TypeError("Failed to fetch");
      })
    );
    const err = await fetchWithTimeout("https://h/x").catch((e) => e);
    expect((err as FetchError).kind).toBe("offline");
  });

  it("超时后清理定时器，不留悬挂句柄", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({})));
    await fetchWithTimeout("https://h/x", { timeoutMs: 5_000 });
    expect(clearSpy).toHaveBeenCalled();
  });

  it("透传 method 与 body", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonRes({}));
    vi.stubGlobal("fetch", fetchMock);
    await fetchWithTimeout("https://h/x", { method: "POST", body: "hi" });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: "hi" });
  });
});

describe("fetchJSON", () => {
  it("2xx 时返回解析后的对象", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ a: 1 })));
    await expect(fetchJSON<{ a: number }>("https://h/x")).resolves.toEqual({ a: 1 });
  });

  it("默认带上 JSON Content-Type", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonRes({}));
    vi.stubGlobal("fetch", fetchMock);
    await fetchJSON("https://h/x");
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("调用方可覆盖 headers", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonRes({}));
    vi.stubGlobal("fetch", fetchMock);
    await fetchJSON("https://h/x", { headers: { "Content-Type": "text/plain", "X-A": "1" } });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers).toMatchObject({ "Content-Type": "text/plain", "X-A": "1" });
  });

  it("非 2xx 抛 http 错误并带状态码", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ error: "参数不合法" }, 400)));
    const err = await fetchJSON("https://h/x").catch((e) => e);
    expect((err as FetchError).kind).toBe("http");
    expect((err as FetchError).status).toBe(400);
    expect((err as FetchError).message).toContain("参数不合法");
    expect((err as FetchError).message).toContain("HTTP 400");
  });

  it("错误体用 message 字段时同样能取到", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ message: "内部异常" }, 500)));
    const err = await fetchJSON("https://h/x").catch((e) => e);
    expect((err as FetchError).message).toContain("内部异常");
  });

  it("错误体不是 JSON 时退化成通用文案", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502</html>", { status: 502 })));
    const err = await fetchJSON("https://h/x").catch((e) => e);
    expect((err as FetchError).message).toBe("请求失败（HTTP 502）");
  });

  it("2xx 但响应体不是 JSON 时抛 parse", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 200 })));
    const err = await fetchJSON("https://h/x").catch((e) => e);
    expect((err as FetchError).kind).toBe("parse");
    expect((err as FetchError).message).toBe("服务端返回的数据无法解析");
  });
});

describe("describeNetError", () => {
  it("FetchError 直接用自带文案", () => {
    expect(describeNetError(new FetchError("timeout", "请求超时（超过 30 秒未响应）"))).toBe(
      "请求超时（超过 30 秒未响应）"
    );
  });

  it("原生 AbortError 归到已取消", () => {
    const e = new Error("x");
    e.name = "AbortError";
    expect(describeNetError(e)).toBe("请求已取消");
  });

  it("普通 Error 透传 message（store 测试断言的 Failed to fetch 依赖这条）", () => {
    expect(describeNetError(new TypeError("Failed to fetch"))).toBe("Failed to fetch");
  });

  it("message 为空的 Error 退化成通用文案", () => {
    expect(describeNetError(new Error(""))).toBe("网络请求失败");
  });

  it.each([[null], [undefined], ["字符串"], [42], [{}]])("非 Error 值 %s 退化成通用文案", (v) => {
    expect(describeNetError(v)).toBe("网络请求失败");
  });
});

describe("isRetriable", () => {
  it.each([
    ["timeout", true],
    ["network", true],
    ["abort", false],
    ["offline", false],
    ["parse", false],
  ] as const)("%s -> %s", (kind, expected) => {
    expect(isRetriable(new FetchError(kind, "x"))).toBe(expected);
  });

  it("5xx 可重试", () => {
    expect(isRetriable(new FetchError("http", "x", 500))).toBe(true);
    expect(isRetriable(new FetchError("http", "x", 503))).toBe(true);
  });

  it("4xx 不重试（重试也不会变好）", () => {
    expect(isRetriable(new FetchError("http", "x", 400))).toBe(false);
    expect(isRetriable(new FetchError("http", "x", 404))).toBe(false);
  });

  it("http 但没有状态码时不重试", () => {
    expect(isRetriable(new FetchError("http", "x"))).toBe(false);
  });

  it("非 FetchError 一律不重试", () => {
    expect(isRetriable(new Error("boom"))).toBe(false);
    expect(isRetriable("boom")).toBe(false);
  });
});

describe("retryWithBackoff", () => {
  it("首次成功不重试", async () => {
    const task = vi.fn(async () => "ok");
    await expect(retryWithBackoff(task)).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("可重试错误会重试到成功，并回报尝试序号", async () => {
    const attempts: number[] = [];
    const task = vi.fn(async (attempt: number) => {
      if (attempt < 2) throw new FetchError("network", "boom");
      return "ok";
    });
    const r = await retryWithBackoff(task, {
      retries: 2,
      baseDelayMs: 1,
      onRetry: (n) => attempts.push(n),
    });
    expect(r).toBe("ok");
    expect(task).toHaveBeenCalledTimes(3);
    expect(attempts).toEqual([1, 2]);
  });

  it("重试用尽后抛出最后一次错误", async () => {
    const task = vi.fn(async () => {
      throw new FetchError("network", "第 n 次失败");
    });
    await expect(retryWithBackoff(task, { retries: 1, baseDelayMs: 1 })).rejects.toThrow(
      "第 n 次失败"
    );
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("不可重试的错误立刻抛出", async () => {
    const task = vi.fn(async () => {
      throw new FetchError("http", "400", 400);
    });
    await expect(retryWithBackoff(task, { retries: 3, baseDelayMs: 1 })).rejects.toThrow("400");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("shouldRetry 可被调用方覆盖", async () => {
    const task = vi.fn(async (attempt: number) => {
      if (attempt === 0) throw new Error("普通错误");
      return "ok";
    });
    const r = await retryWithBackoff(task, {
      retries: 1,
      baseDelayMs: 1,
      shouldRetry: () => true,
    });
    expect(r).toBe("ok");
  });

  it("已中断的 signal 让首次失败就抛出，不进入退避", async () => {
    const ac = new AbortController();
    ac.abort();
    const task = vi.fn(async () => {
      throw new FetchError("network", "boom");
    });
    await expect(
      retryWithBackoff(task, { retries: 3, baseDelayMs: 1, signal: ac.signal })
    ).rejects.toThrow("boom");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("退避等待期间被取消要立刻退出，不白等一轮", async () => {
    const ac = new AbortController();
    const task = vi.fn(async () => {
      throw new FetchError("network", "boom");
    });
    const p = retryWithBackoff(task, {
      retries: 3,
      baseDelayMs: 10_000,
      signal: ac.signal,
    }).catch((e) => e);
    // 让第一次失败先跑完并进入退避
    await Promise.resolve();
    await Promise.resolve();
    ac.abort();
    const err = await p;
    expect((err as FetchError).message).toBe("boom");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("退避时长按指数增长但不超过 maxDelayMs", async () => {
    const delays: number[] = [];
    const realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
      delays.push(ms ?? 0);
      return realSetTimeout(fn, 0);
    }) as typeof setTimeout);

    const task = vi.fn(async () => {
      throw new FetchError("network", "boom");
    });
    await retryWithBackoff(task, { retries: 3, baseDelayMs: 1_000, maxDelayMs: 2_500 }).catch(
      () => {}
    );
    expect(delays).toEqual([1_000, 2_000, 2_500]);
  });
});