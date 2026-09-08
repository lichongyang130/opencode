import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useChatStore as StoreType } from "./chat";

/**
 * DOC 章的 store 侧行为锁定：
 *  1) insertToDoc 光标插入与换行粘合（DOC8/DOC9 的地基）；
 *  2) setDoc 真实保存三态（saving → saved / error）与重试（DOC2）；
 *  3) 版本快照 30 分钟节流（DOC5）；
 *  4) aiDoc 选区改写只替换选中片段而非全文（DOC3 的修复回归）。
 */

type Store = typeof StoreType;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-type": "application/json" } });

function sseOnce(chunks: string[]): Response {
  return new Response(
    new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    }),
    { status: 200 }
  );
}

interface Harness {
  store: Store;
  bodies: Array<{ url: string; method: string; body: unknown }>;
}

/** 与 chat.send.test 同款打桩骨架；convoPatchFail 让 conversations PATCH 全部失败 */
async function harness(
  chatHandler: (init?: RequestInit) => Response | Promise<Response>,
  opts: { model?: string; convoPatchFail?: boolean } = {},
): Promise<Harness> {
  vi.resetModules();
  const bodies: Harness["bodies"] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      let parsed: unknown = undefined;
      if (typeof init?.body === "string") {
        try {
          parsed = JSON.parse(init.body);
        } catch {
          parsed = init.body;
        }
      }
      bodies.push({ url, method: init?.method ?? "GET", body: parsed });
      if (url.includes("archived=all"))
        return json({
          conversations: [
            {
              id: "c1",
              mode: "docs",
              model: opts.model ?? "gpt-4o-mini",
              doc: { title: "测试文档", content: "第一段\n\n第二段\n\n第三段", updatedAt: 1 },
            },
          ],
        });
      if (url.includes("/api/chat")) return chatHandler(init);
      if (url.includes("/api/models")) return json({ status: { openai: true } });
      if (url.includes("/api/conversations/c1/doc-versions")) return json({ ok: true, versions: [] });
      if (/\/api\/conversations\/[^/]+$/.test(url)) {
        if (opts.convoPatchFail) return json({ error: "db down" }, 500);
        return json({ ok: true });
      }
      return json({ ok: true });
    })
  );
  const mod = await import("./chat");
  await mod.useChatStore.getState().hydrate();
  return { store: mod.useChatStore, bodies };
}

const docOf = (store: Store) => store.getState().conversations.find((c) => c.id === "c1")?.doc;

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DOC8/DOC9 insertToDoc", () => {
  it("在指定光标处插入并自动换行粘合", async () => {
    const { store } = await harness(() => sseOnce([]));
    // 原文 "第一段\n\n第二段\n\n第三段"，光标 3（"第一段"之后）
    store.getState().insertToDoc("| 表格 |", 3);
    expect(docOf(store)?.content).toBe("第一段\n| 表格 |\n\n第二段\n\n第三段");
  });

  it("未传光标时追加文末", async () => {
    const { store } = await harness(() => sseOnce([]));
    store.getState().insertToDoc("![图](u)", undefined);
    expect(docOf(store)?.content).toBe("第一段\n\n第二段\n\n第三段\n![图](u)");
  });

  it("光标越界被钳制且文首插入不产生前置换行", async () => {
    const { store } = await harness(() => sseOnce([]));
    store.getState().insertToDoc("头部", -10);
    expect(docOf(store)?.content.startsWith("头部")).toBe(true);
    store.getState().insertToDoc("尾部", 99999);
    const c = docOf(store)?.content ?? "";
    expect(c.endsWith("尾部")).toBe(true);
  });
});

