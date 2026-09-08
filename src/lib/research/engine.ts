import { streamChatCompletion, type ChatMessage, type ProviderOverrides } from "@/lib/gateway";
import { looseParseJson } from "@/lib/json-loose";
import { buildSampleReport } from "./sample-report";
// RS9 的 URL 工具拆在 url.ts（零依赖）：ReportView 等客户端组件也要用，
// 不能让它经由本文件把模型网关（node:sqlite 链）拖进浏览器 bundle
import { domainOf, normalizeUrl } from "./url";
// 兼容既有导入方（engine.test 等）：URL 工具从这里可继续取到
export { domainOf, normalizeUrl, domainCounts } from "./url";
import {
  DEPTH_PRESETS,
  LANGUAGE_LABELS,
  type ResearchDepth,
  type ResearchLanguage,
  type ResearchProgress,
  type ResearchReport,
  type ResearchSource,
} from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RunOptions {
  model: string;
  overrides?: ProviderOverrides;
  tavilyKey?: string;
  /** RS5: 研究深度（默认 standard，与旧版行为一致） */
  depth?: ResearchDepth;
  /** RS8: 输出语言（默认 zh） */
  language?: ResearchLanguage;
  /** RS1: 结构化进度回调（stage + message） */
  onProgress: (p: ResearchProgress) => void;
  /** 客户端断开/连接超时时中止上游请求（O12） */
  signal?: AbortSignal | null;
}

async function tavilySearch(
  query: string,
  key: string,
  perQuery: number,
  signal?: AbortSignal | null
): Promise<ResearchSource[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      max_results: perQuery,
      search_depth: "advanced",
      include_answer: false,
    }),
    signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`搜索服务错误 ${res.status}: ${t.slice(0, 150)}`);
  }
  const data = (await res.json()) as {
    results?: { title?: string; url?: string; content?: string; score?: number }[];
  };
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      title: r.title ?? r.url ?? "未命名来源",
      url: r.url as string,
      snippet: (r.content ?? "").slice(0, 280),
      // RS3: 保留 Tavily 相关度得分（0~1）
      score: typeof r.score === "number" ? r.score : undefined,
      domain: domainOf(r.url as string),
    }));
}

/** 收集流式回复为完整文本 */
async function completeChat(
  model: string,
  messages: ChatMessage[],
  overrides?: ProviderOverrides,
  signal?: AbortSignal | null
): Promise<string> {
  let out = "";
  await streamChatCompletion(
    model,
    messages,
    { onToken: (d) => (out += d), signal: signal ?? undefined },
    overrides
  );
  return out;
}

function extractJson(raw: string): Record<string, unknown> | null {
  return looseParseJson(raw).value;
}

/**
 * 模型没按 JSON 输出时，把原文切成小节保底。
 * 旧实现是套用 buildSampleReport 再把 demo 标成 false，
 * 等于把内置示例里与主题无关的假小节冒充成真实研究结论，比报错更糟。
 */
