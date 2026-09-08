import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RS 章领域层测试（原先 research 模块零专属测试）：
 *  - normalizeUrl / domainOf / mergeSources / domainCounts（RS9 去重合并）
 *  - buildQueries 深度轮次（RS5）
 *  - systemPromptFor 语言（RS8，经 synthesizeFromSources 间接验证）
 *  - reportFromText 原文兜底（RS6）
 *  - runResearch demo 路径带 stage 进度（RS1）、检索全空回示例报告
 *  - synthesizeFromSources 解析失败保留原文（RS4 共用综述段）
 *
 * 网关侧用 vi.mock 打桩：engine 只依赖 streamChatCompletion 一个入口。
 */

vi.mock("@/lib/gateway", () => ({
  streamChatCompletion: vi.fn(),
}));

import { streamChatCompletion } from "@/lib/gateway";
import {
  domainCounts,
  domainOf,
  mergeSources,
  normalizeUrl,
  runResearch,
  synthesizeFromSources,
} from "./engine";
import { buildSampleReport } from "./sample-report";
import type { ResearchSource } from "./types";

const src = (over: Partial<ResearchSource>): ResearchSource => ({
  title: "默认标题",
  url: "https://example.com/a",
  snippet: "默认摘要",
  ...over,
});

beforeEach(() => {
  vi.mocked(streamChatCompletion).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RS9 normalizeUrl", () => {
  it("去协议、www、尾斜杠与锚点", () => {
    expect(normalizeUrl("https://www.example.com/a/")).toBe("example.com/a");
    expect(normalizeUrl("http://example.com/a/#section")).toBe("example.com/a");
    expect(normalizeUrl("https://example.com/a")).toBe("example.com/a");
  });

  it("不同协议与 www 前缀归一到同一键", () => {
    expect(normalizeUrl("http://www.a.com/x")).toBe(normalizeUrl("https://a.com/x/"));
  });

  it("非法 URL 原样返回（不抛错）", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });
});

describe("RS9 domainOf", () => {
  it("取归一化域名", () => {
    expect(domainOf("https://www.news.example.com/a?b=1")).toBe("news.example.com");
  });

  it("非法 URL 返回空串", () => {
    expect(domainOf("")).toBe("");
  });
});

