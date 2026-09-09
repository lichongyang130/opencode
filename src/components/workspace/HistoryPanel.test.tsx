import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { HistoryPanel } from "./HistoryPanel";
import { useChatStore, type Conversation } from "@/lib/store/chat";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

/**
 * HistoryPanel 的 DB3/DB10/DB14 能力：
 * 全文搜索走 /api/search 并渲染高亮片段；有游标时显示「加载更多」；
 * 文件夹分组按折叠块渲染。fetch 全部打桩，store 直接注入状态。
 */

function seedStore(overrides: Partial<ReturnType<typeof useChatStore.getState>> = {}) {
  const convo: Conversation = {
    id: "c1",
    title: "季度复盘",
    mode: "chat",
    model: "demo",
    createdAt: 1700000000000,
    messages: [],
  };
  useChatStore.setState({
    conversations: [convo],
    activeId: "c1",
    hydrated: true,
    convoCursor: null,
    ...overrides,
  } as Partial<ReturnType<typeof useChatStore.getState>>);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** jsdom 里直接改 value 不触发 React onChange，用原生 setter 派发才有效 */
function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("DB10 全文搜索", () => {
  it("输入关键词后调 /api/search 并展示命中会话与高亮片段", async () => {
    seedStore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("/api/search")) {
          return new Response(
            JSON.stringify({
              hits: [{ messageId: "m1", conversationId: "c1", snippet: "营收增长 [[30%]] 的季度" }],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );

    render(<HistoryPanel />);
    const input = screen.getAllByPlaceholderText("搜索")[0] as HTMLInputElement;
    setInputValue(input, "营收");

    await waitFor(() => {
      expect(screen.getByText("搜索结果")).toBeTruthy();
    });
    // 高亮关键词被 <mark> 渲染
    await waitFor(() => {
      expect(screen.getByText("30%").className).toContain("bg-orange-100");
    });
  });

  it("清空搜索词回到列表模式", async () => {
    seedStore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ hits: [] }), { status: 200 }))
    );

    render(<HistoryPanel />);
    const input = screen.getAllByPlaceholderText("搜索")[0] as HTMLInputElement;
    setInputValue(input, "abc");
    await waitFor(() => expect(screen.getByText("搜索结果")).toBeTruthy());

    setInputValue(input, "");
    await waitFor(() => expect(screen.getByText("对话历史")).toBeTruthy());
  });
});

