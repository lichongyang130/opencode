import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * AI 章网关韧性测试：缓存 / 成本上限 / usage 哨兵 / 熔断降级 / 积分闭环。
 *
 * 隔离要点：
 * - gateway/index.ts 的熔断状态、响应缓存都是模块级单例，必须 vi.resetModules 逐用例重建；
 * - usage/credits 落库走 node:sqlite，用临时目录 + closeDb 隔离（DB 章约定）；
 * - 供应商通过 vi.doMock 替换 providers 模块注入假实现，避免真实网络。
 */

interface FakeProvider {
  id: string;
  chunks: (string | { inputTokens: number; outputTokens: number })[];
  failTimes: number;
  calls: number;
  sawSignals: AbortSignal[];
}

let tempDir: string;

function makeProvider(id: string, base: Partial<FakeProvider> = {}) {
  const p: FakeProvider = {
    id,
    chunks: base.chunks ?? [{ inputTokens: 10, outputTokens: 20 }],
    failTimes: base.failTimes ?? 0,
    calls: 0,
    sawSignals: [],
    ...base,
  };
  return p;
}

/** 把 FakeProvider 包装成 ProviderAdapter；每次 yield 支持 24ms 间隔模拟流 */
function fakeAdapter(p: FakeProvider) {
  return {
    id: p.id,
    isConfigured: () => true,
    // 测试里用 any 绕过 UpstreamUsage 的私有符号判别：直接 yield 我们的对象，
    // 配合 vi.doMock("./types") 让 isUpstreamUsage 按字段判别
    async *streamChat({ signal }: { signal?: AbortSignal }) {
      p.calls += 1;
      if (signal) p.sawSignals.push(signal);
      if (p.failTimes >= p.calls) {
        throw new Error(`${p.id} 上游炸了（第 ${p.calls} 次）`);
      }
      for (const chunk of p.chunks) {
        if (typeof chunk === "string") {
          yield chunk;
        } else {
          yield { __upstreamUsage: true, inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens };
        }
        await new Promise((r) => setTimeout(r, 2));
      }
    },
  };
}

async function loadGateway(providers: Record<string, ReturnType<typeof fakeAdapter>>) {
  vi.doMock("./providers", () => ({
    buildProviders: () => providers,
    getProviders: () => providers,
    getProviderConfigStatus: () => ({}),
    getEnvApiKey: () => undefined,
  }));
  // isUpstreamUsage 用字段判别即可，不需要 mock types；直接用真实实现
  const mod = await import("./index");
  return mod;
}

let sqliteModule: typeof import("@/lib/db/sqlite") | null = null;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "oc-gw-"));
  process.env.OC_DATA_DIR = tempDir;
  vi.resetModules();
  vi.doMock("./types", async () => {
    const actual = await vi.importActual<typeof import("./types")>("./types");
    return actual;
  });
});

afterEach(async () => {
  if (!sqliteModule) {
    const m = await import("@/lib/db/sqlite");
    m.closeDb();
    sqliteModule = m;
  } else {
    sqliteModule.closeDb();
  }
  sqliteModule = null;
  delete process.env.OC_DATA_DIR;
  vi.doUnmock("./providers");
  vi.doUnmock("./types");
  rmSync(tempDir, { recursive: true, force: true });
});

/** demo 模型 id：走 creditRepo.reserve(0) 哑单路径，不依赖积分余额 */
const MSGS = [{ role: "user" as const, content: "你好" }];

async function collectTokens(fn: (onToken: (d: string) => void) => Promise<unknown>) {
  const tokens: string[] = [];
  await fn((d) => tokens.push(d));
  return tokens;
}

