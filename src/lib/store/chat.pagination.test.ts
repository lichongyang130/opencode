import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useChatStore as StoreType } from "./chat";

/**
 * DB3/DB4 分页拉取：会话列表滚动加载下一页、超长会话向上补拉更早消息。
 * 两个入口都必须防抖：没有游标/正在加载时不再发请求；补拉按 createdAt
 * 游标衔接且拼接后保持时间正序。
 */

type Store = typeof StoreType;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

async function freshStore(): Promise<Store> {
  vi.resetModules();
  const mod = await import("./chat");
  return mod.useChatStore;
}

let store: Store;

beforeEach(async () => {
  vi.unstubAllGlobals();
  store = await freshStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadMoreConversations（DB3）", () => {
  it("有游标时拉下一页并更新游标；无游标时静默跳过", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("cursor=abc")) {
        return json({ conversations: [{ id: "c2", title: "第二页" }], nextCursor: null });
      }
      return json({ conversations: [{ id: "c1" }], nextCursor: "abc" });
    });
    vi.stubGlobal("fetch", fetchMock);
    await store.getState().hydrate();

    // hydrate 后游标是 abc → 拉第二页
    await store.getState().loadMoreConversations();
    const convos = store.getState().conversations.map((c) => c.id);
    expect(convos).toContain("c1");
    expect(convos).toContain("c2");
    // 第二页无游标 → 再拉直接跳过（fetch 不新增调用）
    const callsAfter = fetchMock.mock.calls.length;
    await store.getState().loadMoreConversations();
    expect(fetchMock.mock.calls.length).toBe(callsAfter);
    expect(store.getState().convoCursor).toBeNull();
  });

  it("请求失败时保留原列表与游标可重试", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("cursor=")) return new Response("boom", { status: 500 });
      return json({ conversations: [{ id: "c1" }], nextCursor: "abc" });
    });
    vi.stubGlobal("fetch", fetchMock);
    await store.getState().hydrate();

    await store.getState().loadMoreConversations();
    // 失败不打断：列表原样、游标保留、loadingMore 复位
    expect(store.getState().conversations.map((c) => c.id)).toEqual(["c1"]);
    expect(store.getState().convoCursor).toBe("abc");
    expect(store.getState().loadingMore).toBe(false);
  });

  it("新页与旧页 id 重复时去重", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("cursor=abc")) {
          return json({ conversations: [{ id: "c1" }, { id: "c2" }], nextCursor: null });
        }
        return json({ conversations: [{ id: "c1" }], nextCursor: "abc" });
      })
    );
    await store.getState().hydrate();
    await store.getState().loadMoreConversations();
    const ids = store.getState().conversations.map((c) => c.id);
    expect(ids).toEqual(["c1", "c2"]);
  });
});

describe("loadEarlierMessages（DB4）", () => {
  /** 把会话置为已加载状态并注入消息（绕开 selectConversation 的拉取） */
  function seedLoadedConvo(
    messages: Array<{ id: string; content: string; createdAt?: number }>,
    hasEarlier = true
  ) {
    store.setState({
      conversations: [
        {
          id: "c1",
          title: "超长会话",
          mode: "chat",
          model: "demo",
          createdAt: 1,
          loaded: true,
          hasEarlier,
          messages: messages.map((m) => ({
            id: m.id,
            role: "user" as const,
            content: m.content,
            createdAt: m.createdAt,
          })),
        },
      ],
      activeId: "c1",
    });
  }

  it("按最早消息的 createdAt 拉更早历史并前置拼接", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("before=100")) {
        return json({
          messages: [
            { id: "m0", role: "user", content: "更早", error: false, createdAt: 50 },
          ],
          hasMore: false,
        });
      }
      return json({ messages: [], hasMore: false });
    });
    vi.stubGlobal("fetch", fetchMock);
    seedLoadedConvo([{ id: "m1", content: "后来", createdAt: 100 }]);

    const n = await store.getState().loadEarlierMessages("c1");
    expect(n).toBe(1);
    const convo = store.getState().conversations[0];
    expect(convo.messages.map((m) => m.id)).toEqual(["m0", "m1"]);
    expect(convo.hasEarlier).toBe(false);
  });

  it("没有更早历史（hasEarlier=false）时不发请求", async () => {
    const fetchMock = vi.fn(async () => json({ messages: [] }));
    vi.stubGlobal("fetch", fetchMock);
    seedLoadedConvo([{ id: "m1", content: "x", createdAt: 100 }], false);

    const n = await store.getState().loadEarlierMessages("c1");
    expect(n).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("本地新增消息（无 createdAt）开头时跳过补拉", async () => {
    const fetchMock = vi.fn(async () => json({ messages: [] }));
    vi.stubGlobal("fetch", fetchMock);
    seedLoadedConvo([{ id: "m1", content: "本地新增" }]);

    const n = await store.getState().loadEarlierMessages("c1");
    expect(n).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});