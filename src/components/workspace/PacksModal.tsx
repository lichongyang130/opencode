"use client";

import { useState } from "react";
import { X, Package, Loader2, Check, FileText, MessageSquare, Presentation, ImageIcon, Video, Search } from "lucide-react";
import { ASSET_PACKS } from "@/lib/packs";
import { useChatStore } from "@/lib/store/chat";
import type { WorkspaceMode } from "@/lib/store/chat";

const MODE_ICON: Record<WorkspaceMode, typeof MessageSquare> = {
  chat: MessageSquare,
  docs: FileText,
  slides: Presentation,
  image: ImageIcon,
  video: Video,
  research: Search,
};

export function PacksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [packId, setPackId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const runPack = useChatStore((s) => s.runPack);

  if (!open) return null;
  const pack = ASSET_PACKS.find((p) => p.id === packId) ?? null;

  const start = async () => {
    if (!pack || !topic.trim() || running) return;
    setRunning(true);
    onClose();
    try {
      await runPack(pack.id, topic.trim());
    } finally {
      setRunning(false);
      setPackId(null);
      setTopic("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-brand-600" />
            <div>
              <div className="text-sm font-semibold">一键素材包</div>
              <div className="text-xs text-stone-400">一个主题，自动产出整套素材（文档 + 文案 + PPT + 配图）</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!pack ? (
          <div className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">
            {ASSET_PACKS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPackId(p.id)}
                className="group rounded-xl border border-stone-200 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="text-sm font-semibold text-stone-800 group-hover:text-brand-700">{p.label}</span>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-stone-500">{p.desc}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.steps.map((s, i) => {
                    const Icon = MODE_ICON[s.mode];
                    return (
                      <span
                        key={i}
                        className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500"
                      >
                        <Icon className="h-3 w-3" />
                        {s.title}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-y-auto p-5">
            <button onClick={() => setPackId(null)} className="mb-3 text-xs text-stone-400 hover:text-brand-600">
              ← 返回素材包列表
            </button>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">{pack.emoji}</span>
              <div>
                <div className="text-base font-semibold">{pack.label}</div>
                <div className="text-xs text-stone-400">将依次创建 {pack.steps.length} 个任务</div>
              </div>
            </div>
            <div className="mb-4 space-y-2">
              {pack.steps.map((s, i) => {
                const Icon = MODE_ICON[s.mode];
                return (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                      {i + 1}
                    </span>
                    <Icon className="h-4 w-4 text-stone-400" />
                    <span className="text-stone-700">{s.title}</span>
                  </div>
                );
              })}
            </div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">你的主题 / 产品名</label>
            <input
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void start()}
              placeholder="例如：一款面向自由职业者的 AI 记账 App"
              className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
            />
            <button
              onClick={() => void start()}
              disabled={!topic.trim() || running}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 正在生成整套素材…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> 开始生成（{pack.steps.length} 个任务）
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-stone-400">
              任务会逐个出现在左栏历史中，生成期间可切换查看进度
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