describe("AI13 响应缓存", () => {
  it("相同 prompt 命中缓存：第二次调用不再打供应商", async () => {
    const { creditRepo } = await import("@/lib/db/repo");
    creditRepo.grant(1000);

    const openai = makeProvider("openai", { chunks: ["第一块", "第二块"] });
    const gw = await loadGateway({
      demo: fakeAdapter(makeProvider("demo")),
      openai: fakeAdapter(openai),
    });

    await collectTokens((onToken) =>
      gw.streamChatCompletion("gpt-4o-mini", MSGS, { onToken }, undefined, "openai")
    );
    await collectTokens((onToken) =>
      gw.streamChatCompletion("gpt-4o-mini", MSGS, { onToken }, undefined, "openai")
    );

    expect(openai.calls).toBe(1); // 第二次命中缓存
  });

  it("useCache=false 跳过缓存", async () => {
    const openai = makeProvider("openai", { chunks: ["a"] });
    const gw = await loadGateway({
      demo: fakeAdapter(makeProvider("demo")),
      openai: fakeAdapter(openai),
    });

    const { creditRepo } = await import("@/lib/db/repo");
    creditRepo.grant(1000);

    await collectTokens((onToken) =>
      gw.streamChatCompletion("gpt-4o-mini", MSGS, { onToken }, undefined, "openai", { useCache: false })
    );
    await collectTokens((onToken) =>
      gw.streamChatCompletion("gpt-4o-mini", MSGS, { onToken }, undefined, "openai", { useCache: false })
    );

    expect(openai.calls).toBe(2);
  });

  it("setResponseCacheEnabled(false) 后不再缓存", async () => {
    const openai = makeProvider("openai", { chunks: ["a"] });
    const gw = await loadGateway({
      demo: fakeAdapter(makeProvider("demo")),
      openai: fakeAdapter(openai),
    });
    gw.setResponseCacheEnabled(false);

    const { creditRepo } = await import("@/lib/db/repo");
    creditRepo.grant(1000);

    await collectTokens((onToken) =>
      gw.streamChatCompletion("gpt-4o-mini", MSGS, { onToken }, undefined, "openai")
    );
    await collectTokens((onToken) =>
      gw.streamChatCompletion("gpt-4o-mini", MSGS, { onToken }, undefined, "openai")
    );

    expect(openai.calls).toBe(2);
  });
});

describe("AI12 成本上限", () => {
  it("输入超长直接拒绝且不打上游", async () => {
    const gpt4o = makeProvider("openai");
    const gw = await loadGateway({
      demo: fakeAdapter(makeProvider("demo")),
      openai: fakeAdapter(gpt4o),
    });

    // gpt-4o 输入价 2.5/Mtok：超 500 积分（=$5 成本）需要约 2M token ≈ 7M 字符。
    // 上限预检在积分预扣之前，无需 grant 也能触发
    const huge = [{ role: "user" as const, content: "x".repeat(7_000_000) }];
    await expect(
      collectTokens((onToken) =>
        gw.streamChatCompletion("gpt-4o", huge, { onToken }, undefined, "openai")
      )
    ).rejects.toThrow("超过单次上限");

    expect(gpt4o.calls).toBe(0);
  });
});

describe("AI9 usage 哨兵", () => {
  it("上游回带 usage 时优先采用真实值", async () => {
    const demo = makeProvider("demo", {
      chunks: ["hi", { inputTokens: 7, outputTokens: 9 }],
    });
    const gw = await loadGateway({ demo: fakeAdapter(demo) });

    const res = await gw.streamChatCompletion("demo", MSGS, { onToken: () => {} }, undefined, "demo");
    expect(res.inputTokens).toBe(7);
    expect(res.outputTokens).toBe(9);
    expect(res.usageFromUpstream).toBe(true);
  });

  it("上游不回带 usage 时用估算值兜底", async () => {
    const demo = makeProvider("demo", { chunks: ["你好世界"] });
    const gw = await loadGateway({ demo: fakeAdapter(demo) });

    const res = await gw.streamChatCompletion("demo", MSGS, { onToken: () => {} }, undefined, "demo");
    expect(res.usageFromUpstream).toBe(false);
    expect(res.outputTokens).toBeGreaterThan(0);
  });
});

describe("AI7 熔断与降级", () => {
  it("主供应商连续失败 3 次后熔断并自动降级到备选", async () => {
    const { creditRepo } = await import("@/lib/db/repo");
    creditRepo.grant(10_000);

    const dead = makeProvider("deepseek", { failTimes: 10, chunks: [] });
    const alive = makeProvider("openai", { chunks: ["活的回复"] });
    const gw = await loadGateway({
      demo: fakeAdapter(makeProvider("demo")),
      openai: fakeAdapter(alive),
      deepseek: fakeAdapter(dead),
    });

    const runOnce = () =>
      gw.streamChatCompletion("deepseek-chat", MSGS, { onToken: () => {} }, undefined, "deepseek", {
        retry: { retries: 0 },
      });

    // 前三次：deepseek 失败 → 抛错（失败计数累积到 3，熔断打开）
    await expect(runOnce()).rejects.toThrow();
    await expect(runOnce()).rejects.toThrow();
    await expect(runOnce()).rejects.toThrow();
    // 熔断已开：下一次自动切 openai 成功
    const res = await runOnce();
    expect(res.outputTokens).toBeGreaterThan(0);
    expect(alive.calls).toBe(1);
  });

  it("用户主动中止不计入熔断计数", async () => {
    const demo = makeProvider("demo", {
      // 收到 signal 才中止：模拟真实的「用户停止 → 上游流被切断」
      chunks: ["x"],
    });
    const demoAdapter = {
      id: "demo" as const,
      isConfigured: () => true,
      async *streamChat({ signal }: { signal?: AbortSignal }) {
        demo.calls += 1;
        if (signal) demo.sawSignals.push(signal);
        if (signal?.aborted) {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          throw err;
        }
        yield "x";
      },
    };
    const gw = await loadGateway({ demo: demoAdapter });

    const ctrl = new AbortController();
    ctrl.abort(new Error("用户停止"));
    await expect(
      gw.streamChatCompletion("demo", MSGS, { onToken: () => {}, signal: ctrl.signal }, undefined, "demo")
    ).rejects.toThrow();

    // AbortError 不算失败：再跑一次正常成功
    const res = await gw.streamChatCompletion("demo", MSGS, { onToken: () => {} }, undefined, "demo");
    expect(res.credits).toBe(0);
    expect(demo.calls).toBe(2);
  });
});


