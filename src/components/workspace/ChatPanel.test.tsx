/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "./ChatPanel";
import { useChatStore, type Conversation, type UIMessage } from "@/lib/store/chat";

/**
 * ChatPanel 组件测试。
 *
 * 关注点是「用户能不能把话发出去」这条主链路：空态引导、输入提交、模式路由、
 * 中断、斜杠命令、提示词参数叠加。store 用真实 zustand 实例，只把会发网络请求的
 * action 换成 spy —— 这样既能验证 UI 与 store 的联动，又不依赖真实后端。
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const SETTINGS_KEY = "opencanvas.provider.settings.v1";

/** 保存创建时的原始 state（含全部 action 引用），用于每个用例前完整复位 */
const pristine = useChatStore.getState();

function makeConvo(patch: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    title: "AI 对话",
    mode: "chat",
    model: "demo",
    messages: [],
    loaded: true,
    archived: false,
    pinned: false,
    createdAt: 1,
    ...patch,
  };
}

function msg(patch: Partial<UIMessage> & { id: string }): UIMessage {
  return { role: "assistant", content: "", ...patch };
}

/** 装载一个会话并接管所有会发请求的 action */
function seed(convo?: Partial<Conversation>) {
  const spies = {
    send: vi.fn(async () => {}),
    generateImage: vi.fn(async () => {}),
    stopGeneration: vi.fn(),
  };
  const c = makeConvo(convo);
  act(() => {
    useChatStore.setState({ conversations: [c], activeId: c.id, ...spies });
  });
  return spies;
}

/**
 * 当前输入框。IMG 章后 image 模式参数区会多渲染负向词 input（同为 textbox），
 * 这里只认 textarea —— 它才是唯一的主输入舱。
 */
const ta = () =>
  screen.getAllByRole("textbox").find((el) => el.tagName === "TEXTAREA") as HTMLTextAreaElement;
