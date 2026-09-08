import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useChatStore as StoreType } from "./chat";

/**
 * RS 章 store 侧行为锁定：
 *  1) runResearch 深度/语言透传 + 分步时间线点亮 + partial 半成品落库（RS1/RS5/RS6/RS8）；
 *  2) rewriteFromSources 走 PUT 且只带勾选来源，新报告覆盖落库（RS4）；
 *  3) askAboutReport 把报告全文（+选区）作为上下文发 /api/chat，答案进对话（RS7）。
 */

type Store = typeof StoreType;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-type": "application/json" } });

/** SSE 流：一次性把帧推完即关流（每帧必须带 \n\n，缺尾换行的帧会滞留在半包缓冲里丢掉） */
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

/** demo 研究报告（含 2 条来源，供 rewriteFromSources 勾选） */
const sampleReport = {
  topic: "测试主题",
  summary: "摘要",
  sections: [{ heading: "小节", body: "正文 [1]" }],
  takeaways: ["结论"],
  sources: [
    { title: "来源一", url: "https://a.com/x", snippet: "内容一" },
    { title: "来源二", url: "https://b.com/y", snippet: "内容二" },
  ],
  createdAt: 1,
};

interface Harness {
  store: Store;
  bodies: Array<{ url: string; method: string; body: any }>;
}

async function harness(fetchHandler: (url: string, init?: RequestInit) => Response | Promise<Response>): Promise<Harness> {
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
      if (url.includes("/api/models")) return json({ status: { openai: true } });
      return fetchHandler(url, init);
    })
  );
  const mod = await import("./chat");
  await mod.useChatStore.getState().hydrate();
  return { store: mod.useChatStore, bodies };
}

const researchSse = (report: unknown, extra: string[] = []) =>
  sseOnce([
    'data: {"type":"status","message":"正在规划研究…","stage":"plan"}\n\n',
    'data: {"type":"status","message":"正在检索…","stage":"search"}\n\n',
    'data: {"type":"status","message":"正在阅读…","stage":"read"}\n\n',
    'data: {"type":"status","message":"正在撰写…","stage":"write"}\n\n',
    ...extra,
    `data: ${JSON.stringify({ type: "done", result: report })}\n\n`,
  ]);

const convoOf = (store: Store) => store.getState().conversations.find((c) => c.id === "c1");

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("RS1/RS5/RS8 runResearch", () => {
  it("深度与语言透传到请求体，分步时间线随 status 点亮，结束后清除", async () => {
    const { store, bodies } = await harness((url) => {
      if (url.includes("/api/research")) return researchSse(sampleReport);
      if (url.includes("archived=all"))
        return json({ conversations: [{ id: "c1", mode: "research", model: "gpt-4o-mini" }] });
      return json({ ok: true });
    });
    await store.getState().runResearch("测试主题", { depth: "deep", language: "en" });

    const req = bodies.find((b) => b.url.includes("/api/research"));
    expect(req?.body.depth).toBe("deep");
    expect(req?.body.language).toBe("en");

    const convo = convoOf(store);
    expect(convo?.researchStatus).toBe("done");
    // 结束后时间线与提示文案都清空（暂态不残留）
    expect(convo?.researchStages).toBeUndefined();
    expect(convo?.researchMessage).toBeUndefined();
    expect(convo?.report?.topic).toBe("测试主题");
    // 报告落库（conversations PATCH 带 report）
    const patch = bodies.find((b) => /\/api\/conversations\/c1$/.test(b.url) && b.body?.report);
    expect(patch?.body.report.topic).toBe("测试主题");
  });

  it("过程中时间线已点亮（在流关闭前抓取）", async () => {
    let captured: Record<string, boolean> | undefined;
    const { store } = await harness((url) => {
      if (url.includes("/api/research")) {
        // 两阶段后即关流（done 前断流）→ 中断收尾分支，验证时间线不会卡死在 loading
        return sseOnce([
          'data: {"type":"status","message":"规划","stage":"plan"}\n\n',
          'data: {"type":"status","message":"检索","stage":"search"}\n\n',
        ]);
      }
      if (url.includes("archived=all"))
        return json({ conversations: [{ id: "c1", mode: "research", model: "gpt-4o-mini" }] });
      return json({ ok: true });
    });
    void store;
    // 流在 done 前关闭 → finalizeStreamText 中断分支收尾，结束后时间线与状态都不会卡死
    await store.getState().runResearch("主题");
    expect(convoOf(store)?.researchStatus).not.toBe("loading");
    expect(convoOf(store)?.researchStages).toBeUndefined();
  });

  it("RS6: partial 报告同样落库且提示「部分完成」", async () => {
    const { store, bodies } = await harness((url) => {
      if (url.includes("/api/research")) return researchSse({ ...sampleReport, partial: true });
      if (url.includes("archived=all"))
        return json({ conversations: [{ id: "c1", mode: "research", model: "gpt-4o-mini" }] });
      return json({ ok: true });
    });
    await store.getState().runResearch("测试主题");
    const convo = convoOf(store);
    expect(convo?.report?.partial).toBe(true);
    const last = convo?.messages.filter((m) => m.role === "assistant").at(-1);
    expect(last?.content).toContain("部分完成");
    const patch = bodies.find((b) => /\/api\/conversations\/c1$/.test(b.url) && b.body?.report);
    expect(patch?.body.report.partial).toBe(true);
  });
});