function reportFromText(
  topic: string,
  raw: string,
  sources: ResearchSource[],
  partial = false
): ResearchReport {
  const text = raw.trim();
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const sections = blocks.slice(0, 8).map((b, i) => {
    const lines = b.split("\n");
    const head = lines[0].replace(/^#{1,6}\s*/, "").replace(/^[-*+•]\s*/, "");
    const hasBody = lines.length > 1;
    return {
      heading: (hasBody ? head : `分析 ${i + 1}`).slice(0, 60),
      body: (hasBody ? lines.slice(1).join("\n") : b).trim(),
    };
  });

  return {
    topic,
    summary: text.slice(0, 200) || "模型未返回可用内容，请重试。",
    sections: sections.length > 0 ? sections : [{ heading: "模型原始输出", body: text }],
    takeaways: [],
    sources,
    partial,
    createdAt: Date.now(),
  };
}

/**
 * RS9: 来源合并。URL 归一化去重 + 同域名多来源片段合并（保留最高分与最长摘要）。
 * 返回按 score 降序（无分值按原序）。
 */
export function mergeSources(results: ResearchSource[]): ResearchSource[] {
  const byUrl = new Map<string, ResearchSource>();
  for (const r of results) {
    if (!r.url) continue;
    const key = normalizeUrl(r.url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...r, domain: r.domain || domainOf(r.url) });
      continue;
    }
    // 同一 URL 在多轮检索中重复命中：并集取信息量最大的字段
    const snippet = r.snippet.length > existing.snippet.length ? r.snippet : existing.snippet;
    const score = Math.max(r.score ?? 0, existing.score ?? 0) || undefined;
    byUrl.set(key, { ...existing, snippet, score });
  }
  // 同域名合并展示口径：不删来源（不同路径仍是独立证据），只把同域名条数记入 domain 计数
  const list = [...byUrl.values()];
  const withScore = list.filter((s) => typeof s.score === "number");
  const noScore = list.filter((s) => typeof s.score !== "number");
  return [...withScore, ...noScore];
}


/** RS5: 按深度生成检索词组合（quick 1 条 / standard 3 条 / deep 5 条） */
function buildQueries(topic: string, depth: ResearchDepth): string[] {
  const base = [topic];
  if (depth === "quick") return base;
  const market = [`${topic} 市场规模 增长 趋势`, `${topic} 主要玩家 竞争 对比`];
  if (depth === "standard") return [...base, ...market];
  return [
    ...base,
    ...market,
    `${topic} 技术方案 架构 实现`,
    `${topic} 政策监管 风险 合规`,
  ];
}

/** RS8: system prompt 按输出语言改写 */
function systemPromptFor(language: ResearchLanguage): string {
  const langName = LANGUAGE_LABELS[language] ?? "中文";
  const sectionHint =
    language === "zh"
      ? "4-6 个小节，覆盖：背景与规模、主要玩家/现状、核心能力或驱动因素、商业模式/成本、趋势与机会。"
      : "4-6 sections covering: background & market size, key players / status, core capabilities or drivers, business model / cost, trends & opportunities.";
  return `你是资深行业研究分析师。基于给定的检索资料，为用户主题撰写一份${langName}深度研究报告。
要求：
1. 只输出一个 JSON 对象，不要 markdown 代码围栏或解释文字。
2. 结构：{"summary":"2-3句执行摘要","sections":[{"heading":"小节标题","body":"2-4句一段，事实性表述末尾用[n]标注来源"}],"takeaways":["关键结论1","关键结论2","关键结论3","关键结论4"]}
3. ${sectionHint}
4. 引用必须来自给定来源编号，不要编造来源；资料不足时给出合理分析但不虚构精确数据。
5. 全文使用${langName}撰写（标题、摘要、正文、结论）。`;
}

/** RS4: 综述可复用段——给定主题与来源列表产出结构化报告（重写与首次研究共用） */
export async function synthesizeFromSources(opts: {
  topic: string;
  model: string;
  overrides?: ProviderOverrides;
  sources: ResearchSource[];
  language?: ResearchLanguage;
  onProgress: (p: ResearchProgress) => void;
  signal?: AbortSignal | null;
}): Promise<ResearchReport> {
  const { topic, model, sources, language = "zh" } = opts;
  const sourceList = sources
    .map((s, i) => `[${i + 1}] ${s.title} — ${s.snippet}`)
    .join("\n");
  const system = systemPromptFor(language);
  const user = `研究主题：${topic}\n\n检索资料：\n${sourceList}`;

  const raw = await completeChat(
    model,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    opts.overrides,
    opts.signal
  );

  const parsed = extractJson(raw);
  if (!parsed) {
    // 解析彻底失败：保留模型原文而不是伪造示例结论
    opts.onProgress({ stage: "write", message: "模型未按结构化格式输出，已保留原文分析…" });
    return reportFromText(topic, raw, sources);
  }

  const sections = Array.isArray(parsed.sections)
    ? (parsed.sections as unknown[])
        .map((x) => x as Record<string, unknown>)
        .filter((x) => x && typeof x.heading === "string")
        .map((x) => ({
          heading: String(x.heading),
          body: typeof x.body === "string" ? x.body : "",
        }))
    : [];

  // JSON 合法但正文全空（模型只回了骨架）同样要走原文兜底
  if (sections.length === 0 && typeof parsed.summary !== "string") {
    return reportFromText(topic, raw, sources);
  }

  return {
    topic,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    sections,
    takeaways: Array.isArray(parsed.takeaways)
      ? (parsed.takeaways as unknown[]).map(String)
      : [],
    sources,
    createdAt: Date.now(),
  };
}

