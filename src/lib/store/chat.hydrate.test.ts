import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useChatStore as StoreType } from "./chat";

/**
 * hydrate 是应用启动的唯一入口：
 * 它既要正确映射服务端字段，也必须在数据库不可用时退化为内存模式，
 * 并且在多个组件同时挂载时只跑一遍（否则会重复创建默认会话）。
 */

type Store = typeof StoreType;

const tick = () => new Promise((r) => setTimeout(r, 0));

interface FetchLog {
  calls: string[];
  fn: ReturnType<typeof vi.fn>;
}

/** 按 URL 正则路由的 fetch 桩，同时记录调用序列 */
function stubFetch(routes: Array<[RegExp, () => Response | Promise<Response>]>): FetchLog {
  const calls: string[] = [];
  const fn = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    for (const [re, handler] of routes) if (re.test(url)) return handler();
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** 每个用例都重新载入模块，重置 store 单例与模块级 hydrating 标志 */
async function freshStore(): Promise<Store> {
  vi.resetModules();
  const mod = await import("./chat");
  return mod.useChatStore;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hydrate 字段映射", () => {
  it("把服务端记录映射成 Conversation，消息延后加载", async () => {
    stubFetch([
      [
        /\/api\/conversations\?archived=all/,
        () =>
          json({
            conversations: [
              {
                id: "c1",
                title: "季度复盘",
                mode: "docs",
                model: "qwen-plus",
                modelProvider: "dashscope",
                archived: 0,
                pinned: 1,
                updatedAt: 1700000000000,
                createdAt: 1699999999000,
              },
            ],
          }),
      ],
      [/\/api\/conversations\/c1/, () => json({ messages: [] })],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();

    const [c] = store.getState().conversations;
    expect(c.id).toBe("c1");
    expect(c.title).toBe("季度复盘");
    expect(c.mode).toBe("docs");
    expect(c.model).toBe("qwen-plus");
    expect(c.modelProvider).toBe("dashscope");
    // 0/1 必须归一成布尔，否则 UI 里的 !== 判断会错
    expect(c.archived).toBe(false);
    expect(c.pinned).toBe(true);
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().activeId).toBe("c1");
    expect(store.getState().model).toBe("qwen-plus");
  });

  it("缺失字段落到安全默认值", async () => {
    stubFetch([
      [/\/api\/conversations\?archived=all/, () => json({ conversations: [{ id: "c1" }] })],
      [/\/api\/conversations\/c1/, () => json({ messages: [] })],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();

    const [c] = store.getState().conversations;
    expect(c.title).toBe("新任务");
    expect(c.mode).toBe("chat");
    expect(c.model).toBe("demo");
    expect(c.modelProvider).toBeUndefined();
    expect(c.images).toEqual([]);
    expect(c.archived).toBe(false);
    expect(c.pinned).toBe(false);
    expect(typeof c.createdAt).toBe("number");
  });

  it("带研究报告的会话自动标记 researchStatus 为 done", async () => {
    stubFetch([
      [
        /\/api\/conversations\?archived=all/,
        () =>
          json({
            conversations: [
              { id: "c1", mode: "research", report: { topic: "AI", summary: "s", sections: [] } },
              { id: "c2", mode: "research" },
            ],
          }),
      ],
      [/\/api\/conversations\/c1/, () => json({ messages: [] })],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();

    const [c1, c2] = store.getState().conversations;
    expect(c1.researchStatus).toBe("done");
    expect(c2.researchStatus).toBeUndefined();
  });

  it("首个活跃会话优先，归档会话不会被选中", async () => {
    stubFetch([
      [
        /\/api\/conversations\?archived=all/,
        () =>
          json({
            conversations: [
              { id: "old", archived: true, model: "demo" },
              { id: "live", archived: false, model: "deepseek-chat" },
            ],
          }),
      ],
      [/\/api\/conversations\/live/, () => json({ messages: [] })],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();

    expect(store.getState().activeId).toBe("live");
    expect(store.getState().model).toBe("deepseek-chat");
  });

  it("全部归档时回落到第一个会话", async () => {
    stubFetch([
      [
        /\/api\/conversations\?archived=all/,
        () => json({ conversations: [{ id: "a", archived: true }, { id: "b", archived: true }] }),
      ],
      [/\/api\/conversations\/a/, () => json({ messages: [] })],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();

    expect(store.getState().activeId).toBe("a");
  });

  it("水合后立即加载首个会话的消息", async () => {
    const { calls } = stubFetch([
      [/\/api\/conversations\?archived=all/, () => json({ conversations: [{ id: "c1" }] })],
      [
        /\/api\/conversations\/c1/,
        () =>
          json({
            messages: [
              { id: "m1", role: "user", content: "你好", error: false },
              { id: "m2", role: "assistant", content: "在的", error: false },
            ],
          }),
      ],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();

    const [c] = store.getState().conversations;
    expect(c.loaded).toBe(true);
    expect(c.messages.map((m) => m.content)).toEqual(["你好", "在的"]);
    // DB4 后首次拉取带 limit 参数，只按路径前缀断言
    expect(calls.some((x) => x.startsWith("GET /api/conversations/c1"))).toBe(true);
  });
});

describe("hydrate 空库与故障", () => {
  it("服务端没有任何会话时创建一个默认会话并落库", async () => {
    const { calls } = stubFetch([
      [/\/api\/conversations\?archived=all/, () => json({ conversations: [] })],
      [/\/api\/conversations$/, () => json({ ok: true })],
      [/\/api\/conversations\//, () => json({ messages: [] })],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();

    expect(store.getState().conversations).toHaveLength(1);
    expect(store.getState().activeId).toBeTruthy();
    expect(calls.some((c) => c.startsWith("POST /api/conversations"))).toBe(true);
  });

  it("列表接口 500 时退化为纯内存模式而不是白屏", async () => {
    stubFetch([[/\/api\/conversations/, () => json({ error: "boom" }, 500)]]);
    const store = await freshStore();
    await store.getState().hydrate();

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().conversations).toHaveLength(1);
    expect(store.getState().conversations[0].model).toBe("demo");
    expect(store.getState().activeId).toBe(store.getState().conversations[0].id);
  });

  it("响应不是合法 JSON 时同样退化", async () => {
    stubFetch([[/\/api\/conversations/, () => new Response("<html>502</html>", { status: 200 })]]);
    const store = await freshStore();
    await store.getState().hydrate();

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().conversations).toHaveLength(1);
  });

  it("空库时建会话的 POST 失败也不会卡住启动", async () => {
    stubFetch([
      [/\/api\/conversations\?archived=all/, () => json({ conversations: [] })],
      [/\/api\/conversations$/, () => json({ error: "no db" }, 500)],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().conversations).toHaveLength(1);
  });

  it("网络异常（fetch reject）被吞掉并退化", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    const store = await freshStore();
    await expect(store.getState().hydrate()).resolves.toBeUndefined();
    expect(store.getState().hydrated).toBe(true);
  });
});

describe("hydrate 防重入", () => {
  it("并发调用只真正水合一次", async () => {
    let listCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("archived=all")) {
          listCalls += 1;
          // 故意延迟，模拟真实网络：第二个调用会在第一个 await 期间进来
          await new Promise((r) => setTimeout(r, 20));
          return json({ conversations: [{ id: "c1" }] });
        }
        return json({ messages: [] });
      })
    );
    const store = await freshStore();
    await Promise.all([
      store.getState().hydrate(),
      store.getState().hydrate(),
      store.getState().hydrate(),
    ]);

    expect(listCalls).toBe(1);
    expect(store.getState().conversations).toHaveLength(1);
  });

  it("并发进入空库分支时不会创建多个默认会话", async () => {
    let posts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("archived=all")) {
          await new Promise((r) => setTimeout(r, 20));
          return json({ conversations: [] });
        }
        if (init?.method === "POST") {
          posts += 1;
          return json({ ok: true });
        }
        return json({ messages: [] });
      })
    );
    const store = await freshStore();
    await Promise.all([store.getState().hydrate(), store.getState().hydrate()]);

    expect(posts).toBe(1);
    expect(store.getState().conversations).toHaveLength(1);
  });

  it("已水合后再次调用直接返回，不再发请求", async () => {
    const { fn } = stubFetch([
      [/\/api\/conversations\?archived=all/, () => json({ conversations: [{ id: "c1" }] })],
      [/\/api\/conversations\/c1/, () => json({ messages: [] })],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();
    const before = fn.mock.calls.length;
    await store.getState().hydrate();
    expect(fn.mock.calls.length).toBe(before);
  });

  it("水合失败后标志位复位，不会永久锁死（仍受 hydrated 短路保护）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      })
    );
    const store = await freshStore();
    await store.getState().hydrate();
    expect(store.getState().hydrated).toBe(true);

    // 手动清掉 hydrated 模拟「重试水合」，此时不应被残留的 hydrating 标志挡住
    store.setState({ hydrated: false, conversations: [] });
    stubFetch([
      [/\/api\/conversations\?archived=all/, () => json({ conversations: [{ id: "again" }] })],
      [/\/api\/conversations\/again/, () => json({ messages: [] })],
    ]);
    await store.getState().hydrate();
    expect(store.getState().conversations[0].id).toBe("again");
  });
});

describe("selectConversation 缓存", () => {
  it("已加载过的会话不再重复拉消息", async () => {
    const { calls } = stubFetch([
      [
        /\/api\/conversations\?archived=all/,
        () => json({ conversations: [{ id: "c1" }, { id: "c2" }] }),
      ],
      [/\/api\/conversations\/c\d/, () => json({ messages: [] })],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();
    await tick();

    // DB4 后首次拉取带 ?limit=50，按前缀计数
    const before = calls.filter((c) => c.startsWith("GET /api/conversations/c1")).length;
    await store.getState().selectConversation("c1");
    const after = calls.filter((c) => c.startsWith("GET /api/conversations/c1")).length;
    expect(before).toBe(1);
    expect(after).toBe(1);
  });

  it("消息接口失败时仍标记 loaded，避免反复重试", async () => {
    stubFetch([
      [
        /\/api\/conversations\?archived=all/,
        () => json({ conversations: [{ id: "c1" }, { id: "c2" }] }),
      ],
      [/\/api\/conversations\/c1/, () => json({ messages: [] })],
      [/\/api\/conversations\/c2/, () => json({ error: "x" }, 500)],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();
    await store.getState().selectConversation("c2");

    const c2 = store.getState().conversations.find((c) => c.id === "c2");
    expect(c2?.loaded).toBe(true);
    expect(c2?.messages).toEqual([]);
  });

  it("选中不存在的会话时不抛异常", async () => {
    stubFetch([
      [/\/api\/conversations\?archived=all/, () => json({ conversations: [{ id: "c1" }] })],
      [/\/api\/conversations\/c1/, () => json({ messages: [] })],
    ]);
    const store = await freshStore();
    await store.getState().hydrate();
    await expect(store.getState().selectConversation("ghost")).resolves.toBeUndefined();
    expect(store.getState().activeId).toBe("ghost");
  });
});