"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, LayoutDashboard, Loader2, Menu, Monitor, Moon, Pencil, Plus, Sun, UserRound } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { HistoryPanel } from "./HistoryPanel";
import { ChatPanel } from "./ChatPanel";
import { ArtifactPanel } from "./ArtifactPanel";
import { SettingsModal } from "./SettingsModal";
import { Toaster } from "@/components/Toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PromptDialog } from "@/components/PromptDialog";
import { useChatStore } from "@/lib/store/chat";
import { initTheme, readThemeMode, setThemeMode } from "@/lib/theme";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

export function Workspace() {
  const {
    hydrated,
    hydrate,
    settingsOpen,
    setSettingsOpen,
    sending,
    conversations,
    activeId,
    artifactOpen,
    setArtifactOpen,
    newConversation,
    selectConversation,
    renameConversation,
  } = useChatStore();
  // UX5: 顶栏标题就地重命名（复用 PromptDialog，回车确认）
  const [renameOpen, setRenameOpen] = useState(false);
  // UX20: 移动端历史抽屉开关（md 以下顶栏菜单按钮触发；桌面端常驻不受影响）
  const [mobileHistory, setMobileHistory] = useState(false);
  // THEME1: 三态主题（浅色 → 深色 → 跟随系统循环）；initTheme 订阅系统偏好变化
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    return initTheme(() => setTheme(readThemeMode()));
  }, []);
  const cycleTheme = () => {
    const order = ["light", "dark", "system"] as const;
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    setThemeMode(next);
    toast(next === "light" ? "已切换到浅色模式" : next === "dark" ? "已切换到深色模式" : "已切换到跟随系统");
  };

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // 消费首页带来的意图（sessionStorage 传递，避免 URL 泄漏长文本）
  useEffect(() => {
    if (!hydrated) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("oc:homeIntent");
      if (raw) sessionStorage.removeItem("oc:homeIntent");
    } catch {}
    if (!raw) return;
    try {
      const intent = JSON.parse(raw) as {
        type: "send" | "fill" | "mode" | "new" | "convo";
        mode?: import("@/lib/store/chat").WorkspaceMode;
        text?: string;
        id?: string;
        ts?: number;
      };
      // 超过 30 秒的意图视为过期
      if (intent.ts && Date.now() - intent.ts > 30_000) return;
      const store = useChatStore.getState();
      switch (intent.type) {
        case "send":
          if (intent.text) void store.runTemplate({ mode: intent.mode ?? "chat", prompt: intent.text });
          break;
        case "fill":
          void store.fillTemplate({ mode: intent.mode ?? "chat", prompt: intent.text ?? "" });
          break;
        case "mode":
          void store.newConversation(intent.mode ?? "chat").then((id) => store.selectConversation(id));
          break;
        case "new":
          void store.newConversation("chat").then((id) => store.selectConversation(id));
          break;
        case "convo":
          if (intent.id) void store.selectConversation(intent.id);
          break;
      }
    } catch {}
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  const active = conversations.find((c) => c.id === activeId);

  // UX14: 长任务阶段提示 —— 聚合当前会话各模式的状态位，给出比「生成中…」更具体的阶段文案
  const stage = active
    ? [
        active.deckStatus === "loading" && "正在生成 PPT…",
        active.videoStatus === "loading" && "正在撰写分镜…",
        active.researchStatus === "loading" && "正在深度研究…",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const startNew = () => {
    void newConversation("chat").then((id) => selectConversation(id));
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 分栏各自包边界：单栏渲染异常不会连带整个工作台白屏 */}
      <ErrorBoundary label="导航栏">
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary label="会话列表">
        <HistoryPanel mobileOpen={mobileHistory} onMobileClose={() => setMobileHistory(false)} />
      </ErrorBoundary>
      {/* UX20: 移动端抽屉打开时的背景遮罩，点按关闭 */}
      {mobileHistory && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/40 md:hidden"
          onClick={() => setMobileHistory(false)}
          aria-hidden
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-[#e8ddca] bg-[#faf6ee] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            {/* UX20: 移动端打开历史抽屉 */}
            <button
              onClick={() => setMobileHistory(true)}
              title="打开会话历史"
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-brand-600 md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-stone-800">智能助手</span>
              {active && (
                <button
                  onClick={() => setRenameOpen(true)}
                  title="重命名当前任务"
                  className="group flex max-w-[220px] items-center gap-1 truncate text-sm text-stone-400 transition hover:text-brand-600"
                >
                  <span className="truncate">· {active.title}</span>
                  <Pencil className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
                </button>
              )}
            </div>
            <button
              onClick={startNew}
              className="ml-2 flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-1.5 text-[12.5px] font-medium text-orange-600 transition hover:border-orange-300 hover:bg-orange-50"
            >
              <Plus className="h-3.5 w-3.5" /> 新建对话
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            {sending && (
              <span className="hidden items-center gap-1.5 text-xs text-brand-600 sm:flex">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {/* UX14: 有具体阶段时展示阶段，否则回退通用文案 */}
                {stage || "生成中…"}
              </span>
            )}
            <Link
              href="/"
              title="返回首页"
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
            >
              <Home className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setArtifactOpen(!artifactOpen)}
              title={artifactOpen ? "关闭产物画布" : "打开产物画布"}
              className={cn(
                "rounded-lg p-1.5 transition",
                artifactOpen
                  ? "bg-brand-50 text-brand-600"
                  : "text-stone-400 hover:bg-stone-100 hover:text-brand-600"
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
            </button>
            {/* THEME1: 三态主题循环切换（浅色 → 深色 → 跟随系统） */}
            <button
              onClick={cycleTheme}
              title={theme === "light" ? "浅色模式（点击切换深色）" : theme === "dark" ? "深色模式（点击跟随系统）" : "跟随系统（点击切换浅色）"}
              aria-label="切换主题"
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </button>
            <span
              title="李明"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-400 text-white shadow-sm"
            >
              <UserRound className="h-4 w-4" />
            </span>
          </div>
        </header>
        {/* UX6: 全局细进度条 —— sending 期间顶栏底部持续走的不确定进度动画，比转圈更克制 */}
        <div className={cn("h-0.5 overflow-hidden transition-opacity", sending ? "opacity-100" : "opacity-0")}>
          <div className="h-full w-1/3 animate-[ocprogress_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-orange-300 via-orange-500 to-orange-300" />
        </div>
        {/* UX14 阶段文案在小屏无处安放时的兜底：进度条 hover 提示 */}
        <OfflineBanner />
        {/* relative：小屏时产物画布以浮层形式覆盖在对话区之上 */}
        <div className="relative flex min-h-0 flex-1">
          <ErrorBoundary label="对话区">
            <ChatPanel />
          </ErrorBoundary>
          <ErrorBoundary label="产物画布">
            <ArtifactPanel />
          </ErrorBoundary>
        </div>
      </div>
      <ErrorBoundary label="设置面板">
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </ErrorBoundary>
      <PromptDialog
        open={renameOpen}
        title="重命名任务"
        initialValue={active?.title ?? ""}
        placeholder="新的任务名称"
        maxLength={60}
        onConfirm={(t) => {
          if (activeId) renameConversation(activeId, t);
          setRenameOpen(false);
        }}
        onCancel={() => setRenameOpen(false)}
      />
      <Toaster />
    </div>
  );
}
