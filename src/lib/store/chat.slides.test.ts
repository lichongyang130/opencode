import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useChatStore as StoreType } from "./chat";

/**
 * PPT 章 store 侧行为锁定：
 *  1) generateSlidesOutline 大纲先行 → OutlineEditor 可编辑 → confirmOutline 转成稿上下文；
 *  2) moveSlide 拖拽排序语义（to 为插入后索引）；
 *  3) regenerateSlide 单页重写只替换目标页。
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

async function harness(
  chatHandler: (init?: RequestInit) => Response | Promise<Response>,
  slidesHandler?: (body: unknown) => Response,
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
              mode: "slides",
              model: "gpt-4o-mini",
              deck: {
                title: "测试演示",
                theme: "violet",
                slides: [
                  { layout: "cover", title: "封面" },
                  { layout: "content", title: "第一页", bullets: ["a", "b"] },
                  { layout: "end", title: "谢谢" },
                ],
              },
            },
          ],
        });
      if (url.includes("/api/slides") && url.includes("export")) {
        return new Response(new Blob(["pptx"]), { status: 200 });
      }
      if (url.includes("/api/slides") && init?.method === "POST") {
        return slidesHandler ? slidesHandler(parsed) : json({ ok: true });
      }
      if (url.includes("/api/chat")) return chatHandler(init);
      if (url.includes("/api/models")) return json({ status: { openai: true } });
      return json({ ok: true });
    })
  );
  const mod = await import("./chat");
  await mod.useChatStore.getState().hydrate();
  return { store: mod.useChatStore, bodies };
}

const deckOf = (store: Store) =>
  store.getState().conversations.find((c) => c.id === "c1")?.deck;
const outlineOf = (store: Store) =>
  store.getState().conversations.find((c) => c.id === "c1")?.deckOutline;

const OUTLINE_JSON = JSON.stringify({
  title: "AI 产品发布",
  subtitle: "2026",
  pages: [
    { layout: "cover", title: "封面页" },
    { layout: "toc", title: "目录" },
    { layout: "content", title: "要点页", hint: "三个卖点" },
    { layout: "end", title: "谢谢" },
  ],
});

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PPT4 moveSlide", () => {
  it("把第 2 页移到末尾（to 为插入后索引）", async () => {
    const { store, bodies } = await harness(() => sseOnce([]));
    store.getState().moveSlide(1, 3);
    const deck = deckOf(store);
    expect(deck?.slides.map((s) => s.title)).toEqual(["封面", "谢谢", "第一页"]);
    // 立即落库（不防抖）
    const patch = bodies.find((b) => b.method === "PATCH" && JSON.stringify(b.body).includes("deck"));
    expect(patch).toBeTruthy();
  });

  it("越界与原位静默跳过", async () => {
    const { store } = await harness(() => sseOnce([]));
    const before = deckOf(store)?.slides.map((s) => s.title);
    store.getState().moveSlide(0, 99);
    store.getState().moveSlide(1, 1);
    expect(deckOf(store)?.slides.map((s) => s.title)).toEqual(before);
  });
});

describe("PPT1 大纲先行", () => {
  it("generateSlidesOutline 流式收大纲并挂 deckOutline", async () => {
    const { store } = await harness(() =>
      sseOnce([`data: {"type":"delta","delta":${JSON.stringify(OUTLINE_JSON)}}\n`, 'data: {"type":"done"}\n'])
    );
    await store.getState().generateSlidesOutline("AI 产品发布会");
    const o = outlineOf(store);
    expect(o?.title).toBe("AI 产品发布");
    expect(o?.pages).toHaveLength(4);
    expect(o?.pages[2].hint).toBe("三个卖点");
    expect(store.getState().conversations[0].deckStatus).not.toBe("error");
  });

  it("大纲页编辑/增删/移动", async () => {
    const { store } = await harness(() =>
      sseOnce([`data: {"type":"delta","delta":${JSON.stringify(OUTLINE_JSON)}}\n`, 'data: {"type":"done"}\n'])
    );
    await store.getState().generateSlidesOutline("AI 产品发布会");
    store.getState().patchOutlinePage(2, { title: "改后的要点页" });
    store.getState().moveOutlinePage(2, 1);
    store.getState().addOutlinePage(0);
    store.getState().deleteOutlinePage(3);
    const o = outlineOf(store);
    expect(o?.pages.some((p) => p.title === "改后的要点页")).toBe(true);
    expect(o?.pages).toHaveLength(4); // 4 - 1 移动不变 + 1 新增 - 1 删除 = 4
    expect(o?.pages.some((p) => p.title === "新页面")).toBe(true);
  });

  it("confirmOutline 清暂态并转 generateSlides（带上下文）", async () => {
    const { store, bodies } = await harness(() =>
      sseOnce([`data: {"type":"delta","delta":${JSON.stringify(OUTLINE_JSON)}}\n`, 'data: {"type":"done"}\n'])
    );
    await store.getState().generateSlidesOutline("AI 产品发布会");
    await store.getState().confirmOutline();
    // generateSlides 走 /api/slides，body 带大纲转的 context
    const slidesCall = bodies.find((b) => b.url.includes("/api/slides") && b.method === "POST");
    expect(slidesCall).toBeTruthy();
    expect(String((slidesCall!.body as Record<string, unknown>).context)).toContain("严格按此结构生成");
    expect(outlineOf(store)).toBeUndefined();
  });
});

describe("PPT2 regenerateSlide", () => {
  it("单页重写只替换目标页，其余页保持原样", async () => {
    const rewritten = JSON.stringify({ layout: "content", title: "重写后的页", bullets: ["x", "y", "z"] });
    const { store } = await harness(() =>
      sseOnce([`data: {"type":"delta","delta":${JSON.stringify(rewritten)}}\n`, 'data: {"type":"done"}\n'])
    );
    await store.getState().regenerateSlide(1);
    const deck = deckOf(store);
    expect(deck?.slides[0].title).toBe("封面"); // 其余页不动
    expect(deck?.slides[1].title).toBe("重写后的页");
    expect(deck?.slides[1].bullets).toEqual(["x", "y", "z"]);
    expect(deck?.slides[2].title).toBe("谢谢");
  });

  it("解析失败保留原页", async () => {
    const { store } = await harness(() =>
      sseOnce(['data: {"type":"delta","delta":"不是JSON"}\n', 'data: {"type":"done"}\n'])
    );
    await store.getState().regenerateSlide(1);
    expect(deckOf(store)?.slides[1].title).toBe("第一页");
  });
});