"use client";

import { useRouter } from "next/navigation";
import {
  Clapperboard,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Presentation,
  Search,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useChatStore, MODE_LABELS, type WorkspaceMode } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

/** 竖栏主图标 = 六种创作能力。点图标新建对应模式的会话（进入该能力对话框）。 */
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

  const activeConvo = conversations.find((c) => c.id === activeId);
  const activeMode: WorkspaceMode = activeConvo?.mode ?? "chat";

  const startMode = async (mode: WorkspaceMode) => {
    const id = await newConversation(mode);
    void selectConversation(id);
    toast(`已新建「${MODE_LABELS[mode]}」会话`, "success");
  };

  return (
    <aside className="relative z-40 flex w-12 shrink-0 flex-col items-center border-r border-[#e8ddca] bg-[#f5efe4] py-2">
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
  );
}
