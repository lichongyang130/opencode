/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ArtifactWall } from "./ArtifactWall";
import { useChatStore } from "@/lib/store/chat";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/canvas",
}));

const pristine = useChatStore.getState();

function convo(patch: Record<string, unknown> = {}) {
  return {
    id: "c1",
    title: "测试会话",
    mode: "docs",
    model: "demo",
    messages: [],
    loaded: true,
    archived: false,
    pinned: false,
    createdAt: 1,
    updatedAt: Date.now(),
    ...patch,
  } as never;
}

beforeEach(() => {
  pushMock.mockClear();
  act(() => {
    useChatStore.setState({ ...pristine, conversations: [] }, true);
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** 分类 chip：全部栏目平级（无 soon 字样） */
const CHIP_NAMES = [
  "全部",
  "文档",
  "PPT",
  "原型",
  "幻灯片",
  "图片",
  "HyperFrames",
  "网站复刻",
  "视频",
  "音频",
  "实时产物",
  "WebGL",
  "深度研究",
];

describe("画布产物墙 ArtifactWall", () => {
  it("无产物时：空态引导 + 跨栏目案例速览，分类无 soon", () => {
    render(<ArtifactWall />);
    expect(screen.getByText("我的画布")).toBeDefined();
    expect(screen.getByText("你的画布还是空的")).toBeDefined();
    expect(screen.getByText("去生成第一个产物")).toBeDefined();
    expect(screen.getByText("各栏目案例速览")).toBeDefined();
    for (const k of CHIP_NAMES) {
      expect(screen.getByRole("button", { name: k })).toBeDefined();
    }
    expect(screen.queryByText(/soon/)).toBeNull();
  });

  it("聚合会话产物：文档/PPT/图片/深度研究/视频分镜 均上墙", () => {
    act(() => {
      useChatStore.setState({
        conversations: [
          convo({
            id: "d1",
            title: "文档会话",
            doc: { title: "年度产品路线图", content: "# 目标\n本年度重点…" },
          }),
          convo({
            id: "d2",
            title: "PPT 会话",
            mode: "slides",
            deck: { title: "战略发布会", slides: [{ title: "开场", content: "…", notes: "" }] },
          }),
          convo({
            id: "d3",
            title: "图片会话",
            mode: "image",
            images: [{ id: "i1", prompt: "柯基宇航员海报", model: "x", url: "/poster.png", createdAt: 1 }],
          }),
          convo({
            id: "d4",
            title: "研究会话",
            mode: "research",
            report: { topic: "AI 搜索赛道调研", summary: "竞争格局…", sections: [], takeaways: [], sources: [], createdAt: 1 },
          }),
          convo({
            id: "d5",
            title: "视频会话",
            mode: "video",
            video: { title: "新品宣传片", shots: [] },
          }),
        ] as never,
      });
    });
    render(<ArtifactWall />);
    expect(screen.getByText("年度产品路线图")).toBeDefined();
    expect(screen.getByText("战略发布会")).toBeDefined();
    expect(screen.getByText(/柯基宇航员/)).toBeDefined();
    expect(screen.getByText("AI 搜索赛道调研")).toBeDefined();
    expect(screen.getByText("新品宣传片")).toBeDefined();
    expect(screen.queryByText("各栏目案例速览")).toBeNull();
  });

  it("类型筛选只显示对应产物", () => {
    act(() => {
      useChatStore.setState({
        conversations: [
          convo({ id: "d1", title: "a", doc: { title: "一篇文档" } }),
          convo({ id: "d2", title: "b", mode: "slides", deck: { title: "一套PPT", slides: [] } }),
        ] as never,
      });
    });
    render(<ArtifactWall />);
    fireEvent.click(screen.getByRole("button", { name: "PPT" }));
    expect(screen.getByText("一套PPT")).toBeDefined();
    expect(screen.queryByText("一篇文档")).toBeNull();
  });

  it("选中无产物的栏目（网站复刻）显示该栏目案例，而不是占位提示", () => {
    act(() => {
      useChatStore.setState({
        conversations: [convo({ id: "d1", title: "a", doc: { title: "一篇文档" } })] as never,
      });
    });
    render(<ArtifactWall />);
    fireEvent.click(screen.getByRole("button", { name: "网站复刻" }));
    expect(screen.getByText("「网站复刻」案例")).toBeDefined();
    expect(screen.getByText("官网首页复刻")).toBeDefined();
    expect(screen.getAllByText("以此创作").length).toBeGreaterThan(0);
    expect(screen.queryByText("一篇文档")).toBeNull();
    expect(screen.queryByText(/建设中/)).toBeNull();
  });

  it("点栏目案例 → 新建对应模式会话并预填提示词，跳转 /chat", async () => {
    render(<ArtifactWall />); // 无产物 → 跨栏目案例速览
    const card = screen.getByRole("button", { name: /年度产品路线图/ });
    fireEvent.click(card);
    await waitFor(() => {
      const convos = useChatStore.getState().conversations;
      expect(convos.length).toBeGreaterThan(0);
      expect(convos[0].mode).toBe("docs");
    });
    expect(useChatStore.getState().pendingInput?.text).toContain("年度产品路线图");
    expect(pushMock).toHaveBeenCalledWith("/chat");
  });

  it("hover 带真实图的案例卡显示大图浮层", () => {
    render(<ArtifactWall />); // 无产物 → 各栏目案例速览（含真实图 docs-1）
    const card = screen.getByRole("button", { name: /年度产品路线图/ });
    fireEvent.mouseEnter(card);
    // 浮层出现大图（预览角色弹层里的图片带 alt=卡片标题）
    const imgs = screen.getAllByRole("img", { name: /年度产品路线图/ });
    expect(imgs.length).toBeGreaterThan(1);
    expect(imgs.some((i) => i.getAttribute("src") === "/canvas-art/docs-1.jpg")).toBe(true);
    fireEvent.mouseLeave(card);
    // 浮层消失，只保留卡片封面那张
    expect(screen.getAllByRole("img", { name: /年度产品路线图/ })).toHaveLength(1);
  });

  it("点击产物卡打开预览，可跳转原会话", () => {
    act(() => {
      useChatStore.setState({
        conversations: [convo({ id: "c9", title: "会话九", doc: { title: "商业计划书", content: "内容" } })] as never,
      });
    });
    render(<ArtifactWall />);
    fireEvent.click(screen.getByText("商业计划书"));
    expect(screen.getByText(/在会话中打开/)).toBeDefined();
  });
});
