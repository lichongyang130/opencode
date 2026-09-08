import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * UX19 格式化工具测试。时间函数都接受注入 now —— 用固定基准时间断言，
 * 否则跨午夜跑 CI 会随机翻车。
 */

import {
  DAY_BUCKET_LABELS,
  dayBucketOf,
  formatBytes,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
} from "./format";

const NOW = new Date("2026-09-08T15:30:00").getTime();
const minutesAgo = (m: number) => NOW - m * 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("UX19 formatRelativeTime", () => {
  it("当天显示 HH:mm", () => {
    expect(formatRelativeTime(minutesAgo(5), NOW)).toBe("15:25");
    expect(formatRelativeTime(new Date("2026-09-08T00:01:00").getTime(), NOW)).toBe("00:01");
  });

  it("昨天显示文字「昨天」", () => {
    expect(formatRelativeTime(new Date("2026-09-07T23:00:00").getTime(), NOW)).toBe("昨天");
  });

  it("同年跨天显示 MM-DD，跨年显示完整日期", () => {
    expect(formatRelativeTime(new Date("2026-08-31T10:00:00").getTime(), NOW)).toBe("08-31");
    expect(formatRelativeTime(new Date("2025-12-31T10:00:00").getTime(), NOW)).toBe("2025-12-31");
  });
});

describe("UX2 dayBucketOf 分组", () => {
  it("今天 / 昨天 / 7 天内 / 更早四桶", () => {
    expect(dayBucketOf(minutesAgo(30), NOW)).toBe("today");
    expect(dayBucketOf(new Date("2026-09-07T23:00:00").getTime(), NOW)).toBe("yesterday");
    // 7 天内：9/2 在 7 天窗口内
    expect(dayBucketOf(new Date("2026-09-02T15:00:00").getTime(), NOW)).toBe("week");
    // 更早：8/30 超窗
    expect(dayBucketOf(new Date("2026-08-30T15:00:00").getTime(), NOW)).toBe("older");
  });

  it("恰好 7 天边界归入 week，7 天 + 1 秒归入 older", () => {
    expect(dayBucketOf(NOW - 7 * 24 * 3600_000, NOW)).toBe("week");
    expect(dayBucketOf(NOW - 7 * 24 * 3600_000 - 1000, NOW)).toBe("older");
    // 未来时间戳（时钟偏移）不当 week 处理
    expect(dayBucketOf(NOW + 3600_000, NOW)).toBe("today");
  });

  it("标签四桶齐全且互不相同", () => {
    const labels = Object.values(DAY_BUCKET_LABELS);
    expect(labels).toEqual(["今天", "昨天", "7 天内", "更早"]);
  });
});

describe("UX19 formatDateTime", () => {
  it("完整时间 YYYY-MM-DD HH:mm", () => {
    expect(formatDateTime(NOW)).toBe("2026-09-08 15:30");
  });
});

describe("UX19 formatBytes", () => {
  it("B 档不带小数，KB/MB 一位小数", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 * 3.7)).toBe("3.7 MB");
    expect(formatBytes(1024 ** 3 * 2)).toBe("2 GB");
  });

  it("整档抹掉尾随 .0", () => {
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
  });

  it("非有限值返回 0 B", () => {
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
  });
});

describe("UX19 formatNumber", () => {
  it("千分位分组", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(1234567.89)).toBe("1,234,567.89");
  });

  it("负数与特殊值", () => {
    expect(formatNumber(-1234567)).toBe("-1,234,567");
    expect(formatNumber(Number.NaN)).toBe("NaN");
  });
});