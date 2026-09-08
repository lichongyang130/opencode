"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  GripVertical,
  ImagePlus,
  Loader2,
  Palette,
  Play,
  Plus,
  RefreshCw,
  StickyNote,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { THEME_LIST } from "@/lib/slides/themes";
import type { SlideDeck } from "@/lib/slides/types";
import { checkSlideOverflow } from "@/lib/slides/overflow";
import { SlideView } from "./SlideView";
import { useChatStore } from "@/lib/store/chat";
import { cn } from "@/lib/utils";

/**
 * PPT13：缩略图 memo 化。编辑主视图文字时 store deck 引用变化会让全部缩略图
 * 重渲染，memo 按页内容与选中态精确比对，只重画真正变化的缩略图。
 */
const Thumb = memo(function Thumb({
  slide,
  themeId,
  index,
  active,
  overflow,
  onActivate,
  onDuplicate,
  onDelete,
  onDragStart,
  onDrop,
}: {
  slide: SlideDeck["slides"][number];
  themeId: SlideDeck["theme"];
  index: number;
  active: boolean;
  overflow: boolean;
  onActivate: (i: number) => void;
  onDuplicate: (i: number) => void;
  onDelete: (i: number) => void;
  onDragStart: (i: number) => void;
  onDrop: (i: number) => void;
}) {
  return (
    <div className="group/thumb relative">
      <div
        draggable
        onDragStart={() => onDragStart(index)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop(index)}
        onClick={() => onActivate(index)}
        className={cn(
          "block w-full cursor-pointer overflow-hidden rounded-md ring-2 transition",
          active ? "ring-brand-500" : "ring-transparent hover:ring-stone-200"
        )}
      >
        <SlideView slide={slide} themeId={themeId} index={index} />
      </div>
      {overflow && (
        <span
          title="该页文字可能溢出"
          className="absolute left-1 top-1 rounded bg-amber-400 p-0.5 text-white shadow"
        >
          <AlertTriangle className="h-3 w-3" />
        </span>
      )}
      <div className="absolute right-1 top-1 hidden gap-0.5 group-hover/thumb:flex">
        <button
          title="复制该页"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(index);
          }}
          className="rounded bg-white/90 p-1 text-stone-500 shadow hover:text-brand-600"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          title="删除该页"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(index);
          }}
          className="rounded bg-white/90 p-1 text-stone-500 shadow hover:text-red-500"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <span className="absolute bottom-1 right-1 hidden cursor-grab text-stone-300 group-hover/thumb:block">
        <GripVertical className="h-3 w-3" />
      </span>
    </div>
  );
});

