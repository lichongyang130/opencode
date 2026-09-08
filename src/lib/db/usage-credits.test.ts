import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * AI8/AI10/AI11：用量落库、按天聚合看板、积分预扣-结算-回滚闭环。
 * 延续 DB 章的隔离模式：临时目录 + 模块重置。
 */

let tempDir: string;
type RepoModule = typeof import("./repo");
let usageRepo: RepoModule["usageRepo"];
let creditRepo: RepoModule["creditRepo"];
let sqliteModule: typeof import("./sqlite");

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "oc-usage-"));
  process.env.OC_DATA_DIR = tempDir;
  vi.resetModules();
  sqliteModule = await import("./sqlite");
  const mod = await import("./repo");
  usageRepo = mod.usageRepo;
  creditRepo = mod.creditRepo;
});

afterEach(() => {
  sqliteModule?.closeDb();
  delete process.env.OC_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("AI8 usage 落库", () => {
  it("成功与失败调用都记录，成功标记区分", () => {
    usageRepo.record({
      conversationId: "c1",
      model: "qwen-plus",
      provider: "dashscope",
      inputTokens: 100,
      outputTokens: 200,
      costUsd: 0.001,
      credits: 1,
      success: true,
      durationMs: 1200,
    });
    usageRepo.record({
      conversationId: "c1",
      model: "qwen-plus",
      provider: "dashscope",
      inputTokens: 100,
      outputTokens: 0,
      costUsd: 0,
      credits: 0,
      success: false,
      durationMs: 300,
    });
    const stats = usageRepo.dailyStats(7);
    expect(stats).toHaveLength(1);
    expect(stats[0].calls).toBe(2);
    expect(stats[0].successCalls).toBe(1);
    expect(stats[0].credits).toBe(1);
  });
});

describe("AI10 按天聚合", () => {
  it("不同模型分行聚合，天窗口过滤旧数据", () => {
    const db = sqliteModule.getDb();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    // 手工插入不同时间的用量（repo.record 用 Date.now 固定当前）
    const ins = db.prepare(
      `INSERT INTO usage_records (id, conversationId, model, provider, inputTokens, outputTokens, costUsd, credits, success, durationMs, createdAt)
       VALUES (?, NULL, ?, 'demo', ?, ?, ?, ?, 1, 100, ?)`
    );
    ins.run("u1", "model-a", 10, 20, 0.01, 2, now);
    ins.run("u2", "model-a", 10, 20, 0.01, 2, now);
    ins.run("u3", "model-b", 5, 5, 0.005, 1, now);
    ins.run("u4", "model-old", 1, 1, 0, 0, now - 40 * day); // 窗口外

    const stats = usageRepo.dailyStats(30);
    expect(stats).toHaveLength(2); // model-old 被过滤
    const a = stats.find((s) => s.model === "model-a")!;
    expect(a.calls).toBe(2);
    expect(a.inputTokens).toBe(20);
    expect(a.costUsd).toBeCloseTo(0.02);
  });
});

describe("AI11 积分账本闭环", () => {
  it("授予 → 预扣 → 结算：可用余额逐步变化", () => {
    creditRepo.grant(100, "注册赠送");
    expect(creditRepo.balance()).toMatchObject({ granted: 100, available: 100 });

    const r1 = creditRepo.reserve(30, "会话预扣");
    const bal1 = creditRepo.balance();
    expect(bal1.reserved).toBe(30);
    expect(bal1.available).toBe(70);

    // 实际消耗 25，少于预扣 30：结算 25，退 5
    creditRepo.settle(r1, 25);
    const bal2 = creditRepo.balance();
    expect(bal2.settled).toBe(25);
    expect(bal2.available).toBe(75); // 100 - 25
  });

  it("预扣后失败回滚：余额完全恢复", () => {
    creditRepo.grant(50);
    const r = creditRepo.reserve(20);
    expect(creditRepo.balance().available).toBe(30);

    creditRepo.refund(r);
    const bal = creditRepo.balance();
    expect(bal.reserved).toBe(0);
    expect(bal.available).toBe(50);
  });

  it("余额不足时预扣直接拒绝", () => {
    creditRepo.grant(10);
    expect(() => creditRepo.reserve(11)).toThrow("积分不足");
  });

  it("实际消耗超过预扣时按预扣封顶（用户不为估算误差买单）", () => {
    creditRepo.grant(100);
    const r = creditRepo.reserve(10);
    creditRepo.settle(r, 15); // 超了也只扣 10
    expect(creditRepo.balance().settled).toBe(10);
    expect(creditRepo.balance().available).toBe(90);
  });

  it("重复结算与重复回滚都幂等", () => {
    creditRepo.grant(100);
    const r = creditRepo.reserve(10);
    creditRepo.settle(r, 10);
    creditRepo.settle(r, 10); // 幂等
    expect(creditRepo.balance().settled).toBe(10);

    creditRepo.refund(r); // 已结算，跳过
    expect(creditRepo.balance().available).toBe(90);

    creditRepo.refund(r); // 再来一次还是跳过
    expect(creditRepo.balance().available).toBe(90);
  });

  it("免费调用（amount=0）返回哑 id 不入账", () => {
    const id = creditRepo.reserve(0);
    expect(id).toBe("free");
    expect(creditRepo.balance().granted).toBe(0);
    // settle/refund 对哑 id 都是安全 no-op
    expect(() => {
      creditRepo.settle(id, 0);
      creditRepo.refund(id);
    }).not.toThrow();
  });
});