const type = (value: string) => fireEvent.change(ta(), { target: { value } });
const pressEnter = (init: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(ta(), { key: "Enter", ...init });

beforeEach(() => {
  // 绝大多数请求（会话落库、/api/models 探活）都是「失败也不影响 UI」的旁路调用，
  // 统一兜成空成功响应，避免未处理的 rejection 干扰断言
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ status: {} }), { status: 200 })),
  );
  act(() => {
    useChatStore.setState({ ...pristine }, true);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ─────────────── 空态引导 ─────────────── */

describe("ChatPanel 空态", () => {
  it("空态顶部显示醒目大字问候（h1）", () => {
    seed();
    render(<ChatPanel />);
    const h = screen.getByRole("heading", { level: 1 });
    expect(h.textContent).toContain("欢迎回来，今天想做点什么？");
  });

  it("顶部技能条：文档/PPT/图片/幻灯片/网站复刻 + 更多（无全部）", () => {
    seed();
    const { container } = render(<ChatPanel />);
    for (const name of ["文档", "PPT", "图片", "幻灯片", "网站复刻"]) {
      expect(screen.getByRole("tab", { name: new RegExp(name) })).toBeDefined();
    }
    expect(screen.queryByRole("tab", { name: /全部/ })).toBeNull();
    expect(screen.getByTitle("更多技能")).toBeDefined();
    expect(screen.getByText("文档 · 示例模板")).toBeDefined();
    expect(screen.getByText(/点卡片预览/)).toBeDefined();
    expect(container.querySelector('img[src="/cases/aura/cover.jpg"]')).not.toBeNull();
  });

  it("图片技能模板卡显示真实 AI 成品图（d-* 图库）", () => {
    seed();
    const { container } = render(<ChatPanel />);
    fireEvent.click(screen.getByRole("tab", { name: /图片/ }));
    expect(screen.getByText("图片 · 示例模板")).toBeDefined();
    expect(container.querySelector('img[src="/cases/d-corgi-2.jpg"]')).not.toBeNull();
  });

  it("更多下拉包含收纳技能（图片已在顶部，不再进更多），选中即切换模板", () => {
    seed();
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle("更多技能"));
    expect(screen.queryByRole("option", { name: /图片/ })).toBeNull();
    expect(screen.getByRole("option", { name: /深度研究/ })).toBeDefined();
    expect(screen.getByRole("option", { name: /视频/ })).toBeDefined();
    expect(screen.getByRole("option", { name: /原型/ })).toBeDefined();
    expect(screen.getByRole("option", { name: /HyperFrames/ })).toBeDefined();
    // 选中收纳技能：技能全部平级（不再有「建设中」占位）；点示例卡填入提示词
    fireEvent.click(screen.getByRole("option", { name: /音频/ }));
    expect(screen.getByText("音频 · 示例模板")).toBeDefined();
    expect(screen.queryByText(/建设中/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "语音配音" }));
    const box = screen.getByRole("textbox") as HTMLInputElement;
    expect(box.value.length).toBeGreaterThan(0);
    expect(box.value).toContain("语音配音");
    // 顶部更多入口显示当前选中技能名
    expect(screen.getByRole("tab", { name: /音频/ })).toBeDefined();
  });

  it("给出回车/换行的操作提示", () => {
    seed();
    render(<ChatPanel />);
    expect(screen.getByText(/回车发送 · Shift\+回车换行/)).toBeDefined();
  });

  it("只渲染一个输入舱", () => {
    seed();
    render(<ChatPanel />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("chat 模式下 placeholder 为通用文案", () => {
    seed();
    render(<ChatPanel />);
    // C30: 文案由「分配任务…」改成了小白友好的说法
    expect(ta().placeholder).toBe("想做什么？写下来告诉我…");
  });

  it("非 chat 模式下 placeholder 带模式名", () => {
    seed({ mode: "slides" });
    render(<ChatPanel />);
    expect(ta().placeholder).toBe("PPT 生成：描述你的需求…");
  });

  it("image 模式下 placeholder 提示描述画面", () => {
    seed({ mode: "image" });
    render(<ChatPanel />);
    expect(ta().placeholder).toBe("描述你想要的画面…");
  });

  it("空输入时发送按钮禁用", () => {
    seed();
    render(<ChatPanel />);
    expect((screen.getByTitle("输入内容后可发送") as HTMLButtonElement).disabled).toBe(true);
  });

  it("空输入时优化按钮禁用", () => {
    seed();
    render(<ChatPanel />);
    expect((screen.getByTitle("输入内容后可优化提示词") as HTMLButtonElement).disabled).toBe(true);
  });

    it("默认技能（文档）第 1 批渲染 4 张示例卡", () => {
    seed();
    render(<ChatPanel />);
    for (const name of ["启衡 ASTRA 产品手册", "磁悬浮氛围灯拍摄简报", "火焰香薰机氛围拍摄简报", "透明机甲蓝牙音箱拍摄简报"]) {
      expect(screen.getByRole("button", { name })).toBeDefined();
    }
    expect(screen.queryByRole("button", { name: "制作 PPT" })).toBeNull();
    expect(screen.queryByText(/共 \d+ 个/)).toBeNull();
    expect(screen.queryByTitle("下一个示例")).toBeNull();
  });

  it("选中技能后一行 4 张，「换一批」可翻到下一批", () => {
    seed();
    render(<ChatPanel />);
    fireEvent.click(screen.getByRole("tab", { name: "文档" }));
    expect(screen.getByText("文档 · 示例模板")).toBeDefined();
    for (const name of ["启衡 ASTRA 产品手册", "磁悬浮氛围灯拍摄简报", "火焰香薰机氛围拍摄简报", "透明机甲蓝牙音箱拍摄简报"]) {
      expect(screen.getByRole("button", { name })).toBeDefined();
    }
    expect(screen.queryByRole("button", { name: "制作 PPT" })).toBeNull();
    // 12/4=3 批，换两次到最后一批
    fireEvent.click(screen.getByRole("button", { name: "换一批" }));
    fireEvent.click(screen.getByRole("button", { name: "换一批" }));
    expect(screen.getByRole("button", { name: "立项提案" })).toBeDefined();
    expect(screen.getByRole("button", { name: "制度手册" })).toBeDefined();
  });

  it("空消息态不渲染角色选择器", () => {
    seed();
    render(<ChatPanel />);
    expect(screen.queryByTitle("选择 AI 角色（专家人设）")).toBeNull();
  });
});

/* ─────────────── 输入框「+」添加菜单 ─────────────── */

describe("ChatPanel 添加菜单", () => {
  it("输入框不再显示 AI 对话技能下拉，改为「+」十字按钮", () => {
    seed();
    render(<ChatPanel />);
    // 旧技能下拉入口已移除（不再有“AI 对话”文本）
    expect(screen.queryByTitle(/技能选择/)).toBeNull();
    expect(screen.queryByRole("button", { name: /AI 对话/ })).toBeNull();
    // 新增「+」按钮
    expect(screen.getByTitle(/添加：/)).toBeDefined();
  });

  it("点击 + 弹出添加菜单（含参考截图各项）", () => {
    seed();
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle(/添加：/));
    const items: RegExp[] = [/附加文件/, /引用其它项目/, /关联本地代码/, /插件/, /Figma/, /连接器/, /MCP/, /看板/];
    for (const re of items) {
      expect(screen.getByRole("menuitem", { name: re })).toBeDefined();
    }
  });

  it("点击菜单项收起菜单且不发送消息（演示态提示即将支持）", () => {
    const spies = seed();
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle(/添加：/));
    fireEvent.click(screen.getByRole("menuitem", { name: /附加文件/ }));
    // 菜单已收起
    expect(screen.queryByRole("menuitem")).toBeNull();
    // 不触发对话
    expect(spies.send).not.toHaveBeenCalled();
    expect(spies.generateImage).not.toHaveBeenCalled();
  });

  it("再次点击 + 可收起菜单", () => {
    seed();
    render(<ChatPanel />);
    const btn = screen.getByTitle(/添加：/);
    fireEvent.click(btn);
    expect(screen.getByRole("menu")).toBeDefined();
    fireEvent.click(btn);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

/* ─────────────── 提交主链路 ─────────────── */

describe("ChatPanel 提交", () => {
  it("输入内容后发送按钮启用", () => {
    seed();
    render(<ChatPanel />);
    type("你好");
    expect((screen.getByTitle("发送（回车）") as HTMLButtonElement).disabled).toBe(false);
  });

  it("点击发送按钮调用 send", () => {
    const spies = seed();
    render(<ChatPanel />);
    type("你好");
    fireEvent.click(screen.getByTitle("发送（回车）"));
    expect(spies.send).toHaveBeenCalledWith("你好");
  });

  it("回车提交", () => {
    const spies = seed();
    render(<ChatPanel />);
    type("回车发送");
    pressEnter();
    expect(spies.send).toHaveBeenCalledWith("回车发送");
  });

  it("提交后清空输入框", () => {
    seed();
    render(<ChatPanel />);
    type("清空我");
    pressEnter();
    expect(ta().value).toBe("");
  });

  it("Shift+回车不提交", () => {
    const spies = seed();
    render(<ChatPanel />);
    type("换行不发");
    pressEnter({ shiftKey: true });
    expect(spies.send).not.toHaveBeenCalled();
    expect(ta().value).toBe("换行不发");
  });

  it("纯空白输入不提交", () => {
    const spies = seed();
    render(<ChatPanel />);
    type("   \n  ");
    pressEnter();
    expect(spies.send).not.toHaveBeenCalled();
  });

  it("发送中再次回车不重复提交", () => {
    const spies = seed();
    render(<ChatPanel />);
    type("重复提交");
    act(() => {
      useChatStore.setState({ sending: true });
    });
    pressEnter();
    expect(spies.send).not.toHaveBeenCalled();
  });

  it("提交原文保留首尾空格交给 store 去 trim", () => {
    const spies = seed();
    render(<ChatPanel />);
    type("  带空格  ");
    pressEnter();
    expect(spies.send).toHaveBeenCalledWith("  带空格  ");
  });
});

/* ─────────────── 模式路由 ─────────────── */

describe("ChatPanel 模式路由", () => {
  it("image 模式走绘图而不是对话（默认参数）", () => {
    const spies = seed({ mode: "image" });
    render(<ChatPanel />);
    type("一只柯基");
    pressEnter();
    // IMG 后新签名：opts 对象（未选参数走默认值），不再是旧的字符串尺寸
    expect(spies.generateImage).toHaveBeenCalledWith("一只柯基", {
      size: "1024x1024",
      model: expect.any(String),
      n: expect.any(Number),
      style: undefined,
      negative: undefined,
      reference: undefined,
    });
    expect(spies.send).not.toHaveBeenCalled();
  });

  it("切换尺寸后 opts 带上新尺寸", () => {
    const spies = seed({ mode: "image" });
    render(<ChatPanel />);
    fireEvent.click(screen.getByRole("button", { name: "横版 16:9" }));
    type("一只柯基");
    pressEnter();
    expect(spies.generateImage).toHaveBeenCalledWith(
      "一只柯基",
      expect.objectContaining({ size: "1792x1024" })
    );
  });

  it("IMG1~4: 模型/张数/风格/负向全部进 opts", () => {
    const spies = seed({ mode: "image" });
    render(<ChatPanel />);
    fireEvent.click(screen.getByRole("button", { name: "DALL·E 3" }));
    fireEvent.click(screen.getByRole("button", { name: "2 张" }));
    fireEvent.click(screen.getByRole("button", { name: "赛博朋克" }));
    fireEvent.change(screen.getByPlaceholderText(/不想出现的元素/), {
      target: { value: "文字，水印" },
    });
    type("夜之城");
    pressEnter();
    expect(spies.generateImage).toHaveBeenCalledWith(
      "夜之城",
      expect.objectContaining({
        model: "dall-e-3",
        n: 2,
        style: "cyberpunk",
        negative: "文字，水印",
      })
    );
  });

  it("image 模式渲染模型/尺寸/张数/风格与负向输入", () => {
    seed({ mode: "image" });
    render(<ChatPanel />);
    expect(screen.getByRole("button", { name: "方形 1:1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "演示绘图（免费）" })).toBeDefined();
    expect(screen.getByRole("button", { name: "1 张" })).toBeDefined();
    expect(screen.getByRole("button", { name: "电影感海报" })).toBeDefined();
    expect(screen.getByPlaceholderText(/不想出现的元素/)).toBeDefined();
  });

  it("IMG3: 风格是切换参数而非改写输入文本", () => {
    const spies = seed({ mode: "image" });
    render(<ChatPanel />);
    type("一只柯基");
    // 输入文本不再被追加风格词（旧交互废弃）
    fireEvent.click(screen.getByRole("button", { name: "3D 渲染" }));
    expect(ta().value).toBe("一只柯基");
    pressEnter();
    expect(spies.generateImage).toHaveBeenCalledWith(
      "一只柯基",
      expect.objectContaining({ style: "3d" })
    );
  });

  it("IMG3: 再次点击同一风格取消选择", () => {
    const spies = seed({ mode: "image" });
    render(<ChatPanel />);
    fireEvent.click(screen.getByRole("button", { name: "水彩手绘" }));
    fireEvent.click(screen.getByRole("button", { name: "水彩手绘" }));
    type("花园");
    pressEnter();
    expect(spies.generateImage).toHaveBeenCalledWith(
      "花园",
      expect.objectContaining({ style: undefined })
    );
  });

  it("IMG6: 历史面板可开关，空历史显示占位", () => {
    seed({ mode: "image" });
    render(<ChatPanel />);
    expect(screen.queryByText("还没有历史记录")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "历史" }));
    expect(screen.getByText("还没有历史记录")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "历史" }));
    expect(screen.queryByText("还没有历史记录")).toBeNull();
  });

  it("image 模式不渲染语气/长度/受众参数", () => {
    seed({ mode: "image" });
    render(<ChatPanel />);
    expect(screen.queryByRole("button", { name: "专业" })).toBeNull();
  });

  it("非 image 模式不渲染绘图参数", () => {
    seed();
    render(<ChatPanel />);
    expect(screen.queryByRole("button", { name: "方形 1:1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "历史" })).toBeNull();
  });
});

/* ─────────────── 中断生成 ─────────────── */

describe("ChatPanel 中断", () => {
  it("发送中把发送按钮换成停止按钮", () => {
    seed();
    render(<ChatPanel />);
    act(() => {
      useChatStore.setState({ sending: true });
    });
    expect(screen.getByTitle("停止生成")).toBeDefined();
    expect(screen.queryByTitle("发送")).toBeNull();
  });

  it("点击停止按钮调用 stopGeneration", () => {
    const spies = seed();
    render(<ChatPanel />);
    act(() => {
      useChatStore.setState({ sending: true });
    });
    fireEvent.click(screen.getByTitle("停止生成"));
    expect(spies.stopGeneration).toHaveBeenCalledTimes(1);
  });

  it("生成结束后恢复发送按钮", () => {
    seed();
    render(<ChatPanel />);
    act(() => {
      useChatStore.setState({ sending: true });
    });
    act(() => {
      useChatStore.setState({ sending: false });
    });
    expect(screen.getByTitle("输入内容后可发送")).toBeDefined();
  });
});

/* ─────────────── 消息列表 ─────────────── */

describe("ChatPanel 消息列表", () => {
  it("渲染用户与助手消息", () => {
    seed({
      messages: [
        msg({ id: "m1", role: "user", content: "问题" }),
        msg({ id: "m2", role: "assistant", content: "回答" }),
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText("问题")).toBeDefined();
    expect(screen.getByText("回答")).toBeDefined();
  });

  it("有消息后不再显示欢迎语", () => {
    seed({ messages: [msg({ id: "m1", role: "user", content: "问题" })] });
    render(<ChatPanel />);
    expect(screen.queryByRole("heading", { name: /欢迎回来/ })).toBeNull();
  });

  it("有消息时仍然只有一个输入舱", () => {
    seed({ messages: [msg({ id: "m1", role: "user", content: "问题" })] });
    render(<ChatPanel />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("流式且无内容时显示思考中占位", () => {
    seed({ messages: [msg({ id: "m1", content: "", streaming: true })] });
    render(<ChatPanel />);
    expect(screen.getByText("正在思考…")).toBeDefined();
  });

  it("流式且有内容时不显示占位", () => {
    seed({ messages: [msg({ id: "m1", content: "已经有内容", streaming: true })] });
    render(<ChatPanel />);
    expect(screen.queryByText("正在思考…")).toBeNull();
    expect(screen.getByText("已经有内容")).toBeDefined();
  });

  it("流式消息不显示复制按钮", () => {
    seed({ messages: [msg({ id: "m1", content: "写到一半", streaming: true })] });
    render(<ChatPanel />);
    expect(screen.queryByTitle("复制")).toBeNull();
  });

  it("错误消息用告警配色", () => {
    seed({ messages: [msg({ id: "m1", content: "出错了", error: true })] });
    render(<ChatPanel />);
    const bubble = screen.getByText("出错了").closest("div.markdown-body")?.parentElement;
    expect(bubble?.className).toContain("bg-red-50");
  });

  it("chat 模式渲染角色选择器", () => {
    seed({ messages: [msg({ id: "m1", role: "user", content: "问题" })] });
    render(<ChatPanel />);
    expect(screen.getByTitle("选择 AI 角色（专家人设）")).toBeDefined();
  });

  it("非 chat 模式不渲染角色选择器", () => {
    seed({ mode: "docs", messages: [msg({ id: "m1", role: "user", content: "问题" })] });
    render(<ChatPanel />);
    expect(screen.queryByTitle("选择 AI 角色（专家人设）")).toBeNull();
  });

  it("点击复制把正文写入剪贴板", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    seed({ messages: [msg({ id: "m1", role: "user", content: "复制这段" })] });
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle("复制"));
    expect(writeText).toHaveBeenCalledWith("复制这段");
    await waitFor(() => expect(screen.getByText("已复制")).toBeDefined());
  });

  it("助手消息经 Markdown 渲染而非纯文本", () => {
    seed({ messages: [msg({ id: "m1", content: "**加粗**" })] });
    render(<ChatPanel />);
    expect(screen.getByText("加粗").tagName).toBe("STRONG");
  });
});

/* ─────────────── 快捷卡片与预填 ─────────────── */

describe("ChatPanel 预填", () => {
  it("点击示例卡：把详细提示词填入输入框并切到对应技能，但不自动发送", () => {
    const spies = seed();
    render(<ChatPanel />);
    fireEvent.click(screen.getByRole("tab", { name: "PPT" }));
    fireEvent.click(screen.getByRole("button", { name: "制作 PPT" }));
    fireEvent.click(screen.getByRole("button", { name: /做同款/ }));
    // 填入的是详细变体提示词（长于原始一句），内容属于该卡主题
    expect(ta().value.length).toBeGreaterThan(30);
    expect(ta().value).toContain("幻灯片");
    // 不触发发送 / 绘图
    expect(spies.send).not.toHaveBeenCalled();
    expect(spies.generateImage).not.toHaveBeenCalled();
    expect(useChatStore.getState().conversations[0].mode).toBe("slides");
  });

  it("点击图片示例卡：切到图片技能并填入绘图详细提示词", () => {
    const spies = seed();
    render(<ChatPanel />);
    fireEvent.click(screen.getByRole("tab", { name: "图片" }));
    fireEvent.click(screen.getByRole("button", { name: "生成图片" }));
    fireEvent.click(screen.getByRole("button", { name: /做同款/ }));
    expect(ta().value.length).toBeGreaterThan(30);
    expect(spies.generateImage).not.toHaveBeenCalled();
    expect(spies.send).not.toHaveBeenCalled();
    expect(useChatStore.getState().conversations[0].mode).toBe("image");
  });

  it("同一张模板卡点击两次：填入的详细提示词内容不同", () => {
    seed();
    render(<ChatPanel />);
    fireEvent.click(screen.getByRole("tab", { name: "PPT" }));
    fireEvent.click(screen.getByRole("button", { name: "制作 PPT" }));
    fireEvent.click(screen.getByRole("button", { name: /做同款/ }));
    const first = ta().value;
    // 清空后再次点击同一卡
    act(() => { type(""); });
    fireEvent.click(screen.getByRole("button", { name: "制作 PPT" }));
    fireEvent.click(screen.getByRole("button", { name: /做同款/ }));
    expect(ta().value).not.toBe(first);
    expect(ta().value.length).toBeGreaterThan(30);
  });

  it("store 的 pendingInput 会填入输入框", () => {
    seed();
    render(<ChatPanel />);
    act(() => {
      useChatStore.setState({ pendingInput: { text: "来自模板的提示词", nonce: 1 } });
    });
    expect(ta().value).toBe("来自模板的提示词");
  });

  it("nonce 变化才会重新填入", () => {
    seed();
    render(<ChatPanel />);
    act(() => {
      useChatStore.setState({ pendingInput: { text: "第一次", nonce: 1 } });
    });
    type("我改过了");
    act(() => {
      useChatStore.setState({ pendingInput: { text: "第一次", nonce: 1 } });
    });
    expect(ta().value).toBe("我改过了");
    act(() => {
      useChatStore.setState({ pendingInput: { text: "第二次", nonce: 2 } });
    });
    expect(ta().value).toBe("第二次");
  });
});

/* ─────────────── 提示词参数叠加 ─────────────── */

describe("ChatPanel 提示词参数", () => {
  it("渲染语气/长度/受众三组参数", () => {
    seed({ mode: "docs" });
    render(<ChatPanel />);
    expect(screen.getByRole("button", { name: "专业" })).toBeDefined();
    expect(screen.getByRole("button", { name: "简短" })).toBeDefined();
    expect(screen.getByRole("button", { name: "小白" })).toBeDefined();
  });

  it("点击参数把约束追加到输入", () => {
    seed({ mode: "docs" });
    render(<ChatPanel />);
    type("写一篇稿子");
    fireEvent.click(screen.getByRole("button", { name: "专业" }));
    expect(ta().value).toBe("写一篇稿子\n语气：专业严谨、用词准确。");
  });

  it("再次点击同一参数取消约束", () => {
    seed({ mode: "docs" });
    render(<ChatPanel />);
    type("写一篇稿子");
    fireEvent.click(screen.getByRole("button", { name: "专业" }));
    fireEvent.click(screen.getByRole("button", { name: "专业" }));
    expect(ta().value).toBe("写一篇稿子");
  });

  it("多组参数可以叠加", () => {
    seed({ mode: "docs" });
    render(<ChatPanel />);
    type("写一篇稿子");
    fireEvent.click(screen.getByRole("button", { name: "专业" }));
    fireEvent.click(screen.getByRole("button", { name: "简短" }));
    expect(ta().value).toContain("语气：专业严谨、用词准确。");
    expect(ta().value).toContain("篇幅：简短精炼，控制在 200 字以内。");
  });

  it("空输入时点击参数直接把约束作为正文", () => {
    seed({ mode: "docs" });
    render(<ChatPanel />);
    fireEvent.click(screen.getByRole("button", { name: "给老板" }));
    expect(ta().value).toBe("受众：决策者/管理层，结论先行、突出重点与建议。");
  });

  it("提交时带上叠加的约束", () => {
    const spies = seed({ mode: "docs" });
    render(<ChatPanel />);
    type("写一篇稿子");
    fireEvent.click(screen.getByRole("button", { name: "简短" }));
    pressEnter();
    expect(spies.send).toHaveBeenCalledWith("写一篇稿子\n篇幅：简短精炼，控制在 200 字以内。");
  });
});

/* ─────────────── 斜杠命令 ─────────────── */

describe("ChatPanel 斜杠命令", () => {
  it("输入斜杠弹出命令面板", () => {
    seed();
    render(<ChatPanel />);
    type("/");
    expect(screen.getByText(/快捷命令/)).toBeDefined();
  });

  it("命令面板打开时隐藏参数区", () => {
    seed();
    render(<ChatPanel />);
    type("/");
    expect(screen.queryByRole("button", { name: "专业" })).toBeNull();
  });

  it("按前缀过滤命令", () => {
    seed();
    render(<ChatPanel />);
    type("/tr");
    // C34: 底栏按钮改叫「润色提示词」后与命令名「润色」撞词，
    // 断言范围收敛到斜杠菜单内（菜单标题「快捷命令」所在容器），
    // 只验证菜单自己的过滤逻辑
    const header = screen.getByText(/快捷命令/).closest("div") as HTMLElement;
    const menu = header.parentElement as HTMLElement;
    expect(within(menu).getByRole("button", { name: /翻译/ })).toBeDefined();
    expect(within(menu).queryByRole("button", { name: /润色/ })).toBeNull();
  });

  it("无匹配时给出空态提示", () => {
    seed();
    render(<ChatPanel />);
    type("/zzz");
    expect(screen.getByText("没有匹配的命令")).toBeDefined();
  });

  it("回车执行第一条命令", () => {
    seed();
    render(<ChatPanel />);
    type("/");
    pressEnter();
    expect(useChatStore.getState().conversations[0].mode).toBe("chat");
    expect(ta().value).toBe("");
  });

  it("方向键下移后回车执行第二条命令", () => {
    seed();
    render(<ChatPanel />);
    type("/");
    fireEvent.keyDown(ta(), { key: "ArrowDown" });
    pressEnter();
    expect(useChatStore.getState().conversations[0].mode).toBe("docs");
  });

  it("方向键上移可从首项绕到末项", () => {
    seed();
    render(<ChatPanel />);
    type("/");
    fireEvent.keyDown(ta(), { key: "ArrowUp" });
    pressEnter();
    // 末项是 /table（prompt 类），执行后模板落进输入框而不是切模式
    expect(ta().value).toContain("整理成结构清晰的 Markdown 表格");
  });

  it("prompt 类命令把模板填进输入框", () => {
    const spies = seed();
    render(<ChatPanel />);
    type("/write");
    pressEnter();
    expect(ta().value).toContain("请围绕「」撰写一篇内容完整");
    expect(spies.send).not.toHaveBeenCalled();
  });

  it("命令后带空格时不再当作命令面板输入", () => {
    seed();
    render(<ChatPanel />);
    type("/write 年度总结");
    expect(screen.queryByText(/快捷命令/)).toBeNull();
  });

  it("Escape 关闭面板并清空输入", () => {
    seed();
    render(<ChatPanel />);
    type("/");
    fireEvent.keyDown(ta(), { key: "Escape" });
    expect(ta().value).toBe("");
    expect(screen.queryByText(/快捷命令/)).toBeNull();
  });

  it("鼠标点击命令项直接执行", () => {
    seed();
    render(<ChatPanel />);
    type("/");
    fireEvent.mouseDown(screen.getByRole("button", { name: /绘图/ }));
    expect(useChatStore.getState().conversations[0].mode).toBe("image");
  });

  it("斜杠开头的输入不被参数按钮改写", () => {
    seed({ mode: "docs" });
    render(<ChatPanel />);
    // 带空格后命令面板收起、参数区重新出现，但 applyChip 仍要保护命令输入
    type("/write 年度总结");
    fireEvent.click(screen.getByRole("button", { name: "专业" }));
    expect(ta().value).toBe("/write 年度总结");
  });
});

/* ─────────────── 提示词优化 ─────────────── */

describe("ChatPanel 提示词优化", () => {
  it("未配置密钥时退化为本地结构化模板", async () => {
    seed();
    render(<ChatPanel />);
    type("帮我写年度总结");
    fireEvent.click(screen.getByTitle("优化提示词"));
    await waitFor(() => expect(ta().value).toContain("# 角色"));
    expect(ta().value).toContain("帮我写年度总结");
    expect(ta().value).toContain("请分点、有条理地回答");
  });

  it("结构化模板按当前模式给出输出要求", async () => {
    seed({ mode: "slides" });
    render(<ChatPanel />);
    type("产品发布会");
    fireEvent.click(screen.getByTitle("优化提示词"));
    await waitFor(() => expect(ta().value).toContain("请输出一份幻灯片结构"));
  });

  it("配置了密钥时用模型改写结果覆盖输入", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openai: { apiKey: "sk-test", baseUrl: "" } }));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        // AI14 后按标准 SSE 以空行分帧；用 delta 新事件名
        controller.enqueue(enc.encode('data: {"type":"delta","delta":"改写后的"}\n\n'));
        controller.enqueue(enc.encode('data: {"type":"delta","delta":"提示词"}\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/api/chat")
          ? new Response(body, { status: 200 })
          : new Response(JSON.stringify({ status: {} }), { status: 200 }),
      ),
    );
    seed();
    render(<ChatPanel />);
    type("粗糙需求");
    fireEvent.click(screen.getByTitle("优化提示词"));
    await waitFor(() => expect(ta().value).toBe("改写后的提示词"));
  });

  it("模型改写返回空内容时回退到本地模板", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openai: { apiKey: "sk-test", baseUrl: "" } }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/api/chat")
          ? new Response("", { status: 500 })
          : new Response(JSON.stringify({ status: {} }), { status: 200 }),
      ),
    );
    seed();
    render(<ChatPanel />);
    type("粗糙需求");
    fireEvent.click(screen.getByTitle("优化提示词"));
    await waitFor(() => expect(ta().value).toContain("# 角色"));
  });

  it("优化进行中禁用按钮避免并发", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openai: { apiKey: "sk-test", baseUrl: "" } }));
    // Promise 构造器是同步执行的，因此 release 一定已被赋值；
    // 用 ! 声明而非 `| null`，避免 TS 把闭包外的窄化推成 never
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/chat")) {
          await pending;
          return new Response("", { status: 500 });
        }
        return new Response(JSON.stringify({ status: {} }), { status: 200 });
      }),
    );
    seed();
    render(<ChatPanel />);
    type("粗糙需求");
    fireEvent.click(screen.getByTitle("优化提示词"));
    await waitFor(() =>
      expect((screen.getByTitle("优化提示词") as HTMLButtonElement).disabled).toBe(true),
    );
    release();
    await waitFor(() =>
      expect((screen.getByTitle("优化提示词") as HTMLButtonElement).disabled).toBe(false),
    );
  });
});