describe("DB3 无限滚动", () => {
  it("有游标时展示「加载更多」并触发 loadMoreConversations", async () => {
    const spy = vi.fn(async () => {});
    seedStore({ convoCursor: "abc", loadMoreConversations: spy });

    render(<HistoryPanel />);
    const btn = screen.getByText("加载更多");
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it("没有游标时不显示「加载更多」", () => {
    seedStore({ convoCursor: null });
    render(<HistoryPanel />);
    expect(screen.queryByText("加载更多")).toBeNull();
  });
});

describe("DB14 文件夹分组", () => {
  it("文件夹内会话按折叠块渲染，未分组会话平铺", async () => {
    useChatStore.setState({
      conversations: [
        { id: "c1", title: "未分组会话", mode: "chat", model: "demo", createdAt: 1, messages: [] },
        {
          id: "c2",
          title: "文件夹内会话",
          mode: "chat",
          model: "demo",
          createdAt: 2,
          folderId: "f1",
          messages: [],
        },
      ],
      activeId: "c1",
      hydrated: true,
      convoCursor: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("/api/folders")) {
          return new Response(
            JSON.stringify({ folders: [{ id: "f1", name: "项目 A" }] }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );

    render(<HistoryPanel />);
    await waitFor(() => expect(screen.getByText("项目 A")).toBeTruthy());
    expect(screen.getByText("未分组会话")).toBeTruthy();
    expect(screen.getByText("文件夹内会话")).toBeTruthy();
  });

  it("点折叠头收起文件夹内会话", async () => {
    useChatStore.setState({
      conversations: [
        {
          id: "c2",
          title: "文件夹内会话",
          mode: "chat",
          model: "demo",
          createdAt: 2,
          folderId: "f1",
          messages: [],
        },
      ],
      activeId: null,
      hydrated: true,
      convoCursor: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ folders: [{ id: "f1", name: "项目 A" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    render(<HistoryPanel />);
    await waitFor(() => expect(screen.getByText("项目 A")).toBeTruthy());
    expect(screen.getByText("文件夹内会话")).toBeTruthy();

    screen.getByText("项目 A").click();
    await waitFor(() => expect(screen.queryByText("文件夹内会话")).toBeNull());
  });
});

describe("UX2 时间分组", () => {
  const base = (offsetMs: number) => ({ updatedAt: Date.now() - offsetMs });
  // 按本地日历日构造时间点：分桶逻辑按「本地今天/昨天/更早」走，
  // 固定毫秒偏移（如 now-26h）在 UTC 环境会跨到前天导致标签断言失败
  const atLocalDay = (dayOffset: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };

  it("未分组会话按时间桶渲染标签（今天/昨天/更早）", async () => {
    useChatStore.setState({
      conversations: [
        { id: "t1", title: "今天的会话", mode: "chat", model: "demo", createdAt: 1, messages: [], ...base(0) },
        { id: "t2", title: "昨天的会话", mode: "chat", model: "demo", createdAt: 1, messages: [], updatedAt: atLocalDay(-1, 12) },
        { id: "t3", title: "去年的会话", mode: "chat", model: "demo", createdAt: 1, messages: [], updatedAt: atLocalDay(-400, 12) },
      ],
      activeId: "t1",
      hydrated: true,
      convoCursor: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ folders: [] }), { status: 200 }))
    );

    render(<HistoryPanel />);
    await waitFor(() => expect(screen.getByText("今天")).toBeTruthy());
    expect(screen.getByText("昨天")).toBeTruthy();
    expect(screen.getByText("更早")).toBeTruthy();
  });

  it("有手动排序（sortIndex）时退回平铺不渲染时间桶标签", async () => {
    useChatStore.setState({
      conversations: [
        { id: "s1", title: "手动排过", mode: "chat", model: "demo", createdAt: 1, messages: [], sortIndex: 0, ...base(0) },
      ],
      activeId: "s1",
      hydrated: true,
      convoCursor: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ folders: [] }), { status: 200 }))
    );

    render(<HistoryPanel />);
    await waitFor(() => expect(screen.getByText("手动排过")).toBeTruthy());
    expect(screen.queryByText("今天")).toBeNull();
  });
});

describe("UX4 空历史引导", () => {
  it("无会话时展示空态与新建对话引导按钮", async () => {
    useChatStore.setState({
      conversations: [],
      activeId: null,
      hydrated: true,
      convoCursor: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ folders: [] }), { status: 200 }))
    );

    render(<HistoryPanel />);
    await waitFor(() => expect(screen.getByText("暂无历史对话")).toBeTruthy());
    expect(screen.getByText("从这里开始你的第一个任务，或直接新建对话。")).toBeTruthy();
  });
});

describe("UX20 移动端抽屉", () => {
  it("mobileOpen 时面板以抽屉态渲染（z-50 浮层）", async () => {
    useChatStore.setState({
      conversations: [
        { id: "c1", title: "抽屉中的会话", mode: "chat", model: "demo", createdAt: 1, messages: [] },
      ],
      activeId: "c1",
      hydrated: true,
      convoCursor: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ folders: [] }), { status: 200 }))
    );

    const { container } = render(<HistoryPanel mobileOpen />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("z-50");
  });

  it("选中会话后触发 onMobileClose 收起抽屉", async () => {
    const closeSpy = vi.fn();
    const selectSpy = vi.fn(async () => {});
    useChatStore.setState({
      conversations: [
        { id: "c1", title: "点击我", mode: "chat", model: "demo", createdAt: 1, messages: [] },
      ],
      activeId: "c1",
      hydrated: true,
      convoCursor: null,
      selectConversation: selectSpy,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ folders: [] }), { status: 200 }))
    );

    render(<HistoryPanel mobileOpen onMobileClose={closeSpy} />);
    (screen.getByLabelText("打开会话") as HTMLElement).click();
    expect(closeSpy).toHaveBeenCalled();
  });
});