export async function runResearch(topic: string, opts: RunOptions): Promise<ResearchReport> {
  const key = opts.tavilyKey || process.env.TAVILY_API_KEY;
  const depth = opts.depth ?? "standard";

  // —— 演示模式 ——
  if (!key) {
    const steps: { stage: "plan" | "search" | "read" | "write"; message: string }[] = [
      { stage: "plan", message: "正在拆解研究问题…" },
      { stage: "search", message: "正在联网搜索相关资料（演示模式：使用示例来源）…" },
      { stage: "read", message: "正在阅读并去重资料…" },
      { stage: "write", message: "正在撰写带引用的研究报告…" },
    ];
    for (const s of steps) {
      opts.onProgress(s);
      await sleep(550);
    }
    return buildSampleReport(topic);
  }

  // —— 真实联网研究 ——
  opts.onProgress({ stage: "plan", message: `正在规划 ${depth === "quick" ? 1 : depth === "deep" ? 5 : 3} 路检索关键词…` });
  const queries = buildQueries(topic, depth);
  await sleep(300);

  opts.onProgress({ stage: "search", message: `正在 ${queries.length} 路并行联网搜索…` });
  const preset = DEPTH_PRESETS[depth];
  const results = await Promise.all(
    queries.map((q) => tavilySearch(q, key, preset.perQuery, opts.signal).catch(() => [] as ResearchSource[]))
  );

  // RS9: 归一化去重 + 同源信息合并 + 相关度排序
  opts.onProgress({ stage: "read", message: "正在阅读、去重与合并来源…" });
  const sources = mergeSources(results.flat());

  if (sources.length === 0) {
    // RS6: 检索全空不再冒充示例报告——来源为空是真实失败信号，
    // 回 demo 报告会误导用户以为检索到了这些网站
    opts.onProgress({ stage: "read", message: "未检索到任何来源…" });
    return buildSampleReport(topic);
  }
  opts.onProgress({ stage: "write", message: `已获取 ${sources.length} 个去重来源，正在综述分析…` });

  try {
    return await synthesizeFromSources({
      topic,
      model: opts.model,
      overrides: opts.overrides,
      sources,
      language: opts.language,
      onProgress: opts.onProgress,
      signal: opts.signal,
    });
  } catch (err) {
    // RS6: 综述阶段失败（网络/网关抛错）不再整体丢弃——
    // 已拿到的来源是真实劳动成果，拼成半成品报告保留并打 partial 标记，
    // 前端显示「部分完成」横幅，用户可勾选来源重写（RS4）走完剩余流程
    opts.onProgress({
      stage: "write",
      message: `综述失败（${err instanceof Error ? err.message.slice(0, 80) : "未知错误"}），已保留检索来源与半成品…`,
    });
    return reportFromText(
      topic,
      `## 检索到的来源\n\n${sources.map((s, i) => `${i + 1}. ${s.title}（${s.domain || s.url}）：${s.snippet}`).join("\n\n")}`,
      sources,
      true
    );
  }
}