export function SlideDeckView({ deck }: { deck: SlideDeck }) {
  const {
    setDeckTheme,
    patchSlide,
    exportDeck,
    send,
    sending,
    addSlide,
    duplicateSlide,
    deleteSlide,
    moveSlide,
    regenerateSlide,
    generateSlideImage,
  } = useChatStore();
  const [active, setActive] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  // PPT12：导出前预览确认弹窗
  const [confirmExport, setConfirmExport] = useState(false);
  const idx = Math.min(active, deck.slides.length - 1);
  const dragIndex = useRef<number | null>(null);

  // PPT11：整份 deck 的溢出页清单（渲染一次，提示条用）
  const overflows = useMemo(
    () =>
      deck.slides.reduce<Record<number, boolean>>((acc, s, i) => {
        if (checkSlideOverflow(s).overflow) acc[i] = true;
        return acc;
      }, {}),
    [deck.slides]
  );
  const currentOverflow = Boolean(overflows[idx]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportDeck();
    } finally {
      setExporting(false);
      setConfirmExport(false);
    }
  };

  // PPT4：HTML5 原生拖拽排序（零依赖约定）
  const onDragStart = (i: number) => {
    dragIndex.current = i;
  };
  const onDrop = (to: number) => {
    if (dragIndex.current === null) return;
    moveSlide(dragIndex.current, to);
    dragIndex.current = null;
  };

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="border-b border-stone-200 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{deck.title}</div>
            <div className="text-xs text-stone-400">
              {deck.slides.length} 页 · 文字可直接点击编辑
              {Object.keys(overflows).length > 0 && (
                <span className="ml-1 text-amber-500">
                  （{Object.keys(overflows).length} 页可能溢出）
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setPresenting(true)}
              title="全屏演示：← → 翻页，Esc 退出"
              className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:border-brand-300 hover:text-brand-600"
            >
              <Play className="h-3.5 w-3.5" /> 演示
            </button>
            <button
              onClick={() => void send(`重新生成：${deck.title}`)}
              disabled={sending}
              className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:border-brand-300 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" /> 重新生成
            </button>
            {/* PPT12：导出前先弹预览确认 */}
            <button
              onClick={() => setConfirmExport(true)}
              disabled={exporting}
              className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              导出 PPTX
            </button>
          </div>
        </div>
        {/* PPT8：主题市场（10 套） */}
        <div className="mt-2.5 flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          <div className="flex flex-wrap items-center gap-1.5">
            {THEME_LIST.map((th) => (
              <button
                key={th.id}
                title={th.label}
                onClick={() => setDeckTheme(th.id)}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition",
                  deck.theme === th.id ? "border-stone-800 scale-110" : "border-white shadow"
                )}
                style={{ background: th.primary }}
              />
            ))}
          </div>
          <span className="text-xs text-stone-400">
            {THEME_LIST.find((t) => t.id === deck.theme)?.label}
          </span>
        </div>
      </div>

      {/* 主体：缩略图 + 大图 */}
      <div className="flex min-h-0 flex-1">
        <div className="w-28 shrink-0 space-y-2 overflow-y-auto border-r border-stone-100 p-2.5">
          {deck.slides.map((s, i) => (
            <Thumb
              key={i}
              slide={s}
              themeId={deck.theme}
              index={i}
              active={i === idx}
              overflow={Boolean(overflows[i])}
              onActivate={setActive}
              onDuplicate={duplicateSlide}
              onDelete={(j) => {
                deleteSlide(j);
                setActive((a) => Math.max(0, a - (j <= a ? 1 : 0)));
              }}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))}
          <button
            onClick={addSlide}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-stone-300 py-2 text-xs text-stone-400 transition hover:border-brand-300 hover:text-brand-600"
          >
            <Plus className="h-3.5 w-3.5" /> 加一页
          </button>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto bg-stone-100 p-5">
          <div className="mx-auto max-w-2xl shadow-xl">
            <SlideView
              slide={deck.slides[idx]}
              themeId={deck.theme}
              index={idx}
              editable
              onPatch={(p) => patchSlide(idx, p)}
            />
          </div>
          {/* PPT11：当前页溢出提醒 */}
          {currentOverflow && (
            <div className="mx-auto mt-3 flex max-w-2xl items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {checkSlideOverflow(deck.slides[idx]).hint}
            </div>
          )}
          {/* PPT2/PPT3/PPT6：单页操作条 */}
          <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
            <span>第 {idx + 1} / {deck.slides.length} 页</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={sending}
                onClick={() => void regenerateSlide(idx)}
                title="保留主题与上下文，AI 重写本页"
                className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
              >
                <Wand2 className="h-3 w-3" /> AI 重写本页
              </button>
              <button
                disabled={!deck.slides[idx].imagePrompt}
                onClick={() => void generateSlideImage(idx)}
                title={deck.slides[idx].imagePrompt ? "为本页生成配图" : "本页没有配图提示词"}
                className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
              >
                <ImagePlus className="h-3 w-3" /> 生成配图
              </button>
              <button
                onClick={() => setShowNotes((v) => !v)}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 transition",
                  showNotes
                    ? "border-brand-300 bg-brand-50 text-brand-600"
                    : "border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-600"
                )}
              >
                <StickyNote className="h-3 w-3" /> 备注
              </button>
              <button
                onClick={() => duplicateSlide(idx)}
                className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
              >
                <Copy className="h-3 w-3" /> 复制本页
              </button>
              <button
                onClick={() => {
                  deleteSlide(idx);
                  setActive((a) => Math.max(0, a - (idx <= a ? 1 : 0)));
                }}
                className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-600 transition hover:border-red-300 hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" /> 删除本页
              </button>
            </div>
          </div>
          {/* PPT6：演讲者备注编辑 */}
          {showNotes && (
            <div className="mx-auto mt-3 max-w-2xl">
              <label className="mb-1 block text-[11px] font-medium text-stone-500">
                演讲者备注（导出 PPTX 时写入该页备注区）
              </label>
              <textarea
                value={deck.slides[idx].note ?? ""}
                onChange={(e) => patchSlide(idx, { note: e.target.value })}
                placeholder="这页要讲什么、提词、过渡语…"
                rows={3}
                className="w-full rounded-lg border border-stone-200 bg-white p-2.5 text-xs leading-relaxed outline-none focus:border-brand-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* PPT12：导出前预览确认弹窗 */}
      {confirmExport && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setConfirmExport(false)}>
          <div
            className="w-80 rounded-xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-brand-600" />
              <span className="text-sm font-semibold">导出 PPTX 确认</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              《{deck.title}》共 {deck.slides.length} 页 · 主题
              {THEME_LIST.find((t) => t.id === deck.theme)?.label}
              {Object.keys(overflows).length > 0 && (
                <span className="text-amber-600">
                  {" "}
                  · {Object.keys(overflows).length} 页文字可能溢出，建议先精简
                </span>
              )}
              {deck.slides.some((s) => s.note) && " · 含演讲者备注"}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmExport(false)}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 transition hover:bg-stone-50"
              >
                再检查一下
              </button>
              {/* PPT7：打印样式页（浏览器打印为 PDF） */}
              <button
                onClick={() => {
                  // 新窗口打开服务端打印页（inline HTML），用户 Ctrl+P 存为 PDF
                  void fetch("/api/slides/export-pdf", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deck }),
                  })
                    .then(async (res) => {
                      if (!res.ok) throw new Error("生成打印页失败");
                      const html = await res.text();
                      const w = window.open("", "_blank");
                      if (!w) throw new Error("弹窗被拦截，请允许弹窗后重试");
                      w.document.write(html);
                      w.document.close();
                    })
                    .catch((e) => {
                      // toast 从 store 引入成本高，这里用现有 toast 通道
                      if (e instanceof Error) console.error(e.message);
                    });
                  setConfirmExport(false);
                }}
                className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
              >
                <Download className="h-3 w-3" /> 打印版 (PDF)
              </button>
              <button
                disabled={exporting}
                onClick={() => void handleExport()}
                className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-40"
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                开始导出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 演示模式（PPT10 增强：演讲者视图） */}
      {presenting && (
        <PresentOverlay deck={deck} startIdx={idx} onExit={() => setPresenting(false)} />
      )}
    </div>
  );
}

