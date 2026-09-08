import { describe, expect, it, vi } from "vitest";
import {
  GatewayError,
  isAbortError,
  isRetryable,
  parseRetryAfter,
  withRetry,
} from "./retry";

/**
 * 网关重试策略测试（AI1/AI2/AI3）：
 * - 可重试错误按指数退避重发，429 的 Retry-After 覆盖计算退避；
 * - 4xx 参数错误一次都不重试；
 * - AbortError（用户停止）永不重试；
 * - 退避有抖动且有上限。
 */

const noSleep = () => Promise.resolve();

describe("GatewayError 分类", () => {
  it("isRetryable：429 / 5xx / 网络错误可重试，4xx fatal 不重试", () => {
    expect(isRetryable(new GatewayError("限流", { statusCode: 429 }))).toBe(true);
    expect(isRetryable(new GatewayError("上游炸了", { statusCode: 502 }))).toBe(true);
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(new GatewayError("参数错误", { statusCode: 400, fatal: true }))).toBe(false);
    expect(isRetryable(new GatewayError("未鉴权", { statusCode: 401, fatal: true }))).toBe(false);
    // 无状态码的包装错误（如供应商内部超时）默认可重试
    expect(isRetryable(new GatewayError("供应商超时"))).toBe(true);
  });

  it("isAbortError：AbortError 不算失败", () => {
    const abortErr = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    expect(isAbortError(abortErr)).toBe(true);
    expect(isRetryable(abortErr)).toBe(false);
  });
});

describe("parseRetryAfter", () => {
  it("秒数形态（整数/小数/零/负数）", () => {
    expect(parseRetryAfter("30")).toBe(30000);
    expect(parseRetryAfter("1.5")).toBe(1500);
    expect(parseRetryAfter("0")).toBe(0);
    expect(parseRetryAfter("-5")).toBe(0);
  });

  it("HTTP 日期形态按差值计算", () => {
    const now = Date.now();
    // HTTP 日期只有秒级精度，容差 ±1s
    const delta = parseRetryAfter(new Date(now + 60_000).toUTCString(), now) ?? 0;
    expect(Math.abs(delta - 60_000)).toBeLessThanOrEqual(1000);
    // 已过期的日期 clamp 到 0
    expect(parseRetryAfter(new Date(now - 60_000).toUTCString(), now)).toBe(0);
  });

  it("非法值返回 undefined", () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("")).toBeUndefined();
    expect(parseRetryAfter("abc")).toBeUndefined();
  });
});

describe("withRetry", () => {
  it("首次成功不重试", async () => {
    const fn = vi.fn(async () => "ok");
    expect(await withRetry(fn, { sleep: noSleep })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("可重试错误按次数重发，最终成功", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new GatewayError("502", { statusCode: 502 });
      return "ok";
    });
    expect(await withRetry(fn, { retries: 3, sleep: noSleep })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("重试耗尽抛最后一次错误", async () => {
    const fn = vi.fn(async () => {
      throw new GatewayError("503", { statusCode: 503 });
    });
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toThrow("503");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("4xx fatal 一次都不重试", async () => {
    const fn = vi.fn(async () => {
      throw new GatewayError("参数错误", { statusCode: 400, fatal: true });
    });
    await expect(withRetry(fn, { retries: 3, sleep: noSleep })).rejects.toThrow("参数错误");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("AbortError 直接透传不重试", async () => {
    const fn = vi.fn(async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    await expect(withRetry(fn, { retries: 3, sleep: noSleep })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("Retry-After 覆盖计算退避（取更大值）", async () => {
    const sleeps: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      sleeps.push(ms);
    });
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new GatewayError("限流", { statusCode: 429, retryAfterMs: 5000 });
      }
      return "ok";
    });
    await withRetry(fn, { retries: 2, baseDelayMs: 100, jitter: 0, sleep });
    // jitter=0 时计算退避 = 100ms，Retry-After 5000ms 取最大 → 5000
    expect(sleeps[0]).toBe(5000);
  });

  it("指数退避有上限且带抖动", async () => {
    const sleeps: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      sleeps.push(ms);
    });
    const fn = vi.fn(async () => {
      throw new GatewayError("502", { statusCode: 502 });
    });
    await expect(withRetry(fn, { retries: 4, baseDelayMs: 1000, maxDelayMs: 3000, sleep })).rejects.toThrow();
    // 退避序列上限 3000：3 次 sleep 全都不超过 3000
    expect(sleeps.every((ms) => ms <= 3000)).toBe(true);
  });

  it("onRetry 回调收到尝试次数与延迟", async () => {
    const events: Array<{ attempt: number; delayMs: number }> = [];
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 2) throw new GatewayError("502", { statusCode: 502 });
      return "ok";
    });
    await withRetry(fn, {
      retries: 2,
      baseDelayMs: 100,
      jitter: 0,
      sleep: noSleep,
      onRetry: (info) => events.push({ attempt: info.attempt, delayMs: info.delayMs }),
    });
    expect(events).toEqual([{ attempt: 1, delayMs: 100 }]);
  });
});