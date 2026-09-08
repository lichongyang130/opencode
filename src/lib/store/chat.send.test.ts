import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useChatStore as StoreType } from "./chat";

/**
 * send 是全应用最长的一条链路：本地乐观更新 -> SSE 流式拼接 -> 落库。
 * 这里重点钉三件事：
 *  1) patchMessages 在会话中途被删时必须静默跳过（旧版非空断言会崩）；
 *  2) SSE 半包 / 脏行 / error 事件不能中断整条流；
 *  3) 中断与失败都要把 streaming 复位，不能让界面永远转圈。
 */

type Store = typeof StoreType;

/** 手动可控的 SSE 响应，用于精确编排「流到一半发生了什么」 */
function controlledSse(signal?: AbortSignal | null) {
  let push!: (s: string) => void;
  let close!: () => void;
  const stream = new ReadableStream({
    start(c) {
      const enc = new TextEncoder();
      push = (s) => c.enqueue(enc.encode(s));
      close = () => c.close();
      signal?.addEventListener("abort", () =>
        c.error(Object.assign(new Error("aborted"), { name: "AbortError" }))
      );
    },
  });
  return { res: new Response(stream, { status: 200 }), push, close };
}

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface Harness {
  store: Store;
  bodies: Array<{ url: string; method: string; body: unknown }>;
}

/**
 * 起一个已水合的 store；chatHandler 决定 /api/chat 的响应。
 * 其余接口一律返回空成功，避免落库副作用干扰断言。
 */
async function harness(
  chatHandler: (init?: RequestInit) => Response | Promise<Response>,
  convos: Array<Record<string, unknown>> = [{ id: "c1" }]
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
      if (url.includes("archived=all")) return json({ conversations: convos });
      if (url.includes("/api/chat")) return chatHandler(init);
      if (url.includes("/api/models")) return json({ status: {} });
      if (/\/api\/conversations\/[^/]+$/.test(url) && (init?.method ?? "GET") === "GET")
        return json({ messages: [] });
      return json({ ok: true });
    })
  );
  const mod = await import("./chat");
  await mod.useChatStore.getState().hydrate();
  return { store: mod.useChatStore, bodies };
}

const msgsOf = (store: Store, id = "c1") =>
  store.getState().conversations.find((c) => c.id === id)?.messages ?? [];

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("send 基本流程", () => {
  it("流式拼接 token 并在结束后复位 streaming", async () => {
    const { store } = await harness(() =>
      sseOnce([
        'data: {"type":"token","delta":"你"}\n',
        'data: {"type":"token","delta":"好"}\n',
        'data: {"type":"token","delta":"世界"}\n',
      ])
    );
    await store.getState().send("打个招呼");

    const msgs = msgsOf(store);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: "user", content: "打个招呼" });
    expect(msgs[1]).toMatchObject({
      role: "assistant",
      content: "你好世界",
      streaming: false,
      error: false,
    });
    expect(store.getState().sending).toBe(false);
  });

  it("首条消息用输入内容做标题（截断 24 字）", async () => {
    const { store } = await harness(() => sseOnce(['data: {"type":"token","delta":"ok"}\n']));
    const long = "这是一个非常非常长的提问标题需要被截断处理掉多余的部分";
    await store.getState().send(long);

    const convo = store.getState().conversations[0];
    expect(convo.title).toBe(long.slice(0, 24));
    expect(convo.title.length).toBe(24);
  });

  it("第二条消息不再改标题", async () => {
    const { store } = await harness(() => sseOnce(['data: {"type":"token","delta":"ok"}\n']));
    await store.getState().send("第一个问题");
    const first = store.getState().conversations[0].title;
    await store.getState().send("第二个完全不同的问题");
    expect(store.getState().conversations[0].title).toBe(first);
  });

  it("空白输入直接忽略，不发请求", async () => {
    const { store, bodies } = await harness(() => sseOnce([]));
    const before = bodies.length;
    await store.getState().send("   \n\t ");
    expect(bodies.length).toBe(before);
    expect(msgsOf(store)).toHaveLength(0);
  });

  it("发送中再次发送被拒（防重复提交）", async () => {
    const ctl = controlledSse();
    const { store } = await harness(() => ctl.res);
    const first = store.getState().send("第一条");
    await new Promise((r) => setTimeout(r, 5));
    expect(store.getState().sending).toBe(true);
    await store.getState().send("第二条");
    ctl.close();
    await first;
    // 只有第一条被受理
    expect(msgsOf(store).filter((m) => m.role === "user").map((m) => m.content)).toEqual(["第一条"]);
  });

  it("发送前后把用户消息与最终回复各落库一次", async () => {
    const { store, bodies } = await harness(() =>
      sseOnce(['data: {"type":"token","delta":"答案"}\n'])
    );
    await store.getState().send("问题");

    const posted = bodies.filter((b) => b.url.includes("/api/messages") && b.method === "POST");
    expect(posted).toHaveLength(2);
    expect(posted[0].body).toMatchObject({ role: "user", content: "问题", conversationId: "c1" });
    expect(posted[1].body).toMatchObject({ role: "assistant", content: "答案", error: false });
  });
});

