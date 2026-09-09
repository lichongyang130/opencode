/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { ArtifactWall } from "./ArtifactWall";
import { useChatStore } from "@/lib/store/chat";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
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

describe("画布产物墙 ArtifactWall", () => {
  it("无产物时显示空态引导", () => {
    render(<ArtifactWall />);
    expect(screen.getByText("我的画布")).toBeDefined();
    expect(screen.getByText("你的画布还是空的")).toBeDefined();
    expect(screen.getByText("去生成第一个产物")).toBeDefined();
  });

  it("聚合会话产物：文档/PPT/图片/研究报告/视频 均上墙", () => {
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
            deck: { title: "战略发布会", slides: [{ title: "开场", content: "…", image: "/img1.png", notes: "" }] },
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
    // 分类 tab 存在
    for (const k of ["全部", "文档", "PPT", "图片", "研究报告", "视频分镜"]) {
      expect(screen.getByRole("button", { name: k })).toBeDefined();
    }
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
