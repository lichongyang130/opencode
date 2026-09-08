"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ListOrdered, Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import type { SlideOutline } from "@/lib/slides/types";
import { useChatStore } from "@/lib/store/chat";
import { cn } from "@/lib/utils";

const LAYOUT_LABELS: Record<string, string> = {
  cover: "封面",
  toc: "目录",
  content: "要点",
  twoCol: "双栏",
  stats: "数字",
  timeline: "时间轴",
  compare: "对比",
  process: "流程",
  quote: "金句",
  team: "团队",
  end: "结束",
};

/**
 * PPT1 大纲确认编辑器：展示 AI 规划的页面骨架，
 * 支持改标题/删页/加页/上下移动，确认后调 confirmOutline 生成成稿。
 */
export function OutlineEditor({ outline }: { outline: SlideOutline }) {
  const {
    confirmOutline,
    patchOutlinePage,
    addOutlinePage,
    deleteOutlinePage,
    moveOutlinePage,
    sending,
  } = useChatStore();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await confirmOutline();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-semibold">大纲 · {outline.title}</span>
          <span className="text-xs text-stone-400">{outline.pages.length} 页</span>
        </div>
        <p className="mt-0.5 text-[11px] text-stone-400">
          可编辑每页标题、调整顺序，确认后 AI 按此结构生成完整内容
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {outline.pages.map((pg, i) => (
          <div
            key={i}
            className="group/row flex items-center gap-2 rounded-lg border border-stone-100 bg-white px-2.5 py-2 shadow-sm"
          >
            <span className="w-5 shrink-0 text-center text-xs text-stone-400">{i + 1}</span>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                pg.layout === "cover" || pg.layout === "end"
                  ? "bg-stone-800 text-white"
                  : "bg-brand-50 text-brand-600"
              )}
            >
              {LAYOUT_LABELS[pg.layout] ?? pg.layout}
            </span>
            <input
              value={pg.title}
              onChange={(e) => patchOutlinePage(i, { title: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
            <div className="hidden shrink-0 gap-0.5 group-hover/row:flex">
              <button
                title="上移"
                disabled={i === 0}
                onClick={() => moveOutlinePage(i, -1)}
                className="rounded p-1 text-stone-400 hover:text-brand-600 disabled:opacity-30"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                title="下移"
                disabled={i === outline.pages.length - 1}
                onClick={() => moveOutlinePage(i, 1)}
                className="rounded p-1 text-stone-400 hover:text-brand-600 disabled:opacity-30"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
              <button
                title="删除该页"
                disabled={outline.pages.length <= 2}
                onClick={() => deleteOutlinePage(i)}
                className="rounded p-1 text-stone-400 hover:text-red-500 disabled:opacity-30"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => addOutlinePage(outline.pages.length - 2)}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-stone-300 py-2 text-xs text-stone-400 transition hover:border-brand-300 hover:text-brand-600"
        >
          <Plus className="h-3.5 w-3.5" /> 加一页
        </button>
      </div>

      <div className="border-t border-stone-200 p-3">
        <button
          disabled={sending || confirming}
          onClick={() => void handleConfirm()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          {sending || confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          确认大纲，生成完整 PPT
        </button>
        <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[10.5px] text-stone-400">
          <Check className="h-3 w-3" /> 成稿通常需要 20~60 秒，期间可继续编辑大纲之外的会话
        </p>
      </div>
    </div>
  );
}