describe("send 的 SSE 容错", () => {
  it("跨 chunk 的半包 JSON 能正确重组", async () => {
    const { store } = await harness(() =>
      sseOnce(['data: {"type":"token","del', 'ta":"拼"}\n', 'data: {"type":"token","delta":"好"}\n'])
    );
    await store.getState().send("测试半包");
    expect(msgsOf(store)[1].content).toBe("拼好");
  });

  it("非 data 前缀的行被忽略（心跳注释等）", async () => {
    const { store } = await harness(() =>
      sseOnce([
        ": keep-alive\n",
        "\n",
        'event: ping\ndata: {"type":"token","delta":"A"}\n',
        'data: {"type":"token","delta":"B"}\n',
      ])
    );
    await store.getState().send("测试心跳");
    expect(msgsOf(store)[1].content).toBe("AB");
  });

  it("单行 JSON 损坏时跳过该行，不中断后续 token", async () => {
    const { store } = await harness(() =>
      sseOnce([
        'data: {"type":"token","delta":"前"}\n',
        "data: {坏掉的 json\n",
        'data: {"type":"token","delta":"后"}\n',
      ])
    );
    await store.getState().send("测试脏行");
    expect(msgsOf(store)[1].content).toBe("前后");
    expect(msgsOf(store)[1].error).toBe(false);
  });

  it("未知事件类型被忽略", async () => {
    const { store } = await harness(() =>
      sseOnce([
        'data: {"type":"usage","credits":3}\n',
        'data: {"type":"whatever"}\n',
        'data: {"type":"token","delta":"内容"}\n',
      ])
    );
    await store.getState().send("测试未知事件");
    expect(msgsOf(store)[1].content).toBe("内容");
  });

  it("error 事件覆盖已拼接内容并标记 error", async () => {
    const { store } = await harness(() =>
      sseOnce([
        'data: {"type":"token","delta":"半句"}\n',
        'data: {"type":"error","message":"余额不足"}\n',
      ])
    );
    await store.getState().send("测试错误事件");

    const last = msgsOf(store)[1];
    expect(last.content).toBe("⚠️ 余额不足");
    expect(last.error).toBe(true);
    expect(last.streaming).toBe(false);
  });

  it("完全没有 token 时回复为空串但不报错", async () => {
    const { store } = await harness(() => sseOnce([]));
    await store.getState().send("空响应");
    expect(msgsOf(store)[1]).toMatchObject({ content: "", streaming: false, error: false });
  });
});

