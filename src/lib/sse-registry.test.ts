import { describe, it, expect, afterEach } from "vitest";
import { acquireSseSlot, activeSseCount } from "./sse-registry";

describe("sse-registry (O12)", () => {
  afterEach(() => {
    delete process.env.OC_SSE_MAX_CONCURRENCY;
  });

  it("连接数计数与正确释放", () => {
    const initial = activeSseCount();
    const slot1 = acquireSseSlot();
    expect(slot1).not.toBeNull();
    expect(activeSseCount()).toBe(initial + 1);

    const slot2 = acquireSseSlot();
    expect(slot2).not.toBeNull();
    expect(activeSseCount()).toBe(initial + 2);

    slot1?.release();
    expect(activeSseCount()).toBe(initial + 1);

    // 重复释放幂等
    slot1?.release();
    expect(activeSseCount()).toBe(initial + 1);

    slot2?.release();
    expect(activeSseCount()).toBe(initial);
  });

  it("达到上限时拒绝分配", () => {
    process.env.OC_SSE_MAX_CONCURRENCY = "1";
    const slot = acquireSseSlot();
    expect(slot).not.toBeNull();

    const rejected = acquireSseSlot();
    expect(rejected).toBeNull();

    slot?.release();
  });
});