"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Columns2,
  Copy,
  Download,
  Eye,
  FileText,
  History,
  ImagePlus,
  Loader2,
  Pencil,
  Pilcrow,
  Table2,
  Wand2,
  X,
} from "lucide-react";
import { useChatStore, type UIDoc } from "@/lib/store/chat";
import { Markdown } from "./Markdown";
import { downloadMarkdown, downloadWord, downloadHtml } from "@/lib/docs/export";
import { parseOutline } from "@/lib/docs/outline";
import { countWords, readingMinutes } from "@/lib/docs/stats";
import { DOC_SKELETONS } from "@/lib/docs/templates";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

type Mode = "edit" | "preview" | "split";

const AI_OPS: { id: "polish" | "expand" | "shorten" | "fix"; label: string }[] = [
  { id: "polish", label: "润色" },
  { id: "expand", label: "扩写" },
  { id: "shorten", label: "精简" },
  { id: "fix", label: "纠错" },
];

/** DOC9: 2×3 起始表格骨架 */
const TABLE_SNIPPET = `\n| 列一 | 列二 | 列三 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n`;

export function DocView({ doc }: { doc: UIDoc }) {
  const {
    setDoc,
    aiDoc,
    docBusy,
    docSaveState,
    retryDocSave,
    insertToDoc,
    listDocVersions,
    restoreDocVersion,
    saveDocVersion,
  } = useChatStore();
  const [mode, setMode] = useState<Mode>("split");
  const [copied, setCopied] = useState(false);
  const [showOutline, setShowOutline] = useState(true);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; title: string; content: string; createdAt: number }>>([]);
  const [imgPrompt, setImgPrompt] = useState("");
  const [showImgForm, setShowImgForm] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [selection, setSelection] = useState<{ text: string; start: number; end: number } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const onChange = (content: string) => {
    setDoc({ ...doc, content });
  };

  const outline = useMemo(() => parseOutline(doc.content), [doc.content]);
  const stats = useMemo(
    () => ({ words: countWords(doc.content), minutes: readingMinutes(doc.content) }),
    [doc.content]
  );

  const copy = async () => {
    await navigator.clipboard?.writeText(doc.content);
    setCopied(true);
    toast("已复制 Markdown", "success");
    setTimeout(() => setCopied(false), 1500);
  };

  // DOC3: textarea 选区变化时记录选中文本（非选中态清空浮动条数据）
  const syncSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (end > start) {
      setSelection({ text: doc.content.slice(start, end), start, end });
    } else {
      setSelection(null);
    }
  };

  // DOC4: 大纲点击 → 计算行偏移映射到字符偏移 → 滚动编辑器到目标行
  const jumpToLine = (line: number) => {
    const el = editorRef.current;
    if (!el) return;
    const lines = doc.content.split("\n");
    const charAt = lines.slice(0, line).reduce((n, l) => n + l.length + 1, 0);
    el.focus();
    el.setSelectionRange(charAt, charAt + (lines[line]?.length ?? 0));
    // 分屏/预览时无法滚 textarea 行（textarea 本身整块滚动），切回编辑态保证可见
    if (mode !== "edit") setMode("split");
  };

  const insertAtCursor = (snippet: string) => {
    const el = editorRef.current;
    const cursor = el ? el.selectionStart : undefined;
    insertToDoc(snippet, cursor);
  };

  // DOC8: 复用 images 通道生图，成功后把 Markdown 图片语法插入光标处
  const generateImage = async () => {
    const p = imgPrompt.trim();
    if (!p) return;
    setImgBusy(true);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "demo-image", prompt: p, size: "1024x1024" }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "生成失败");
      insertAtCursor(`\n![${p}](${data.url})\n`);
      toast("配图已插入光标处", "success");
      setShowImgForm(false);
      setImgPrompt("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "生成失败", "error");
    } finally {
      setImgBusy(false);
    }
  };

  const openVersions = async () => {
    setShowVersions(true);
    setVersions(await listDocVersions());
  };

  const restore = async (id: string) => {
    await restoreDocVersion(id);
    setVersions(await listDocVersions());
    setShowVersions(false);
    toast("已回滚", "success");
  };

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="border-b border-stone-200 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-brand-600" />
            <input
              value={doc.title}
              onChange={(e) => setDoc({ ...doc, title: e.target.value })}
              className="min-w-0 flex-1 truncate bg-transparent text-sm font-semibold outline-none"
            />
            <span className="shrink-0 text-[11px] text-stone-400">
              {docBusy ? (
                <span className="flex items-center gap-1 text-brand-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> AI 处理中
                </span>
              ) : docSaveState === "saving" ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> 保存中…
                </span>
              ) : docSaveState === "error" ? (
                <button
                  onClick={() => void retryDocSave()}
                  className="flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-red-500 transition hover:bg-red-100"
                >
                  保存失败，点击重试
                </button>
              ) : docSaveState === "saved" ? (
                "已保存"
              ) : (
                ""
              )}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center rounded-lg border border-stone-200 p-0.5">
              {(
                [
                  { m: "edit", icon: <Pencil className="h-3.5 w-3.5" />, t: "Markdown 源码" },
                  { m: "split", icon: <Columns2 className="h-3.5 w-3.5" />, t: "富文本（源码 + 预览双向同步，不丢格式）" },
                  { m: "preview", icon: <Eye className="h-3.5 w-3.5" />, t: "纯预览" },
                ] as const
              ).map((b) => (
                <button
                  key={b.m}
                  title={b.t}
                  onClick={() => setMode(b.m)}
                  className={cn(
                    "rounded-md p-1.5 transition",
                    mode === b.m ? "bg-brand-600 text-white" : "text-stone-500 hover:bg-stone-100"
                  )}
                >
                  {b.icon}
                </button>
              ))}
            </div>
            {/* DOC4: 大纲侧栏开关 */}
            <button
              title="大纲"
              onClick={() => setShowOutline((v) => !v)}
              className={cn(
                "rounded-lg border p-1.5 transition",
                showOutline
                  ? "border-brand-300 bg-brand-50 text-brand-600"
                  : "border-stone-200 text-stone-500 hover:border-brand-300 hover:text-brand-600"
              )}
            >
              <Pilcrow className="h-3.5 w-3.5" />
            </button>
            {/* DOC5: 版本历史 */}
            <button
              title="版本历史"
              onClick={() => void openVersions()}
              className="rounded-lg border border-stone-200 p-1.5 text-stone-500 transition hover:border-brand-300 hover:text-brand-600"
            >
              <History className="h-3.5 w-3.5" />
            </button>
            <button
              title="复制"
              onClick={() => void copy()}
              className="rounded-lg border border-stone-200 p-1.5 text-stone-500 transition hover:border-brand-300 hover:text-brand-600"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {/* DOC6: 三格式导出 */}
            <button
              title="导出 HTML"
              onClick={() => {
                downloadHtml(doc.title, doc.content);
                toast("已导出 HTML", "success");
              }}
              className="flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
            >
              <Download className="h-3.5 w-3.5" /> HTML
            </button>
            <button
              title="导出 Word"
              onClick={() => {
                downloadWord(doc.title, doc.content);
                toast("已导出 Word", "success");
              }}
              className="flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
            >
              <Download className="h-3.5 w-3.5" /> Word
            </button>
            <button
              title="导出 Markdown"
              onClick={() => {
                downloadMarkdown(doc.title, doc.content);
                toast("已导出 Markdown", "success");
              }}
              className="rounded-lg bg-brand-600 p-1.5 text-white transition hover:bg-brand-700"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* AI 操作条 + 插入工具 */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Wand2 className="h-3.5 w-3.5 text-brand-500" />
          <button
            disabled={docBusy}
            onClick={() => void aiDoc("continue")}
            className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] text-brand-700 transition hover:bg-brand-100 disabled:opacity-40"
          >
            AI 续写
          </button>
          {AI_OPS.map((op) => (
            <button
              key={op.id}
              disabled={docBusy}
              onClick={() => void aiDoc(op.id, selection?.text)}
              className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] text-brand-700 transition hover:bg-brand-100 disabled:opacity-40"
            >
              AI {op.label}
              {selection ? "（选区）" : ""}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-stone-200" />
          {/* DOC8: 插入配图 */}
          <button
            title="AI 配图"
            onClick={() => setShowImgForm((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-stone-200 px-2.5 py-0.5 text-[11px] text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
          >
            <ImagePlus className="h-3 w-3" /> 配图
          </button>
          {/* DOC9: 插入表格 */}
          <button
            title="插入表格"
            onClick={() => insertAtCursor(TABLE_SNIPPET)}
            className="flex items-center gap-1 rounded-full border border-stone-200 px-2.5 py-0.5 text-[11px] text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
          >
            <Table2 className="h-3 w-3" /> 表格
          </button>
          <span className="ml-auto shrink-0 text-[11px] text-stone-400">
            {/* DOC7: 字数与阅读时长 */}
            {stats.words} 字 · 约 {stats.minutes || "<1"} 分钟
          </span>
        </div>
        {/* DOC8: 配图生成小表单 */}
        {showImgForm && (
          <div className="mt-2 flex items-center gap-1.5">
            <input
              value={imgPrompt}
              onChange={(e) => setImgPrompt(e.target.value)}
              placeholder="描述想要的配图，如：数据趋势插图"
              className="flex-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs outline-none focus:border-brand-400"
            />
            <button
              disabled={imgBusy || !imgPrompt.trim()}
              onClick={() => void generateImage()}
              className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              {imgBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null} 生成并插入
            </button>
          </div>
        )}
      </div>

      {/* 主体：大纲侧栏 + 编辑/预览 */}
      <div className="flex min-h-0 flex-1">
        {/* DOC4: 大纲侧栏 */}
        {showOutline && (
          <aside className="hidden w-44 shrink-0 overflow-y-auto border-r border-stone-100 px-2 py-3 lg:block">
            <div className="mb-2 px-1 text-[10.5px] font-medium uppercase tracking-wider text-stone-400">
              大纲
            </div>
            {outline.length === 0 ? (
              <div className="px-1 text-[11px] text-stone-400">用 # 标题生成目录</div>
            ) : (
              outline.map((item, i) => (
                <button
                  key={`${item.line}-${i}`}
                  onClick={() => jumpToLine(item.line)}
                  style={{ paddingLeft: 6 + (item.level - 1) * 10 }}
                  className="block w-full truncate rounded-md px-1 py-1 text-left text-[11.5px] text-stone-600 transition hover:bg-stone-100 hover:text-brand-600"
                >
                  {item.text || "（空标题）"}
                </button>
              ))
            )}
          </aside>
        )}
        {(mode === "edit" || mode === "split") && (
          <div className="relative min-h-0 flex-1">
            <textarea
              ref={editorRef}
              value={doc.content}
              onChange={(e) => onChange(e.target.value)}

              onSelect={syncSelection}
              onMouseUp={syncSelection}
              onKeyUp={(e) => {
                if (e.shiftKey || e.key === "ArrowLeft" || e.key === "ArrowRight") syncSelection();
              }}
              placeholder="用 Markdown 写文档，或在左侧对话里让 AI 生成…"
              className={cn(
                "h-full min-h-0 w-full flex-1 resize-none border-stone-100 p-5 font-mono text-[13px] leading-7 outline-none",
                mode === "split" ? "border-r" : ""
              )}
            />
            {/* DOC3: 选中段落浮动 AI 工具条（改写只作用于选区，不覆盖全文） */}
            {selection && !docBusy && (
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-stone-200 bg-white px-1.5 py-1 shadow-lg">
                <span className="max-w-[120px] truncate px-1.5 text-[10.5px] text-stone-400">
                  已选 {selection.text.length} 字
                </span>
                {(
                  [
                    { op: "polish" as const, label: "润色" },
                    { op: "expand" as const, label: "扩写" },
                    { op: "shorten" as const, label: "精简" },
                  ]
                ).map((b) => (
                  <button
                    key={b.op}
                    onClick={() => void aiDoc(b.op, selection.text)}
                    className="rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] text-brand-700 transition hover:bg-brand-100"
                  >
                    {b.label}
                  </button>
                ))}
                <button
                  onClick={() => setSelection(null)}
                  title="取消选区"
                  className="ml-0.5 rounded-full p-0.5 text-stone-400 transition hover:text-stone-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
        {(mode === "preview" || mode === "split") && (
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <article className="prose-doc text-sm leading-7 text-stone-700">
              <Markdown content={doc.content || "*暂无内容*"} />
            </article>
          </div>
        )}
      </div>

      {/* DOC5: 版本历史抽屉 */}
      {showVersions && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setShowVersions(false)}>
          <div
            className="flex h-full w-80 flex-col border-l border-stone-200 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <span className="text-sm font-semibold">版本历史</span>
              <button onClick={() => setShowVersions(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* 先存一份当前版本再回滚（后悔药），这里手动触发立即快照 */}
            <button
              onClick={() => {
                void saveDocVersion();
                toast("已保存当前版本", "success");
              }}
              className="mx-4 my-3 rounded-lg bg-brand-600 px-3 py-1.5 text-xs text-white transition hover:bg-brand-700"
            >
              手动存为版本
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {versions.length === 0 ? (
                <div className="mt-6 text-center text-xs text-stone-400">
                  暂无历史版本。文档每 30 分钟自动留一份快照，也可手动保存。
                </div>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="mb-2 rounded-lg border border-stone-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-stone-400">
                        {new Date(v.createdAt).toLocaleString("zh-CN")}
                      </span>
                      <button
                        onClick={() => void restore(v.id)}
                        className="rounded-md border border-stone-200 px-2 py-0.5 text-[10.5px] text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
                      >
                        回滚到此
                      </button>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-stone-600">{v.title}</div>
                    <div className="mt-1 line-clamp-3 text-[11px] text-stone-400">{v.content.slice(0, 120)}…</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