describe("send 的失败与中断", () => {
  it("HTTP 非 2xx 时把状态码写进气泡并标记错误", async () => {
    const { store } = await harness(() => json({ error: "x" }, 500));
    await store.getState().send("触发 500");

    const last = msgsOf(store)[1];
    expect(last.content).toContain("请求失败 500");
    expect(last.error).toBe(true);
    expect(store.getState().sending).toBe(false);
  });

  it("fetch 直接抛错时提示网络错误", async () => {
    const { store } = await harness(() => {
      throw new TypeError("Failed to fetch");
    });
    await store.getState().send("断网");

    const last = msgsOf(store)[1];
    expect(last.content).toContain("Failed to fetch");
    expect(last.error).toBe(true);
  });

  it("stopGeneration 保留已生成内容且不标记为错误", async () => {
    let signal: AbortSignal | null | undefined;
    const { store } = await harness((init) => {
      signal = init?.signal;
      return controlledSse(signal).res;
    });
    const p = store.getState().send("讲个长故事");
    await new Promise((r) => setTimeout(r, 5));
    store.getState().stopGeneration();
    await p;

    const last = msgsOf(store)[1];
    expect(last.streaming).toBe(false);
    expect(last.error).toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(store.getState().sending).toBe(false);
  });

  it("中断且一个 token 都没收到时给出兜底文案", async () => {
    const { store } = await harness((init) => controlledSse(init?.signal).res);
    const p = store.getState().send("立刻停止");
    await new Promise((r) => setTimeout(r, 5));
    store.getState().stopGeneration();
    await p;
    expect(msgsOf(store)[1].content).toBe("已停止生成。");
  });

  it("中断已有部分内容时保留该内容", async () => {
    let push!: (s: string) => void;
    const { store } = await harness((init) => {
      const ctl = controlledSse(init?.signal);
      push = ctl.push;
      return ctl.res;
    });
    const p = store.getState().send("边说边停");
    await new Promise((r) => setTimeout(r, 5));
    push('data: {"type":"token","delta":"说到一半"}\n');
    await new Promise((r) => setTimeout(r, 10));
    store.getState().stopGeneration();
    await p;
    expect(msgsOf(store)[1].content).toBe("说到一半");
  });

  it("失败的回复同样落库，刷新后不丢上下文", async () => {
    const { store, bodies } = await harness(() => json({}, 502));
    await store.getState().send("网关错误");

    const posted = bodies.filter((b) => b.url.includes("/api/messages") && b.method === "POST");
    expect(posted).toHaveLength(2);
    expect(posted[1].body).toMatchObject({ role: "assistant", error: true });
  });
});

describe("send 期间会话被删除", () => {
  it("流式过程中删掉当前会话不抛异常（patchMessages 静默跳过）", async () => {
    let push!: (s: string) => void;
    let close!: () => void;
    const { store } = await harness(
      () => {
        const ctl = controlledSse();
        push = ctl.push;
        close = ctl.close;
        return ctl.res;
      },
      [{ id: "c1" }, { id: "c2" }]
    );
    const p = store.getState().send("说点什么");
    await new Promise((r) => setTimeout(r, 5));
    push('data: {"type":"token","delta":"A"}\n');
    await new Promise((r) => setTimeout(r, 5));

    await store.getState().deleteConversation("c1");
    push('data: {"type":"token","delta":"B"}\n');
    close();

    await expect(p).resolves.toBeUndefined();
    expect(store.getState().conversations.map((c) => c.id)).toEqual(["c2"]);
    expect(store.getState().sending).toBe(false);
  });

  it("会话删除后 c2 的消息不会被误写入", async () => {
    let push!: (s: string) => void;
    let close!: () => void;
    const { store } = await harness(
      () => {
        const ctl = controlledSse();
        push = ctl.push;
        close = ctl.close;
        return ctl.res;
      },
      [{ id: "c1" }, { id: "c2" }]
    );
    const p = store.getState().send("提问");
    await new Promise((r) => setTimeout(r, 5));
    await store.getState().deleteConversation("c1");
    push('data: {"type":"token","delta":"漂移内容"}\n');
    close();
    await p;

    expect(msgsOf(store, "c2")).toEqual([]);
  });

  it("批量删除命中当前会话时同样不崩", async () => {
    let close!: () => void;
    const { store } = await harness(
      () => {
        const ctl = controlledSse();
        close = ctl.close;
        return ctl.res;
      },
      [{ id: "c1" }, { id: "c2" }]
    );
    const p = store.getState().send("提问");
    await new Promise((r) => setTimeout(r, 5));
    await store.getState().batchDelete(["c1"]);
    close();
    await expect(p).resolves.toBeUndefined();
  });
});