/* ─────────────── UX 章补充：编辑重发 / 召回 / token 提示 / 草稿 ─────────────── */

describe("UX9 编辑重发", () => {
  it("最后一条用户消息渲染编辑按钮，非最后条不渲染", () => {
    seed({
      messages: [
        msg({ id: "u1", role: "user", content: "第一条问题" }),
        msg({ id: "a1", role: "assistant", content: "第一条回答" }),
        msg({ id: "u2", role: "user", content: "第二条问题" }),
        msg({ id: "a2", role: "assistant", content: "第二条回答" }),
      ],
    });
    render(<ChatPanel />);
    const editButtons = screen.getAllByTitle("编辑并重新发送");
    expect(editButtons).toHaveLength(1);
  });

  it("点击编辑触发 store.editLastUserMessage", () => {
    const spy = vi.fn();
    act(() => {
      useChatStore.setState({ editLastUserMessage: spy });
    });
    seed({
      messages: [
        msg({ id: "u1", role: "user", content: "问题" }),
        msg({ id: "a1", role: "assistant", content: "回答" }),
      ],
    });
    act(() => {
      useChatStore.setState({ editLastUserMessage: spy });
    });
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle("编辑并重新发送"));
    expect(spy).toHaveBeenCalled();
  });
});

describe("UX10 ↑ 召回", () => {
  it("空输入时按 ↑ 召回最近一条已发送内容", () => {
    const spies = seed();
    render(<ChatPanel />);
    type("第一条");
    fireEvent.click(screen.getByTitle("发送（回车）"));
    expect(ta().value).toBe("");
    fireEvent.keyDown(ta(), { key: "ArrowUp" });
    expect(ta().value).toBe("第一条");
  });

  it("连续按 ↑ 逐级往前召回", () => {
    seed();
    render(<ChatPanel />);
    type("甲");
    fireEvent.click(screen.getByTitle("发送（回车）"));
    type("乙");
    fireEvent.click(screen.getByTitle("发送（回车）"));
    fireEvent.keyDown(ta(), { key: "ArrowUp" });
    expect(ta().value).toBe("乙");
    fireEvent.keyDown(ta(), { key: "ArrowUp" });
    expect(ta().value).toBe("甲");
  });

  it("斜杠菜单激活时 ↑ 归菜单导航不召回", () => {
    seed();
    render(<ChatPanel />);
    fireEvent.change(ta(), { target: { value: "/" } });
    fireEvent.keyDown(ta(), { key: "ArrowUp" });
    // 没有已发送内容被召回（输入仍是斜杠触发词）
    expect(ta().value).toBe("/");
  });
});