describe("RS9 mergeSources", () => {
  it("同 URL 多轮命中合并：保留最长摘要与最高分", () => {
    const merged = mergeSources([
      src({ url: "https://a.com/x", snippet: "短", score: 0.4 }),
      src({ url: "https://www.a.com/x/", snippet: "这是更长的摘要内容", score: 0.9 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].snippet).toBe("这是更长的摘要内容");
    expect(merged[0].score).toBe(0.9);
  });

  it("无分值合并后保持 undefined（不被 0 污染）", () => {
    const merged = mergeSources([
      src({ url: "https://a.com/x" }),
      src({ url: "https://a.com/x", snippet: "另一个更长的摘要" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].score).toBeUndefined();
    expect(merged[0].snippet).toBe("另一个更长的摘要");
  });

  it("补齐缺失 domain 字段", () => {
    const merged = mergeSources([src({ url: "https://www.a.com/x", domain: undefined })]);
    expect(merged[0].domain).toBe("a.com");
  });

  it("空 url 条目被丢弃", () => {
    expect(mergeSources([src({ url: "" })])).toHaveLength(0);
  });

  it("有分值的排前面，无分值的保持原序在后", () => {
    const merged = mergeSources([
      src({ url: "https://a.com/no-score" }),
      src({ url: "https://b.com/scored", score: 0.3 }),
    ]);
    expect(merged[0].url).toBe("https://b.com/scored");
    expect(merged[1].url).toBe("https://a.com/no-score");
  });
});

describe("RS9 domainCounts", () => {
  it("按域名聚合计数，缺 domain 字段的现场推导", () => {
    const counts = domainCounts([
      src({ url: "https://a.com/1", domain: "a.com" }),
      src({ url: "https://a.com/2" }),
      src({ url: "https://b.com/1" }),
    ]);
    expect(counts).toEqual({ "a.com": 2, "b.com": 1 });
  });

  it("非法 URL 不进统计", () => {
    expect(domainCounts([src({ url: "" })])).toEqual({});
  });
});

describe("RS5 深度检索轮次（经 runResearch 真实路径验证）", () => {
  it("quick 1 轮 / standard 3 轮 / deep 5 轮", async () => {
    const searches: string[][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        // 每路检索都返回同一条来源，避免混入其它变量
        const q = JSON.parse(String(init?.body)).query as string;
        searches.push([q]);
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      })
    );
    vi.mocked(streamChatCompletion).mockImplementation(async () => ({}) as never);
    try {
      await runResearch("主题", {
        model: "demo",
        tavilyKey: "k",
        depth: "quick",
        language: "zh",
        onProgress: () => {},
      });
      await runResearch("主题", {
        model: "demo",
        tavilyKey: "k",
        depth: "standard",
        language: "zh",
        onProgress: () => {},
      });
      await runResearch("主题", {
        model: "demo",
        tavilyKey: "k",
        depth: "deep",
        language: "zh",
        onProgress: () => {},
      });
      // 三种深度分别发 1 / 3 / 5 路检索（结果为空回示例报告，不触网关）
      expect(searches).toHaveLength(1 + 3 + 5);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("RS1 demo 模式进度（无 Tavily 密钥）", () => {
  it("四阶段按序播报并带 stage，返回示例报告", async () => {
    const stages: Array<string | undefined> = [];
    const report = await runResearch("测试主题", {
      model: "demo",
      onProgress: (p) => stages.push(p.stage),
    });
    expect(stages).toEqual(["plan", "search", "read", "write"]);
    expect(report.demo).toBe(true);
    expect(report.topic).toBe("测试主题");
    expect(report.partial).toBeUndefined();
    expect(streamChatCompletion).not.toHaveBeenCalled();
  });

  it("真实检索全空时回示例报告而非伪造空报告", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }))
    );
    vi.mocked(streamChatCompletion).mockImplementation(async () => ({}) as never);
    try {
      const report = await runResearch("主题", {
        model: "demo",
        tavilyKey: "k",
        onProgress: () => {},
      });
      expect(report.demo).toBe(true);
      expect(streamChatCompletion).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("RS4/RS6 synthesizeFromSources", () => {
  const sources = [src({ url: "https://a.com/x", snippet: "关键论据 A" })];

  it("模型输出合法 JSON 时组装结构化报告", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async (_m, _msgs, handlers) => {
      handlers.onToken(
        JSON.stringify({
          summary: "摘要",
          sections: [{ heading: "小节", body: "正文 [1]" }],
          takeaways: ["结论"],
        })
      );
      return {} as never;
    });
    const report = await synthesizeFromSources({
      topic: "主题",
      model: "demo",
      sources,
      onProgress: () => {},
    });
    expect(report.summary).toBe("摘要");
    expect(report.sections[0].heading).toBe("小节");
    expect(report.sources).toEqual(sources);
    expect(report.partial).toBeUndefined();
  });

  it("模型输出非 JSON 时保留原文分节（reportFromText 兜底）", async () => {
    // reportFromText 按空行分块、块内首行做标题——标题与正文之间不能有空行
    const raw = "## 标题甲\n第一段内容。\n\n## 标题乙\n第二段内容。";
    vi.mocked(streamChatCompletion).mockImplementation(async (_m, _msgs, handlers) => {
      handlers.onToken(raw);
      return {} as never;
    });
    const report = await synthesizeFromSources({
      topic: "主题",
      model: "demo",
      sources,
      onProgress: () => {},
    });
    expect(report.sections.map((s) => s.heading)).toEqual(["标题甲", "标题乙"]);
    // 兜底不是 partial：模型真的输出了内容，只是没按结构化格式
    expect(report.partial).toBeFalsy();
  });

  it("JSON 合法但 sections 全空且无 summary 时同样走原文兜底", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async (_m, _msgs, handlers) => {
      handlers.onToken('{"sections": [], "takeaways": []}');
      return {} as never;
    });
    const report = await synthesizeFromSources({
      topic: "主题",
      model: "demo",
      sources,
      onProgress: () => {},
    });
    expect(report.sections.length).toBeGreaterThan(0);
    expect(report.summary).toContain("sections");
  });

  it("RS8: system prompt 按输出语言改写（ja 不含中文小节提示）", async () => {
    let seenSystem = "";
    vi.mocked(streamChatCompletion).mockImplementation(async (_m, messages, handlers) => {
      seenSystem = messages[0]?.content ?? "";
      handlers.onToken(JSON.stringify({ summary: "s", sections: [], takeaways: [] }));
      return {} as never;
    });
    await synthesizeFromSources({
      topic: "主题",
      model: "demo",
      sources,
      language: "ja",
      onProgress: () => {},
    });
    expect(seenSystem).toContain("日本語");
    expect(seenSystem).not.toContain("背景与规模");
  });

  it("中断信号透传给网关（AbortSignal 透传链）", async () => {
    const controller = new AbortController();
    const passed: Array<AbortSignal | undefined> = [];
    // signal 挂在 handlers（第 3 参）上——网关的统一中断入口
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_m, _msgs, handlers) => {
        passed.push(handlers.signal ?? undefined);
        handlers.onToken(JSON.stringify({ summary: "s", sections: [], takeaways: [] }));
        return {} as never;
      }
    );
    await synthesizeFromSources({
      topic: "主题",
      model: "demo",
      sources,
      onProgress: () => {},
      signal: controller.signal,
    });
    expect(passed[0]).toBe(controller.signal);
  });
});

describe("RS6 综述失败保留检索来源（runResearch 真实链路）", () => {
  it("网关抛错时返回 partial 报告而非整体失败", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                title: "真实来源",
                url: "https://real.com/report",
                content: "这是真实检索到的摘要内容，足够长。",
                score: 0.7,
              },
            ],
          }),
          { status: 200 }
        )
      )
    );
    vi.mocked(streamChatCompletion).mockRejectedValue(new Error("网络断开"));
    try {
      const progresses: string[] = [];
      const report = await runResearch("主题", {
        model: "demo",
        tavilyKey: "k",
        onProgress: (p) => progresses.push(p.message),
      });
      expect(report.partial).toBe(true);
      expect(report.sources).toHaveLength(1);
      expect(report.sources[0].url).toBe("https://real.com/report");
      expect(report.sections.length).toBeGreaterThan(0);
      expect(progresses.some((m) => m.includes("已保留检索来源"))).toBe(true);
      expect(streamChatCompletion).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("单路检索失败被静默吞掉，其余来源照常综述", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        // 第一路（quick=1 跮首轮）抛网络错误，其余路返回一条来源
        if (call === 1) throw new Error("search down");
        return new Response(
          JSON.stringify({
            results: [{ title: "来源", url: "https://real.com/x", content: "真实摘要。", score: 0.6 }],
          }),
          { status: 200 }
        );
      })
    );
    vi.mocked(streamChatCompletion).mockImplementation(async (_m, _msgs, handlers) => {
      handlers.onToken(JSON.stringify({ summary: "摘要", sections: [], takeaways: [] }));
      return {} as never;
    });
    try {
      const report = await runResearch("主题", {
        model: "demo",
        tavilyKey: "k",
        depth: "standard",
        onProgress: () => {},
      });
      // 3 路检索里 1 路失败，剩余 2 路各 1 条 → 综述成功，不是 partial
      expect(report.demo).toBeUndefined();
      expect(report.partial).toBeUndefined();
      expect(report.sources.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});