describe("send 的模式路由", () => {
  it("slides 模式转交 generateSlides", async () => {
    const { store } = await harness(() => sseOnce([]), [{ id: "c1", mode: "slides" }]);
    const spy = vi.fn(async () => {});
    store.setState({ generateSlides: spy });
    await store.getState().send("做一份产品发布 PPT");
    expect(spy).toHaveBeenCalledWith("做一份产品发布 PPT");
    expect(msgsOf(store)).toHaveLength(0);
  });

  it("research 模式转交 runResearch", async () => {
    const { store } = await harness(() => sseOnce([]), [{ id: "c1", mode: "research" }]);
    const spy = vi.fn(async () => {});
    store.setState({ runResearch: spy });
    await store.getState().send("调研新能源市场");
    expect(spy).toHaveBeenCalledWith("调研新能源市场");
  });

  it("docs 模式转交 generateDocs", async () => {
    const { store } = await harness(() => sseOnce([]), [{ id: "c1", mode: "docs" }]);
    const spy = vi.fn(async () => {});
    store.setState({ generateDocs: spy });
    await store.getState().send("写一份周报");
    expect(spy).toHaveBeenCalledWith("写一份周报");
  });

  it("chat / image / video 模式走通用对话（不转交）", async () => {
    for (const mode of ["chat", "image", "video"]) {
      const { store } = await harness(() => sseOnce(['data: {"type":"token","delta":"x"}\n']), [
        { id: "c1", mode },
      ]);
      const slides = vi.fn(async () => {});
      store.setState({ generateSlides: slides });
      await store.getState().send("随便说点");
      expect(slides).not.toHaveBeenCalled();
      expect(msgsOf(store)).toHaveLength(2);
    }
  });
});

