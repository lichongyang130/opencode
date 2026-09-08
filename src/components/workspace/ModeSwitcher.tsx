"use client";

import {
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Search,
  Video,
} from "lucide-react";
import { useChatStore, MODE_LABELS, type WorkspaceMode } from "@/lib/store/chat";
import { cn } from "@/lib/utils";

const TABS: { mode: WorkspaceMode; icon: React.ReactNode }[] = [
  { mode: "chat", icon: <MessageSquare className="h-4 w-4" /> },
  { mode: "research", icon: <Search className="h-4 w-4" /> },
  { mode: "slides", icon: <LayoutDashboard className="h-4 w-4" /> },
  { mode: "image", icon: <ImageIcon className="h-4 w-4" /> },
  { mode: "video", icon: <Video className="h-4 w-4" /> },
  { mode: "docs", icon: <FileText className="h-4 w-4" /> },
];

export function ModeSwitcher() {
  const { conversations, activeId, setMode } = useChatStore();
  const convo = conversations.find((c) => c.id === activeId);
  const mode = convo?.mode ?? "chat";

  return (
    <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
      {TABS.map((t) => (
        <button
          key={t.mode}
          onClick={() => setMode(t.mode)}
          className={cn(
            // UX7: 窄屏收缩 padding 只留图标（label 已 hidden lg:inline），避免 6 个模式把工具栏挤爆
            "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition sm:px-3",
            mode === t.mode
              ? "bg-brand-600 font-medium text-white"
              : "text-stone-500 hover:bg-stone-100"
          )}
          title={MODE_LABELS[t.mode]}
        >
          {t.icon}
          <span className="hidden lg:inline">{MODE_LABELS[t.mode]}</span>
        </button>
      ))}
    </div>
  );
}
