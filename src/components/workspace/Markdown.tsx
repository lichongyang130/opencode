"use client";

import React, { useEffect, useState } from "react";

/**
 * 轻量 Markdown 渲染（无第三方依赖）：
 * 支持代码围栏、标题、有序/无序列表、加粗、行内代码、引用、换行。
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // 按 **bold** 和 `code` 切分
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code key={`${keyPrefix}-c${i}`} className="rounded bg-stone-100 px-1 py-0.5 text-[0.85em] text-brand-700">
          {tok.slice(1, -1)}
        </code>
      );
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function downloadCsv(name: string, rows: string[][]) {
  const esc = (c: string) => `"${c.replace(/"/g, '""')}"`;
  const csv = "\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 表格块：渲染 Markdown 表格并支持一键导出 CSV */
function TableBlock({ header, rows }: { header: string[]; rows: string[][] }) {
  const exportCsv = () => {
    downloadCsv("table", [header, ...rows]);
  };
  return (
    <div className="group/table relative my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {header.map((h, j) => (
              <th key={j} className="border-b border-stone-300 px-2.5 py-1.5 text-left font-semibold text-stone-700">
                {renderInline(h, `th-${j}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="odd:bg-stone-50/60">
              {header.map((_, ci) => (
                <td key={ci} className="border-b border-stone-200 px-2.5 py-1.5 align-top text-stone-600">
                  {renderInline(r[ci] ?? "", `td-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={exportCsv}
        title="导出为 CSV"
        className="absolute right-1 top-1 hidden rounded-md border border-stone-200 bg-white px-1.5 py-0.5 text-[10.5px] text-stone-500 shadow-sm transition hover:border-orange-300 hover:text-orange-600 group-hover/table:block"
      >
        导出 CSV
      </button>
    </div>
  );
}

/** Mermaid 图表：动态加载 mermaid 库渲染，失败时回退显示源码 */
function MermaidView({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
        const id = `mmd-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(rendered);
          setErr("");
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message.split("\n")[0] : "渲染失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (err) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] text-amber-700">
        Mermaid 语法有误（{err}），以下为源码：
        <pre className="mt-1 whitespace-pre-wrap text-[11px] text-stone-500">{code}</pre>
      </div>
    );
  }
  if (!svg) {
    return <div className="my-2 animate-pulse rounded-lg bg-stone-100 p-4 text-center text-[11.5px] text-stone-400">Mermaid 渲染中…</div>;
  }
  return (
    <div
      className="my-2 overflow-x-auto rounded-lg border border-stone-100 bg-white p-3 [&_svg]:mx-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Mermaid 图表：异步渲染，失败时回退显示原文 */
function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState("");
  const rawId = React.useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
        const { svg: rendered } = await mermaid.render(`mmd${id}${Math.floor(Math.random() * 1e4)}`, code);
        if (!cancelled) {
          setSvg(rendered);
          setErr("");
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "图表渲染失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (err) {
    return (
      <div className="my-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-[11px] font-medium text-amber-700">⚠️ Mermaid 渲染失败：{err}</p>
        <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap text-xs text-stone-600">{code}</pre>
      </div>
    );
  }
  if (!svg) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-stone-100 bg-stone-50 p-3 text-xs text-stone-400">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-orange-400" />
        正在渲染图表…
      </div>
    );
  }
  return (
    <div
      className="my-2 overflow-x-auto rounded-lg border border-stone-100 bg-white p-3 [&_svg]:mx-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** 代码块：语言标签 + 一键复制 */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    navigator.clipboard?.writeText(code).then(done, () => {
      // 剪贴板 API 被拒时退化为 execCommand
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        done();
      } catch {}
      ta.remove();
    });
  };
  if (lang === "mermaid") {
    return (
      <div className="group/code my-2 overflow-hidden rounded-lg border border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-3 py-1">
          <span className="text-[10px] uppercase tracking-wide text-stone-400">mermaid 图表</span>
          <button
            onClick={copy}
            className="rounded px-1.5 py-0.5 text-[10.5px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            {copied ? "已复制 ✓" : "复制源码"}
          </button>
        </div>
        <div className="bg-white p-2">
          <MermaidView code={code} />
        </div>
      </div>
    );
  }
  return (
    <div className="group/code my-2 overflow-hidden rounded-lg bg-stone-900">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1">
        <span className="text-[10px] uppercase tracking-wide text-stone-400">{lang || "code"}</span>
        <button
          onClick={copy}
          className="rounded px-1.5 py-0.5 text-[10.5px] text-stone-400 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? "已复制 ✓" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-5 text-stone-100">
        <code>{code.replace(/\n$/, "")}</code>
      </pre>
    </div>
  );
}

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^[\s|:-]+$/;

function parseRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

export function Markdown({ content }: { content: string }) {
  const blocks = content.split(/```(\w*)\n?/);
  // blocks: [text, lang, code, text, lang, code...]
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    if (i % 2 === 0) {
      const text = blocks[i];
      const lines = text.split("\n");
      let list: { ordered: boolean; items: string[] } | null = null;
      const flushList = (key: string) => {
        if (!list) return;
        const items = list.items;
        nodes.push(
          list.ordered ? (
            <ol key={key} className="my-1 list-decimal space-y-0.5 pl-5">
              {items.map((it, j) => <li key={j}>{renderInline(it, `${key}-${j}`)}</li>)}
            </ol>
          ) : (
            <ul key={key} className="my-1 list-disc space-y-0.5 pl-5">
              {items.map((it, j) => <li key={j}>{renderInline(it, `${key}-${j}`)}</li>)}
            </ul>
          )
        );
        list = null;
      };

      for (let li = 0; li < lines.length; li += 1) {
        const raw = lines[li];
        const line = raw;

        // Markdown 表格：当前行是 |...| 且下一行是分隔行 |---|
        if (
          TABLE_ROW.test(line) &&
          li + 1 < lines.length &&
          TABLE_SEP.test(lines[li + 1]) &&
          lines[li + 1].includes("-")
        ) {
          const header = parseRow(line);
          const tRows: string[][] = [];
          let tj = li + 2;
          while (tj < lines.length && TABLE_ROW.test(lines[tj])) {
            tRows.push(parseRow(lines[tj]));
            tj += 1;
          }
          // 表格前先结算未闭合的列表，否则列表节点会被推到表格之后而顺序错乱
          flushList(`l-${i}-${li}`);
          nodes.push(<TableBlock key={`t-${i}-${li}`} header={header} rows={tRows} />);
          li = tj - 1;
          continue;
        }
        const ul = line.match(/^\s*[-*•]\s+(.*)$/);
        const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        const quote = line.match(/^>\s?(.*)$/);

        if (ul) {
          if (!list || list.ordered) {
            flushList(`l-${i}-${li}`);
            list = { ordered: false, items: [] };
          }
          list.items.push(ul[1]);
        } else if (ol) {
          if (!list || !list.ordered) {
            flushList(`l-${i}-${li}`);
            list = { ordered: true, items: [] };
          }
          list.items.push(ol[1]);
        } else {
          flushList(`l-${i}-${li}`);
          if (heading) {
            const level = heading[1].length;
            const cls =
              level <= 1 ? "text-base font-bold mt-2 mb-1" : level === 2 ? "text-sm font-bold mt-2 mb-1" : "text-[13px] font-semibold mt-1.5";
            nodes.push(<div key={`h-${i}-${li}`} className={cls} data-heading={heading[2]}>{renderInline(heading[2], `h-${i}-${li}`)}</div>);
          } else if (quote) {
            nodes.push(
              <div key={`q-${i}-${li}`} className="my-1 border-l-2 border-stone-300 pl-2 text-stone-500">
                {renderInline(quote[1], `q-${i}-${li}`)}
              </div>
            );
          } else if (line.trim()) {
            nodes.push(<p key={`p-${i}-${li}`} className="my-0.5">{renderInline(line, `p-${i}-${li}`)}</p>);
          }
        }
      }
      // 收尾 flush 必须在行循环之外：写在循环体内会让每一行都结算一次，
      // 连续的列表项被拆成一串单项 <ul>，且 key 恒为 `l-{i}-end` 而重复。
      flushList(`l-${i}-end`);
    } else {
      // 代码块：i 是语言，i+1 是代码。
      // split(/```(\w*)\n?/) 会把闭合围栏也捕获为一个空语言项，
      // 因此一个围栏块占 [lang, code, ""] 三格，需跳两格落回偶数（正文）位。
      const code = blocks[i + 1] ?? "";
      if (blocks[i].toLowerCase() === "mermaid") {
        nodes.push(<MermaidBlock key={`mmd-${i}`} code={code.replace(/\n$/, "")} />);
      } else {
        nodes.push(<CodeBlock key={`code-${i}`} code={code.replace(/\n$/, "")} lang={blocks[i]} />);
      }
      i += 2;
    }
  }

  return <div className="space-y-0.5">{nodes}</div>;
}