describe("send 的请求体构造", () => {
  const bodyOf = (h: Harness) =>
    h.bodies.find((b) => b.url.includes("/api/chat"))?.body as {
      model: string;
      provider?: string;
      messages: Array<{ role: string; content: string }>;
    };

  it("首条 system 消息带上模式提示词", async () => {
    const h = await harness(() => sseOnce([]));
    await h.store.getState().send("你好");
    const body = bodyOf(h);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("全能 AI 助手");
    expect(body.messages[body.messages.length - 1]).toEqual({ role: "user", content: "你好" });
  });

  it("附带历史消息作为上下文", async () => {
    const h = await harness(() => sseOnce(['data: {"type":"token","delta":"回答"}\n']));
    await h.store.getState().send("第一问");
    h.bodies.length = 0;
    await h.store.getState().send("第二问");

    const body = bodyOf(h);
    expect(body.messages.map((m) => m.content)).toEqual([
      expect.stringContaining("全能 AI 助手"),
      "第一问",
      "回答",
      "第二问",
    ]);
  });

  it("深度思考开关追加推理指令", async () => {
    const h = await harness(() => sseOnce([]));
    await h.store.getState().send("难题", { deep: true });
    expect(bodyOf(h).messages[0].content).toContain("深度思考模式");
  });

  it("不开深度思考则不注入该指令", async () => {
    const h = await harness(() => sseOnce([]));
    await h.store.getState().send("普通问题");
    expect(bodyOf(h).messages[0].content).not.toContain("深度思考模式");
  });

  it("附件正文进 system 而不污染用户气泡", async () => {
    const h = await harness(() => sseOnce([]));
    await h.store
      .getState()
      .send("总结这个文件", { attachment: { name: "report.md", content: "季度营收增长 12%" } });

    expect(bodyOf(h).messages[0].content).toContain("report.md");
    expect(bodyOf(h).messages[0].content).toContain("季度营收增长 12%");
    expect(msgsOf(h.store)[0].content).toBe("总结这个文件");
  });

  it("超长附件被截断到 12000 字以内", async () => {
    const h = await harness(() => sseOnce([]));
    await h.store
      .getState()
      .send("总结", { attachment: { name: "big.txt", content: "字".repeat(20000) } });
    const sys = bodyOf(h).messages[0].content;
    expect(sys.match(/字+/)?.[0].length).toBe(12000);
  });

  it("绑定角色时把角色 system prompt 叠加在模式提示词之后", async () => {
    const h = await harness(() => sseOnce([]), [{ id: "c1", personaId: "copywriter" }]);
    await h.store.getState().send("写文案");
    const sys = bodyOf(h).messages[0].content;
    expect(sys).toContain("全能 AI 助手");
    expect(sys).toContain("爆款文案专家");
    expect(sys.indexOf("全能 AI 助手")).toBeLessThan(sys.indexOf("爆款文案专家"));
  });

  it("未知 personaId 不影响发送", async () => {
    const h = await harness(() => sseOnce(['data: {"type":"token","delta":"ok"}\n']), [
      { id: "c1", personaId: "does-not-exist" },
    ]);
    await h.store.getState().send("提问");
    expect(msgsOf(h.store)[1].content).toBe("ok");
  });

  it("使用会话自身的模型与供应商，而非全局默认", async () => {
    const h = await harness(() => sseOnce([]), [
      { id: "c1", model: "qwen-plus", modelProvider: "dashscope" },
    ]);
    await h.store.getState().send("提问");
    expect(bodyOf(h)).toMatchObject({ model: "qwen-plus", provider: "dashscope" });
  });
});

describe("regenerate", () => {
  it("就地重写最后一条 AI 回复而不新增消息", async () => {
    const { store, bodies } = await harness(() =>
      sseOnce(['data: {"type":"token","delta":"新答案"}\n'])
    );
    await store.getState().send("提问");
    const before = msgsOf(store);
    const lastId = before[1].id;

    bodies.length = 0;
    await store.getState().regenerate();

    const after = msgsOf(store);
    expect(after).toHaveLength(2);
    expect(after[1].id).toBe(lastId);
    expect(after[1].content).toBe("新答案");
    // 必须是 PATCH 同一条，不能 POST 新消息堆版本
    expect(bodies.some((b) => b.url.includes("/api/messages") && b.method === "PATCH")).toBe(true);
    expect(bodies.some((b) => b.url.includes("/api/messages") && b.method === "POST")).toBe(false);
  });

  it("重发时不把旧回复带进上下文", async () => {
    const h = await harness(() => sseOnce(['data: {"type":"token","delta":"答"}\n']));
    await h.store.getState().send("问题");
    h.bodies.length = 0;
    await h.store.getState().regenerate();

    const body = h.bodies.find((b) => b.url.includes("/api/chat"))?.body as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(body.messages[1].content).toBe("问题");
  });

  it("最后一条是用户消息时拒绝重新生成", async () => {
    const { store, bodies } = await harness(() => sseOnce([]));
    store.setState({
      conversations: [
        {
          id: "c1",
          title: "t",
          mode: "chat",
          model: "demo",
          messages: [{ id: "m1", role: "user", content: "只有提问" }],
          loaded: true,
          createdAt: Date.now(),
        },
      ],
      activeId: "c1",
    });
    bodies.length = 0;
    await store.getState().regenerate();
    expect(bodies.some((b) => b.url.includes("/api/chat"))).toBe(false);
  });

  it("空会话时不做任何事", async () => {
    const { store, bodies } = await harness(() => sseOnce([]));
    bodies.length = 0;
    await store.getState().regenerate();
    expect(bodies.some((b) => b.url.includes("/api/chat"))).toBe(false);
  });

  it("重发失败时把错误写进原气泡并复位 streaming", async () => {
    vi.resetModules();
    let first = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("archived=all")) return json({ conversations: [{ id: "c1" }] });
        if (url.includes("/api/chat")) {
          if (first) {
            first = false;
            return sseOnce(['data: {"type":"token","delta":"原答案"}\n']);
          }
          return json({}, 500);
        }
        if (/\/api\/conversations\/[^/]+$/.test(url)) return json({ messages: [] });
        return json({ ok: true });
      })
    );
    const { useChatStore } = await import("./chat");
    await useChatStore.getState().hydrate();
    await useChatStore.getState().send("提问");
    await useChatStore.getState().regenerate();

    const last = msgsOf(useChatStore)[1];
    expect(last.content).toContain("请求失败 500");
    expect(last.error).toBe(true);
    expect(last.streaming).toBe(false);
    expect(useChatStore.getState().sending).toBe(false);
  });

  it("发送中不允许重新生成", async () => {
    let close!: () => void;
    const { store } = await harness(() => {
      const ctl = controlledSse();
      close = ctl.close;
      return ctl.res;
    });
    const p = store.getState().send("提问");
    await new Promise((r) => setTimeout(r, 5));
    await store.getState().regenerate();
    expect(msgsOf(store)).toHaveLength(2);
    close();
    await p;
  });
});