describe("RS4 rewriteFromSources", () => {
  it("走 PUT 且只带勾选来源，成功后覆盖报告", async () => {
    const { store, bodies } = await harness((url, init) => {
      if (url.includes("/api/research")) {
        // PUT（重写）请求：返回只含来源一的新报告
        if (init?.method === "PUT") return researchSse({ ...sampleReport, sections: [{ heading: "重写", body: "x" }] });
        return researchSse(sampleReport);
      }
      if (url.includes("archived=all"))
        return json({
          conversations: [{ id: "c1", mode: "research", model: "gpt-4o-mini", report: sampleReport }],
        });
      return json({ ok: true });
    });

    await store.getState().rewriteFromSources(["https://a.com/x"]);

    const put = bodies.find((b) => b.url.includes("/api/research") && b.method === "PUT");
    expect(put).toBeTruthy();
    expect(put?.body.topic).toBe("测试主题");
    expect(put?.body.sources).toHaveLength(1);
    expect(put?.body.sources[0].url).toBe("https://a.com/x");

    const convo = convoOf(store);
    expect(convo?.report?.sections[0].heading).toBe("重写");
    expect(convo?.researchStatus).toBe("done");
  });

  it("一个都没勾时提示且不发请求", async () => {
    const { store, bodies } = await harness((url) => {
      if (url.includes("archived=all"))
        return json({
          conversations: [{ id: "c1", mode: "research", model: "gpt-4o-mini", report: sampleReport }],
        });
      return json({ ok: true });
    });
    await store.getState().rewriteFromSources([]);
    expect(bodies.some((b) => b.method === "PUT")).toBe(false);
  });
});

describe("RS7 askAboutReport", () => {
  it("报告全文 + 选区作为上下文发 /api/chat，答案追加到对话", async () => {
    const { store, bodies } = await harness((url) => {
      if (url.includes("/api/chat"))
        return sseOnce(['data: {"type":"delta","delta":"这是答案"}\n\n']);
      if (url.includes("archived=all"))
        return json({
          conversations: [{ id: "c1", mode: "research", model: "gpt-4o-mini", report: sampleReport }],
        });
      return json({ ok: true });
    });

    await store.getState().askAboutReport("数据来源靠谱吗", "正文 [1] 这一段");

    const chat = bodies.find((b) => b.url.includes("/api/chat"));
    expect(chat).toBeTruthy();
    const messages = chat?.body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toContain("正文 [1] 这一段"); // 选区上下文
    expect(messages[1].content).toContain("测试主题"); // 报告全文
    expect(messages[1].content).toContain("数据来源靠谱吗");

    const convo = convoOf(store);
    const msgs = convo?.messages ?? [];
    expect(msgs.at(-2)?.content).toBe("关于报告：数据来源靠谱吗");
    expect(msgs.at(-1)?.content).toContain("这是答案");
    expect(msgs.at(-1)?.streaming).toBeFalsy();
  });

  it("无选区时仅报告全文作上下文", async () => {
    const { store, bodies } = await harness((url) => {
      if (url.includes("/api/chat"))
        return sseOnce(['data: {"type":"delta","delta":"答"}\n\n']);
      if (url.includes("archived=all"))
        return json({
          conversations: [{ id: "c1", mode: "research", model: "gpt-4o-mini", report: sampleReport }],
        });
      return json({ ok: true });
    });
    await store.getState().askAboutReport("总结一下");
    const chat = bodies.find((b) => b.url.includes("/api/chat"));
    const content = (chat?.body.messages as Array<{ content: string }>)[1].content;
    expect(content).not.toContain("正在阅读报告中的这段内容");
    expect(content).toContain("测试主题");
  });
});