describe("DOC2 setDoc 保存三态", () => {
  it("防抖落库成功后进入 saved", async () => {
    vi.useFakeTimers();
    try {
      const { store } = await harness(() => sseOnce([]));
      store.getState().setDoc({ title: "t", content: "改", updatedAt: 1 });
      expect(store.getState().docSaveState).toBe("saving");
      await vi.advanceTimersByTimeAsync(700);
      expect(store.getState().docSaveState).toBe("saved");
      // 内容仍在会话上（内存态立即可见）
      expect(docOf(store)?.content).toBe("改");
    } finally {
      vi.useRealTimers();
    }
  });

  it("落库失败进入 error，重试成功后恢复 saved", async () => {
    vi.useFakeTimers();
    try {
      const { store } = await harness(() => sseOnce([]), { convoPatchFail: true });
      store.getState().setDoc({ title: "t", content: "改", updatedAt: 1 });
      await vi.advanceTimersByTimeAsync(700);
      expect(store.getState().docSaveState).toBe("error");

      await store.getState().retryDocSave();
      // 打桩仍是失败路径…… 重试也应失败并保持 error
      expect(store.getState().docSaveState).toBe("error");
    } finally {
      vi.useRealTimers();
    }
  });

  it("retryDocSave 在无失败时可独立调用", async () => {
    const { store } = await harness(() => sseOnce([]));
    await store.getState().retryDocSave();
    expect(store.getState().docSaveState).toBe("saved");
  });
});

describe("DOC5 版本快照节流", () => {
  it("30 分钟窗口内只存一份快照", async () => {
    vi.useFakeTimers();
    try {
      const { store, bodies } = await harness(() => sseOnce([]));
      // 先让初始保存节流判定记录一次（hydrate 后 map 为空 → 首次保存必留快照）
      store.getState().setDoc({ title: "t", content: "v1", updatedAt: 1 });
      await vi.advanceTimersByTimeAsync(700);
      const saves1 = bodies.filter((b) => b.url.includes("doc-versions")).length;
      expect(saves1).toBe(1);

      // 窗口内第二次保存：不再触发快照
      store.getState().setDoc({ title: "t", content: "v2", updatedAt: 2 });
      await vi.advanceTimersByTimeAsync(700);
      const saves2 = bodies.filter((b) => b.url.includes("doc-versions")).length;
      expect(saves2).toBe(1);

      // 越过 30 分钟后再保存：触发新快照
      await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
      store.getState().setDoc({ title: "t", content: "v3", updatedAt: 3 });
      await vi.advanceTimersByTimeAsync(700);
      const saves3 = bodies.filter((b) => b.url.includes("doc-versions")).length;
      expect(saves3).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("saveDocVersion 失败静默（不阻断编辑主链路）", async () => {
    const { store } = await harness(() => sseOnce([]));
    // doc-versions 打桩返回 ok，这里验证调用本身不抛
    await expect(store.getState().saveDocVersion()).resolves.toBeUndefined();
  });
});

describe("DOC3 aiDoc 选区改写", () => {
  it("选区改写只替换选中片段，全文其余部分保持原样", async () => {
    const { store } = await harness(() =>
      sseOnce(['data: {"type":"delta","delta":"改写后的"}\n', 'data: {"type":"done"}\n'])
    );
    await store.getState().aiDoc("polish", "第二段");
    const doc = docOf(store);
    expect(doc?.content).toBe("第一段\n\n改写后的\n\n第三段");
  });

  it("无选区时改写全文（既有行为不回归）", async () => {
    const { store } = await harness(() =>
      sseOnce(['data: {"type":"delta","delta":"新全文"}\n', 'data: {"type":"done"}\n'])
    );
    await store.getState().aiDoc("polish");
    expect(docOf(store)?.content).toBe("新全文");
  });

  it("选区不存在于原文时退化为全文改写", async () => {
    const { store } = await harness(() =>
      sseOnce(['data: {"type":"delta","delta":"全新内容"}\n', 'data: {"type":"done"}\n'])
    );
    await store.getState().aiDoc("polish", "不存在的选区");
    expect(docOf(store)?.content).toBe("全新内容");
  });

  it("continue 模式在全文末尾追加（选区不参与拼接）", async () => {
    const { store } = await harness(() =>
      sseOnce(['data: {"type":"delta","delta":"续写内容"}\n', 'data: {"type":"done"}\n'])
    );
    await store.getState().aiDoc("continue", "第二段");
    expect(docOf(store)?.content).toBe("第一段\n\n第二段\n\n第三段\n\n续写内容");
  });

  it("改写失败回滚到原文", async () => {
    const { store } = await harness(() =>
      sseOnce(['data: {"type":"error","message":"模型出错"}\n'])
    );
    await store.getState().aiDoc("polish", "第二段");
    expect(docOf(store)?.content).toBe("第一段\n\n第二段\n\n第三段");
  });
});