describe("editLastUserMessage", () => {
  it("撤回最后一轮问答并把原文填回输入框", async () => {
    const { store, bodies } = await harness(() =>
      sseOnce(['data: {"type":"token","delta":"回答"}\n'])
    );
    await store.getState().send("原始问题");
    bodies.length = 0;
    store.getState().editLastUserMessage();

    expect(msgsOf(store)).toHaveLength(0);
    expect(store.getState().pendingInput?.text).toBe("原始问题");
    // 被撤回的两条都要从服务端删掉
    const deletes = bodies.filter((b) => b.method === "DELETE" && b.url.includes("/api/messages"));
    expect(deletes).toHaveLength(2);
  });

  it("只回退最后一轮，保留更早的历史", async () => {
    const { store } = await harness(() => sseOnce(['data: {"type":"token","delta":"答"}\n']));
    await store.getState().send("第一问");
    await store.getState().send("第二问");
    store.getState().editLastUserMessage();

    expect(msgsOf(store).map((m) => m.content)).toEqual(["第一问", "答"]);
    expect(store.getState().pendingInput?.text).toBe("第二问");
  });

  it("nonce 递增以便 UI 重复消费同一段文本", async () => {
    const { store } = await harness(() => sseOnce(['data: {"type":"token","delta":"答"}\n']));
    await store.getState().send("问题一");
    store.getState().editLastUserMessage();
    const n1 = store.getState().pendingInput!.nonce;
    await store.getState().send("问题二");
    store.getState().editLastUserMessage();
    expect(store.getState().pendingInput!.nonce).toBeGreaterThan(n1);
  });

  it("没有消息时不做任何事", async () => {
    const { store } = await harness(() => sseOnce([]));
    store.getState().editLastUserMessage();
    expect(store.getState().pendingInput).toBeNull();
  });

  it("全是 AI 消息（无用户消息）时不做任何事", async () => {
    const { store } = await harness(() => sseOnce([]));
    store.setState({
      conversations: [
        {
          id: "c1",
          title: "t",
          mode: "chat",
          model: "demo",
          messages: [{ id: "m1", role: "assistant", content: "开场白" }],
          loaded: true,
          createdAt: Date.now(),
        },
      ],
      activeId: "c1",
    });
    store.getState().editLastUserMessage();
    expect(store.getState().pendingInput).toBeNull();
    expect(msgsOf(store)).toHaveLength(1);
  });
});