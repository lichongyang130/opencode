"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Copy,
  FileDown,
  Film,
  ImagePlus,
  Loader2,
  Music,
  Plus,
  Presentation,
  RefreshCw,
  Sheet,
  Trash2,
} from "lucide-react";
import type { Storyboard, StoryboardShot } from "@/lib/video/types";
import { durationWarning, formatDuration, totalDuration } from "@/lib/video/types";
import { downloadStoryboardCsv, downloadStoryboardMarkdown } from "@/lib/video/export";
import { storyboardToDeck } from "@/lib/video/to-deck";
import { useChatStore } from "@/lib/store/chat";
import { cn } from "@/lib/utils";

/**
 * 分镜工作台（V4/V5/V6/V9）。
 * - V4：卡片式分镜列表，字段就地编辑、增删复制、上下移动（HTML5 拖拽排序的等价按钮版，
 *   触屏与键盘都可用；拖拽因 jsdom 不支持 DragEvent，测试策略选了按钮方案）
 * - V5：每镜「生成画面」→ shot.imageUrl
 * - V6：每镜「转语音」→ shot.audioUrl；无密钥时后端 400、toast 说明
 * - V9：头部实时汇总总时长，偏离目标 ±20% 给出提醒条
 */

const TRANSITIONS: { id: StoryboardShot["transition"]; label: string }[] = [
  { id: "cut", label: "硬切" },
  { id: "fade", label: "淡入淡出" },
  { id: "dissolve", label: "叠化" },
  { id: "wipe", label: "擦除" },
  { id: "zoom", label: "缩放" },
];

