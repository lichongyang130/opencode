"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clapperboard,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  MessageSquare,
  Package,
  Presentation,
  Search,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useChatStore, MODE_LABELS, type WorkspaceMode } from "@/lib/store/chat";
import { CAPABILITIES } from "@/lib/capabilities";
import { TEMPLATES } from "@/lib/templates";
import { TemplatesModal } from "./TemplatesModal";
import { PacksModal } from "./PacksModal";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

/** R5：竖栏主图标 = 六种创作能力。点图标新建对应模式的会话（进入该能力对话框）。 */
const PRIMARY_MODES: { mode: WorkspaceMode; label: string; icon: LucideIcon }[] = [
  { mode: "chat", label: "AI 对话", icon: MessageSquare },
  { mode: "docs", label: "文档", icon: FileText },
  { mode: "slides", label: "PPT", icon: Presentation },
  { mode: "image", label: "图片", icon: ImageIcon },
  { mode: "research", label: "深度研究", icon: Search },
  { mode: "video", label: "视频", icon: Clapperboard },
];

export function Sidebar() {
  const router = useRouter();
  const { conversations, activeId, newConversation, selectConversation } = useChatStore();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [packsOpen, setPacksOpen] = useState(false);
  /** 「能力目录」浮层（聚合原五大分类的全部子能力） */
  const [catOpen, setCatOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);

  const activeConvo = conversations.find((c) => c.id === activeId);
  const activeMode: WorkspaceMode = activeConvo?.mode ?? "chat";

  /** 首次进入工作台：图标轨纯图标无文字，给一次逐项说明引导（5 秒内可关） */
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    const KEY = "opencanvas.rail.guide.v1";
    try {
      if (localStorage.getItem(KEY)) return;
      localStorage.setItem(KEY, "1");
      setShowGuide(true);
      const t = setTimeout(() => setShowGuide(false), 6000);
      return () => clearTimeout(t);
    } catch {
      return;
    }
  }, []);

  // 点击空白处 / Esc 关闭能力目录浮层
  useEffect(() => {
    if (!catOpen) return;
    const onDown = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCatOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [catOpen]);

  const startMode = async (mode: WorkspaceMode) => {
    const id = await newConversation(mode);
    void selectConversation(id);
    setCatOpen(false);
    toast(`已新建「${MODE_LABELS[mode]}」会话`, "success");
  };

  return (
    <>
      {/* R5 纯图标竖栏 48px */}
      <aside
        ref={railRef}
        className="relative z-40 flex w-12 shrink-0 flex-col items-center border-r border-[#e8ddca] bg-[#f5efe4] py-2"
      >
        {/* 品牌：点击回首页 */}
        <button
          onClick={() => router.push("/")}
          title="OpenCanvas · 返回首页"
          aria-label="OpenCanvas · 返回首页"
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
        >
          O
        </button>

        {/* 六种创作能力：随当前会话模式高亮 */}
        <div className="flex flex-col items-center gap-0.5">
          {PRIMARY_MODES.map(({ mode, label, icon: Icon }) => {
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                title={`${label}（新建${MODE_LABELS[mode]}会话）`}
                aria-label={`新建${label}会话`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => void startMode(mode)}
                className={cn(
                  "group relative flex h-10 w-10 items-center justify-center rounded-xl transition",
                  isActive ? "bg-orange-100 text-orange-600" : "text-stone-400 hover:bg-orange-50 hover:text-orange-600"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {isActive && (
                  <span className="absolute -left-0.5 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-orange-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* 分隔线 */}
        <div className="mx-2 my-2 h-px w-6 bg-stone-200" />

        {/* 次级入口：能力目录 / 模板库 / 素材包（保留原有功能，收进三个图标） */}
        <div className="relative">
          <button
            onClick={() => setCatOpen((v) => !v)}
            title="能力目录（按场景挑一个开始）"
            aria-label="能力目录"
            aria-expanded={catOpen}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition",
              catOpen ? "bg-brand-50 text-brand-600" : "text-stone-400 hover:bg-brand-50 hover:text-brand-600"
            )}
          >
            <LayoutGrid className="h-[18px] w-[18px]" />
          </button>
          {/* 能力目录浮层：原五大分类的子能力聚合在一处 */}
          {catOpen && (
            <div className="absolute left-full top-0 z-50 ml-1 max-h-[min(70vh,34rem)] w-64 overflow-y-auto rounded-xl border border-[#e8ddca] bg-white p-1.5 shadow-xl">
              {CAPABILITIES.map((cat) => (
                <div key={cat.id} className="mb-1">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-medium text-stone-700">
                    <span>{cat.emoji || "✨"}</span>
                    {cat.label}
                  </div>
                  <div className="my-0.5 border-t border-stone-100" />
                  {cat.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        void (async () => {
                          const id = await newConversation(item.mode);
                          void selectConversation(id);
                          setCatOpen(false);
                          toast(`已新建「${item.label}」· ${MODE_LABELS[item.mode]}会话`, "success");
                        })();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-brand-50"
                    >
                      <span className="w-4 text-center text-sm leading-none">{item.emoji || "·"}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-stone-700">{item.label}</span>
                      <span className="shrink-0 text-[10px] text-stone-400">{MODE_LABELS[item.mode]}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          title={`提示词模板库 (${TEMPLATES.length}+)`}
          aria-label={`提示词模板库 (${TEMPLATES.length}+)`}
          onClick={() => setTemplatesOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 transition hover:bg-brand-50 hover:text-brand-600"
        >
          <LayoutTemplate className="h-[18px] w-[18px]" />
        </button>
        <button
          title="一键素材包"
          aria-label="一键素材包"
          onClick={() => setPacksOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-amber-500/70 transition hover:bg-amber-50 hover:text-amber-600"
        >
          <Package className="h-[18px] w-[18px]" />
        </button>

        {/* 弹性空间 */}
        <div className="flex-1" />

        {/* 设置：与首页统一走 /settings 页面 */}
        <button
          title="设置中心"
          aria-label="设置中心"
          onClick={() => router.push("/settings")}
          className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </aside>

      {/* 首次进入的图标轨引导：6 秒后自动消失，可点击跳过 */}
      {showGuide && (
        <div
          onClick={() => setShowGuide(false)}
          className="pointer-events-auto fixed bottom-16 left-16 z-50 w-72 rounded-xl border border-[#e8ddca] bg-white p-3 shadow-2xl"
        >
          <p className="text-xs font-medium text-stone-800">左侧图标都是干什么的？</p>
          <p className="mt-1 text-[11px] leading-5 text-stone-500">
            上排六个是创作能力：AI 对话 / 文档 / PPT / 图片 / 深度研究 / 视频 —— 点一下即新建该能力的会话。
            下方「能力目录」可按场景挑模板式起点（品牌 / 内容 / 产品…），还有提示词模板库与素材包。
          </p>
          <p className="mt-1.5 text-right text-[10px] text-stone-300">点击任意处关闭 · 不再自动出现</p>
        </div>
      )}

      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <PacksModal open={packsOpen} onClose={() => setPacksOpen(false)} />
    </>
  );
}
