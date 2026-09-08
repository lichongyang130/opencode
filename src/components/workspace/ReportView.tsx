"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileOutput,
  FileText,
  Info,
  PenLine,
  Send,
  X,
} from "lucide-react";
import type { ResearchReport, ResearchSource } from "@/lib/research/types";
// 注意从 url.ts 而非 engine.ts 导入：engine 顶层挂着模型网关（node:sqlite 链），
// 客户端组件一引用就会把服务端模块拖进浏览器 bundle，构建直接失败
import { domainOf, domainCounts } from "@/lib/research/url";
import { useChatStore } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { downloadWord } from "@/lib/docs/export";

/** RS3: 来源可信度等级（按 Tavily 相关度得分粗分档；无得分不标） */
function scoreBadge(score?: number): { label: string; cls: string } | null {
  if (typeof score !== "number") return null;
  if (score >= 0.8) return { label: "高相关", cls: "bg-emerald-50 text-emerald-700" };
  if (score >= 0.5) return { label: "中相关", cls: "bg-amber-50 text-amber-700" };
  return { label: "低相关", cls: "bg-stone-100 text-stone-500" };
}

/** 将正文中的 [n] 引用渲染为可点角标：点击跳转到参考来源并高亮 */
function withCitations(text: string) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (m) {
      const n = Number(m[1]);
      return (
        <sup key={i}>
          <button
            onClick={() => {
              const el = document.getElementById(`research-src-${n}`);
              if (!el) return;
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("cite-flash");
              setTimeout(() => el.classList.remove("cite-flash"), 1600);
            }}
            title="查看来源"
            className="mx-0.5 rounded bg-brand-100 px-1 text-[10px] font-medium text-brand-700 transition hover:bg-brand-200"
          >
            {m[1]}
          </button>
        </sup>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export function ReportView({ report }: { report: ResearchReport }) {
  const { reportToSlides, reportToDoc, rewriteFromSources, askAboutReport, sending } = useChatStore();
  const [copied, setCopied] = useState(false);
  // RS4: 勾选态。默认全选——「重写」的典型意图是剔除不可信来源而非全保留
  const [pickedUrls, setPickedUrls] = useState<Set<string>>(() => new Set(report.sources.map((s) => s.url)));
  // RS7: 选区追问。选中正文段落时显示浮动追问条
  const [selection, setSelection] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const askBarRef = useRef<HTMLDivElement | null>(null);

  const toMarkdown = useMemo(
    () => () => {
      const lines = [
        `# ${report.topic}`,
        "",
        report.summary,
        "",
        ...report.sections.flatMap((s) => [`## ${s.heading}`, "", s.body, ""]),
        "## 关键结论",
        "",
        ...report.takeaways.map((t) => `- ${t}`),
        "",
        "## 参考来源",
        "",
        ...report.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`),
      ];
      return lines.join("\n");
    },
    [report]
  );

  // RS9: 同域名来源统计（多来源域名给「信息源集中」提示，辅助判断单一信息源偏差）
  const domains = useMemo(() => domainCounts(report.sources), [report.sources]);
  const concentratedDomains = useMemo(
    () => Object.entries(domains).filter(([, n]) => n >= 2).map(([d]) => d),
    [domains]
  );

  const toggleSource = (url: string) => {
    setPickedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const copyAll = async () => {
    await navigator.clipboard?.writeText(toMarkdown());
    setCopied(true);
    toast("报告已复制（Markdown）", "success");
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([toMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.topic || "research-report"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("已导出 Markdown", "success");
  };

  // RS7: 正文选区 → 浮动追问条。收起选区时同步清追问输入态
  const onBodyUp = () => {
    const sel = window.getSelection?.();
    const text = sel ? sel.toString() : "";
    // 只对报告容器内的选区生效，避免勾选来源文字也弹条
    if (text.trim().length >= 6 && askBarRef.current?.closest(".report-body")?.contains(sel!.anchorNode)) {
      setSelection(text.trim());
    } else if (!text) {
      setSelection(null);
    }
  };

  const submitAsk = async () => {
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    setSelection(null);
    window.getSelection?.()?.removeAllRanges();
    await askAboutReport(q, selection ?? undefined);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">深度研究报告</div>
          <div className="text-xs text-stone-400">
            {report.sections.length} 小节 · {report.sources.length} 个来源
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => void copyAll()}
            title="复制为 Markdown"
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={download}
            title="导出 Markdown"
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          {/* RS11: Word 导出（复用 docs 的 .doc 通道，Word/WPS 均可直接打开） */}
          <button
            onClick={() => {
              downloadWord(report.topic, toMarkdown());
              toast("已导出 Word 文档", "success");
            }}
            title="导出 Word"
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => reportToDoc()}
            disabled={sending}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
          >
            <FileText className="h-3.5 w-3.5" /> 转文档
          </button>
          <button
            onClick={() => void reportToSlides()}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            <FileOutput className="h-3.5 w-3.5" /> 一键转 PPT
          </button>
        </div>
      </div>

      <div className="report-body flex-1 space-y-5 overflow-y-auto p-5" onMouseUp={onBodyUp}>
        {report.demo && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              当前为<b>演示模式</b>：未配置 Tavily 搜索密钥，来源为示例。在「模型设置」填入
              Tavily API Key 后将真实联网检索。
            </span>
          </div>
        )}

        {/* RS6: 综述中断的半成品报告横幅——来源真实可用，可勾选后走「重写」补全 */}
        {report.partial && (
          <div className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-xs text-orange-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              报告<b>部分完成</b>：撰写阶段中断，已保留检索到的来源与原文分析。可在下方勾选来源后点击「基于勾选重写」补全。
            </span>
          </div>
        )}

        <div>
          <h1 className="text-lg font-bold leading-snug">{report.topic}</h1>
          <p className="mt-2 rounded-xl bg-stone-50 p-3 text-sm leading-6 text-stone-700">
            {withCitations(report.summary)}
          </p>
        </div>

        {/* RS10: 分节懒渲染——首屏只渲染前 3 节，剩下挂 content-visibility 让浏览器跳过离屏布局。
            纯 CSS 方案（无需 IntersectionObserver 状态管理），报告 20+ 节时滚动依旧顺滑。 */}
        {report.sections.map((s, i) => (
          <section key={i} style={i >= 3 ? { contentVisibility: "auto", containIntrinsicSize: "auto 160px" } : undefined}>
            <h2 className="mb-1.5 text-sm font-semibold text-stone-800">{s.heading}</h2>
            <p className="whitespace-pre-wrap text-sm leading-7 text-stone-600">{withCitations(s.body)}</p>
          </section>
        ))}

        <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-brand-800">关键结论</h3>
          <ul className="space-y-1.5">
            {report.takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-stone-800">参考来源</h3>
            {/* RS4: 基于勾选来源重写（不做新检索）。全不勾时按钮禁用 */}
            <button
              onClick={() => void rewriteFromSources([...pickedUrls])}
              disabled={sending || pickedUrls.size === 0}
              className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
            >
              <PenLine className="h-3.5 w-3.5" /> 基于勾选重写（{pickedUrls.size}/{report.sources.length}）
            </button>
          </div>
          {concentratedDomains.length > 0 && (
            <p className="mb-2 text-[11px] text-stone-400">
              同一信息源出现多条：{concentratedDomains.join("、")} —— 建议补充其它来源交叉验证。
            </p>
          )}
          <ol className="space-y-1.5">
            {report.sources.map((src, i) => (
              <li
                key={i}
                id={`research-src-${i + 1}`}
                className="flex items-start gap-2 rounded-lg px-1 py-0.5 text-xs"
              >
                <input
                  type="checkbox"
                  checked={pickedUrls.has(src.url)}
                  onChange={() => toggleSource(src.url)}
                  disabled={sending}
                  title="勾选参与重写"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-600"
                />
                {/* RS3: favicon 直接走浏览器端图床（google s2），无需服务端代理 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?domain=${src.domain || domainOf(src.url)}&sz=32`}
                  alt=""
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-sm"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-medium text-brand-700 hover:underline"
                  >
                    <span className="truncate">{src.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-stone-400">{src.domain || domainOf(src.url)}</span>
                    {(() => {
                      const badge = scoreBadge(src.score);
                      return badge ? (
                        <span className={`rounded px-1 py-px text-[10px] ${badge.cls}`}>{badge.label}</span>
                      ) : null;
                    })()}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-stone-400">{src.snippet}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* RS7: 选中段落后的浮动追问条（参照 DOC3 浮动工具条交互） */}
        {selection && !sending && (
          <div
            ref={askBarRef}
            className="sticky bottom-2 z-10 mx-auto flex w-fit max-w-full items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2 py-1.5 shadow-lg"
          >
            <span className="max-w-[100px] truncate px-1 text-[10.5px] text-stone-400">
              已选 {selection.length} 字
            </span>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitAsk();
              }}
              placeholder="针对选中内容追问…"
              className="w-44 rounded-full bg-stone-50 px-2.5 py-1 text-[11px] outline-none placeholder:text-stone-300 focus:bg-stone-100"
            />
            <button
              onClick={() => void submitAsk()}
              disabled={!question.trim()}
              title="发送追问"
              className="rounded-full bg-brand-600 p-1 text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              <Send className="h-3 w-3" />
            </button>
            <button
              onClick={() => setSelection(null)}
              title="取消"
              className="rounded-full p-0.5 text-stone-400 transition hover:text-stone-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