describe("AI11 积分闭环", () => {
  it("成功路径：预扣 → 结算差额自动退还", async () => {
    const { creditRepo } = await import("@/lib/db/repo");
    creditRepo.grant(1000);

    const openai = makeProvider("openai", {
      chunks: ["你好", { inputTokens: 5, outputTokens: 5 }],
    });
    const gw = await loadGateway({
      demo: fakeAdapter(makeProvider("demo")),
      openai: fakeAdapter(openai),
    });

    const res = await gw.streamChatCompletion("gpt-4o-mini", MSGS, { onToken: () => {} }, undefined, "openai");
    expect(res.credits).toBeGreaterThan(0);

    const bal = creditRepo.balance();
    // 结算金额 = res.credits，available = 1000 - credits
    expect(bal.settled).toBeCloseTo(res.credits, 5);
    expect(bal.available + bal.reserved + res.credits).toBeCloseTo(1000, 5);
  });

  it("失败路径：预扣全部回滚，余额恢复", async () => {
    const { creditRepo } = await import("@/lib/db/repo");
    creditRepo.grant(1000);

    const openai = makeProvider("openai", { failTimes: 99, chunks: [] });
    const gw = await loadGateway({
      demo: fakeAdapter(makeProvider("demo")),
      openai: fakeAdapter(openai),
    });

    await expect(
      gw.streamChatCompletion("gpt-4o-mini", MSGS, { onToken: () => {} }, undefined, "openai", {
        retry: { retries: 0 },
      })
    ).rejects.toThrow();

    const bal = creditRepo.balance();
    expect(bal.reserved).toBe(0);
    expect(bal.available).toBe(1000);
  });
});

describe("AI8 成败落库", () => {
  it("成功与失败各落一条 usage 记录", async () => {
    const { creditRepo } = await import("@/lib/db/repo");
    creditRepo.grant(10_000);

    const openai = makeProvider("openai", { failTimes: 0, chunks: ["ok"] });
    const dead = makeProvider("deepseek", { failTimes: 99, chunks: [] });
    const gw = await loadGateway({
      demo: fakeAdapter(makeProvider("demo")),
      openai: fakeAdapter(openai),
      deepseek: fakeAdapter(dead),
    });

    await gw.streamChatCompletion("gpt-4o-mini", MSGS, { onToken: () => {} }, undefined, "openai");
    await expect(
      gw.streamChatCompletion("deepseek-chat", MSGS, { onToken: () => {} }, undefined, "deepseek", {
        retry: { retries: 0 },
      })
    ).rejects.toThrow();

    const { usageRepo } = await import("@/lib/db/repo");
    const stats = usageRepo.dailyStats(7);
    const gpt = stats.find((s) => s.model === "gpt-4o-mini");
    const ds = stats.find((s) => s.model === "deepseek-chat");
    expect(gpt?.successCalls).toBe(1);
    expect(gpt?.calls).toBe(1);
    expect(ds?.calls).toBe(1);
    expect(ds?.successCalls).toBe(0);
  });
});

describe("AI4 整体超时", () => {
  it("signal 下传给 provider（用户停止 + 超时共用通道）", async () => {
    const demo = makeProvider("demo", { chunks: ["a", "b"] });
    const gw = await loadGateway({ demo: fakeAdapter(demo) });

    const ctrl = new AbortController();
    await gw.streamChatCompletion(
      "demo",
      MSGS,
      { onToken: () => {}, signal: ctrl.signal },
      undefined,
      "demo"
    );
    expect(demo.sawSignals.length).toBe(1);
  });
});

describe("onFirstToken 回调（TTFT）", () => {
  it("首个文本 chunk 到达时触发一次", async () => {
    const demo = makeProvider("demo", {
      chunks: ["一", "二", { inputTokens: 1, outputTokens: 1 }],
    });
    const gw = await loadGateway({ demo: fakeAdapter(demo) });

    let fired = 0;
    await gw.streamChatCompletion("demo", MSGS, { onToken: () => {}, onFirstToken: () => fired++ }, undefined, "demo");
    expect(fired).toBe(1);
  });
});