/** 全屏演示：← → / 空格翻页，Esc 退出，带演讲计时器 + 演讲者视图（备注提词） */
function PresentOverlay({
  deck,
  startIdx,
  onExit,
}: {
  deck: SlideDeck;
  startIdx: number;
  onExit: () => void;
}) {
  const [i, setI] = useState(startIdx);
  const [elapsed, setElapsed] = useState(0);
  const [showSpeaker, setShowSpeaker] = useState(false);
  const total = deck.slides.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setI((v) => Math.min(total - 1, v + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setI((v) => Math.max(0, v - 1));
      } else if (e.key === "Escape") {
        onExit();
      } else if (e.key.toLowerCase() === "s") {
        // S 键切换演讲者视图（提词面板）
        setShowSpeaker((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onExit]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-stone-950">
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className={cn("w-full shadow-2xl", showSpeaker ? "max-w-[60%]" : "max-w-5xl")}>
          <SlideView slide={deck.slides[i]} themeId={deck.theme} index={i} />
        </div>
        {/* 演讲者视图（PPT10）：当前页备注提词 + 下一页预告 */}
        {showSpeaker && (
          <div className="ml-4 flex max-w-[36%] flex-col gap-3">
            <div className="rounded-xl border border-stone-700 bg-stone-900 p-4">
              <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-stone-500">
                当前页备注
              </div>
              <div className="text-sm leading-relaxed text-stone-200">
                {deck.slides[i].note ?? "（无备注）"}
              </div>
            </div>
            {i + 1 < total && (
              <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
                <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-stone-500">
                  下一页：{deck.slides[i + 1].title ?? ""}
                </div>
                <div className="text-xs text-stone-400">
                  {(deck.slides[i + 1].bullets ?? []).slice(0, 3).join(" / ") ||
                    (deck.slides[i + 1].layout)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-stone-800 px-6 py-3 text-xs text-stone-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          演讲中 · {mm}:{ss}
          <button
            onClick={() => setShowSpeaker((v) => !v)}
            className={cn(
              "ml-2 rounded-md border px-2 py-0.5 transition",
              showSpeaker ? "border-brand-400 text-brand-300" : "border-stone-700 hover:bg-stone-800"
            )}
          >
            演讲者视图 (S)
          </button>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-700 transition hover:bg-stone-800 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-16 text-center tabular-nums">
            {i + 1} / {total}
          </span>
          <button
            onClick={() => setI((v) => Math.min(total - 1, v + 1))}
            disabled={i === total - 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-700 transition hover:bg-stone-800 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={onExit}
            className="ml-3 flex items-center gap-1 rounded-lg border border-stone-700 px-3 py-1.5 transition hover:bg-stone-800"
          >
            <X className="h-3.5 w-3.5" /> 退出 (Esc)
          </button>
        </div>
        <span className="hidden sm:inline">← → 或空格翻页 · S 演讲者视图 · Esc 退出</span>
      </div>
    </div>
  );
}