function ShotCard({
  shot,
  index,
  busyImage,
}: {
  shot: StoryboardShot;
  index: number;
  busyImage: boolean;
}) {
  const { patchShot, deleteShot, duplicateShot, moveShot, generateShotImage, generateShotAudio } =
    useChatStore();
  const [editing, setEditing] = useState(false);

  const field = (label: string, key: keyof StoryboardShot, textarea = false) =>
    editing ? (
      <label className="block">
        <span className="text-[10.5px] font-medium text-stone-400">{label}</span>
        {textarea ? (
          <textarea
            value={String(shot[key] ?? "")}
            onChange={(e) => patchShot(shot.id, { [key]: e.target.value })}
            rows={2}
            className="mt-0.5 w-full resize-none rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[12.5px] text-stone-700 focus:border-brand-300 focus:outline-none"
          />
        ) : (
          <input
            value={String(shot[key] ?? "")}
            onChange={(e) => patchShot(shot.id, { [key]: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[12.5px] text-stone-700 focus:border-brand-300 focus:outline-none"
          />
        )}
      </label>
    ) : (
      <div className="text-[12.5px] leading-relaxed text-stone-700">
        {shot[key] ? (
          <span>
            <span className="text-[10.5px] font-medium text-stone-400">{label} </span>
            {String(shot[key])}
          </span>
        ) : null}
      </div>
    );

  return (
    <article className="rounded-xl border border-stone-200/80 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-[11px] font-semibold text-white">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-stone-800">{shot.scene}</div>
            <div className="text-[10.5px] text-stone-400">
              {shot.durationSec}s · {TRANSITIONS.find((t) => t.id === shot.transition)?.label}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button title="上移" onClick={() => moveShot(shot.id, -1)} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button title="下移" onClick={() => moveShot(shot.id, 1)} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button title="复制镜头" onClick={() => duplicateShot(shot.id)} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button title="删除镜头" onClick={() => deleteShot(shot.id)} className="rounded-md p-1 text-stone-400 hover:bg-red-50 hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {field("画面", "visual", true)}
        {field("旁白", "narration", true)}
        {field("字幕", "subtitle")}
        {editing && (
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-[10.5px] font-medium text-stone-400">时长（秒）</span>
              <input
                type="number"
                min={1}
                max={60}
                value={shot.durationSec}
                onChange={(e) =>
                  patchShot(shot.id, {
                    durationSec: Math.min(60, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
                className="mt-0.5 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[12.5px] text-stone-700 focus:border-brand-300 focus:outline-none"
              />
            </label>
            <label className="flex-1">
              <span className="text-[10.5px] font-medium text-stone-400">转场</span>
              <select
                value={shot.transition}
                onChange={(e) => patchShot(shot.id, { transition: e.target.value as StoryboardShot["transition"] })}
                className="mt-0.5 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[12.5px] text-stone-700 focus:border-brand-300 focus:outline-none"
              >
                {TRANSITIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {shot.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shot.imageUrl}
          alt={shot.visual}
          className="mt-2 aspect-video w-full rounded-lg border border-stone-100 object-cover"
        />
      )}
      {shot.audioUrl && (
        <audio controls src={shot.audioUrl} className="mt-2 w-full" preload="none" />
      )}

      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={() => setEditing(!editing)}
          className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11.5px] text-stone-600 hover:border-brand-300 hover:text-brand-600"
        >
          {editing ? "完成" : "编辑"}
        </button>
        <button
          title={shot.imagePrompt ? `生图提示词：${shot.imagePrompt}` : "无提示词时用画面描述生图"}
          onClick={() => void generateShotImage(shot.id)}
          disabled={busyImage}
          className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-[11.5px] text-stone-600 hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
        >
          {busyImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
          生成画面
        </button>
        {shot.narration && (
          <button
            onClick={() => void generateShotAudio(shot.id)}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-[11.5px] text-stone-600 hover:border-brand-300 hover:text-brand-600"
          >
            <AudioLines className="h-3 w-3" />
            转语音
          </button>
        )}
      </div>
    </article>
  );
}

export function StoryboardView({ storyboard }: { storyboard: Storyboard }) {
  const { addShot, send, sending } = useChatStore();
  // 生图的进行态由 patchShot 写入的 imageUrl 空串表达（占位 spinner），无独立 state
  const busyImageId = storyboard.shots.find((s) => s.imageUrl === "")?.id ?? null;

  const total = totalDuration(storyboard);
  const warning = durationWarning(storyboard);

  const handleExportPpt = async () => {
    // V8：复用 slides 导出链路 —— 把分镜转成 deck 后借 exportDeck 走同一条 PPTX 通道。
    // 直接调 /api/slides/export，绕过 exportDeck（它读的是 convo.deck）。
    const deck = storyboardToDeck(storyboard);
    const res = await fetch("/api/slides/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(storyboard.title || "storyboard").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60)}.pptx`;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="border-b border-stone-200 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{storyboard.title}</div>
            <div className="text-xs text-stone-400">
              {storyboard.shots.length} 镜 · 总时长 {formatDuration(total)}
              {storyboard.targetSec ? ` / 目标 ${formatDuration(storyboard.targetSec)}` : ""}
              {storyboard.style ? ` · ${storyboard.style}` : ""}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => void send(`重新生成分镜：${storyboard.title}`)}
              disabled={sending}
              className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:border-brand-300 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" /> 重新生成
            </button>
            <button
              onClick={handleExportPpt}
              className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:border-brand-300"
              title="分镜转 PPT（故事板样片）"
            >
              <Presentation className="h-3.5 w-3.5" /> 转 PPT
            </button>
          </div>
        </div>
        {/* V9：总时长偏离提醒 */}
        {warning && (
          <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-700">
            ⏱ {warning}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5">
          <button
            onClick={addShot}
            className="flex items-center gap-1 rounded-lg bg-stone-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-stone-700"
          >
            <Plus className="h-3.5 w-3.5" /> 添加镜头
          </button>
          <button
            onClick={() => downloadStoryboardMarkdown(storyboard)}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:border-brand-300"
          >
            <FileDown className="h-3.5 w-3.5" /> 导出脚本
          </button>
          <button
            onClick={() => downloadStoryboardCsv(storyboard)}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:border-brand-300"
          >
            <Sheet className="h-3.5 w-3.5" /> 拍摄清单
          </button>
        </div>
      </div>

      {/* 分镜卡片列表 */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {storyboard.shots.map((shot, i) => (
          <ShotCard key={shot.id} shot={shot} index={i} busyImage={busyImageId === shot.id} />
        ))}
        {storyboard.shots.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-stone-400">
            <Film className="h-8 w-8" />
            <p className="text-sm">还没有镜头，点上方「添加镜头」开始</p>
          </div>
        )}
      </div>
    </div>
  );
}