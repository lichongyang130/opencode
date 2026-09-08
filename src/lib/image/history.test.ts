import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * IMG6 提示词历史测试。node 环境没有 window.localStorage，
 * safe-storage 会自动降级到进程内 Map —— 正好覆盖纯逻辑；
 * 每个用例前后清掉历史键避免跨用例串数据。
 */

import { resetStorageProbe, writeRaw } from "@/lib/safe-storage";
import { clearPromptHistory, loadPromptHistory, pushPromptHistory } from "./history";

beforeEach(() => {
  resetStorageProbe();
  clearPromptHistory();
});

afterEach(() => {
  clearPromptHistory();
  resetStorageProbe();
});

const entry = (over: Partial<Parameters<typeof pushPromptHistory>[0]> = {}) => ({
  prompt: "一只猫",
  model: "demo-image",
  size: "1024x1024",
  style: "cinematic",
  negative: "文字，水印",
  ...over,
});

describe("IMG6 loadPromptHistory", () => {
  it("空时返回空数组", () => {
    expect(loadPromptHistory()).toEqual([]);
  });

  it("脏记录（非数组 / 缺 prompt）被剔掉", () => {
    // 直接写入非数组脏数据：load 必须当空处理而不是抛错
    writeRaw("opencanvas.image.prompt-history.v1", '{"x":1}');
    expect(loadPromptHistory()).toEqual([]);
    // 再塞一条缺 prompt 的记录：有复用价值判断会剔掉它
    writeRaw(
      "opencanvas.image.prompt-history.v1",
      JSON.stringify([{ prompt: "ok", model: "m", size: "s" }, { model: "m2" }, null, "str"])
    );
    const list = loadPromptHistory();
    expect(list).toHaveLength(1);
    expect(list[0].prompt).toBe("ok");
  });
});

describe("IMG6 pushPromptHistory", () => {
  it("新记录插到最前并带 id/createdAt", () => {
    const list = pushPromptHistory(entry());
    expect(list).toHaveLength(1);
    expect(list[0].id).toBeTruthy();
    expect(list[0].createdAt).toBeGreaterThan(0);
    expect(list[0].prompt).toBe("一只猫");
  });

  it("同参数去重（保留最近一次）", () => {
    pushPromptHistory(entry());
    const list = pushPromptHistory(entry());
    expect(list).toHaveLength(1);
    // 只有 createdAt/id 变，参数仍是一条
    expect(list[0].prompt).toBe("一只猫");
  });

  it("任一参数不同即视为新记录", () => {
    pushPromptHistory(entry());
    pushPromptHistory(entry({ style: "3d" }));
    pushPromptHistory(entry({ negative: undefined }));
    const list = loadPromptHistory();
    expect(list).toHaveLength(3);
  });

  it("超过 20 条裁掉最旧", () => {
    for (let i = 0; i < 25; i++) pushPromptHistory(entry({ prompt: `第 ${i} 张` }));
    const list = loadPromptHistory();
    expect(list).toHaveLength(20);
    expect(list[0].prompt).toBe("第 24 张");
    expect(list[19].prompt).toBe("第 5 张");
  });

  it("显式传入 id/createdAt 时尊重调用方", () => {
    const list = pushPromptHistory({ ...entry(), id: "fixed", createdAt: 123 });
    expect(list[0].id).toBe("fixed");
    expect(list[0].createdAt).toBe(123);
  });
});

describe("IMG6 clearPromptHistory", () => {
  it("清空后读取为空", () => {
    pushPromptHistory(entry());
    clearPromptHistory();
    expect(loadPromptHistory()).toEqual([]);
  });
});