describe("UX11 草稿按会话保存", () => {
  it("输入内容写入会话专属草稿键，清空后移除", () => {
    seed();
    render(<ChatPanel />);
    type("没写完的话");
    expect(localStorage.getItem("opencanvas.draft.c1")).toBe(JSON.stringify("没写完的话"));
    type("");
    expect(localStorage.getItem("opencanvas.draft.c1")).toBeNull();
  });

  it("切换会话恢复各自的草稿", () => {
    localStorage.setItem("opencanvas.draft.c1", JSON.stringify("c1 的草稿"));
    const c2 = makeConvo({ id: "c2", title: "会话二" });
    act(() => {
      useChatStore.setState({ conversations: [c2], activeId: "c2" });
    });
    render(<ChatPanel />);
    expect(ta().value).toBe("");
    // 切回 c1
    act(() => {
      useChatStore.setState({ activeId: "c1" });
    });
    expect(ta().value).toBe("c1 的草稿");
  });
});

describe("UX12 token 估算提示", () => {
  it("输入内容后显示字数与 token 估算", () => {
    seed();
    render(<ChatPanel />);
    type("你好世界");
    expect(screen.getByText(/4 字 · 约 \d+ tokens/)).toBeDefined();
  });

  it("空输入不显示估算", () => {
    seed();
    render(<ChatPanel />);
    expect(screen.queryByText(/tokens/)).toBeNull();
  });
});
