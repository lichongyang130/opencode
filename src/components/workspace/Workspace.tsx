"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Home, LayoutDashboard, Loader2, Menu, Monitor, Moon, PanelLeft, Pencil, Plus, Settings, Sun } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { HistoryPanel } from "./HistoryPanel";
import { ChatPanel } from "./ChatPanel";
import { ArtifactPanel } from "./ArtifactPanel";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { Toaster } from "@/components/Toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PromptDialog } from "@/components/PromptDialog";
import { useChatStore } from "@/lib/store/chat";
import { initTheme, readThemeMode, setThemeMode, type ThemeMode } from "@/lib/theme";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";
import { readJSON, writeJSON } from "@/lib/safe-storage";

export function Workspace() {
  const router = useRouter();
  const {
    hydrated,
    hydrate,
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
  // 对话历史默认隐藏（home-v2 布局收敛）：md+ 只保留 48px 图标条，
  // 顶栏「历史」按钮在展开面板与收起条之间切换；选择记入本地。
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  useEffect(() => {
    try {
      setHistoryCollapsed(readJSON("opencanvas.history.rail", true));
    } catch {
      setHistoryCollapsed(true);
    }
  }, []);
  const toggleHistory = () => {
    setHistoryCollapsed((v) => {
      const next = !v;
      try {
        writeJSON("opencanvas.history.rail", next);
      } catch {}
      return next;
    });
  };
  // THEME1: 三态主题（浅色 / 深色 / 跟随系统）。从「循环切换」改为三点菜单，
  // 避免连点两次才能到目标主题的困惑（原按钮只有图标，状态含义不直观）
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  useEffect(() => {
    return initTheme(() => setTheme(readThemeMode()));
  }, []);
  const applyTheme = (next: ThemeMode) => {
    setTheme(next);
    setThemeMode(next);
    setThemeMenuOpen(false);
    toast(next === "light" ? "已切换到浅色模式" : next === "dark" ? "已切换到深色模式" : "已切换到跟随系统");
  };

  const THEME_OPTIONS: { id: ThemeMode; label: string; icon: typeof Sun; desc: string }[] = [
    { id: "light", label: "浅色", icon: Sun, desc: "明亮暖白" },
    { id: "dark", label: "深色", icon: Moon, desc: "夜间护眼" },
    { id: "system", label: "跟随系统", icon: Monitor, desc: "随设备自动" },
  ];

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
        type: "send" | "fill" | "mode" | "new" | "convo" | "history";
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
        // 首页「查看全部历史记录」：小屏打开历史抽屉（桌面端历史面板本就常驻）
        case "history":
          setMobileHistory(true);
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
        <HistoryPanel
          mobileOpen={mobileHistory}
          onMobileClose={() => setMobileHistory(false)}
          railCollapsed={historyCollapsed}
          onRailCollapseChange={(v) => {
            setHistoryCollapsed(v);
            try {
              writeJSON("opencanvas.history.rail", v);
            } catch {}
          }}
        />
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
              aria-label="打开会话历史"
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-brand-600 md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            {/* 桌面：对话历史默认隐藏，这里做显隐开关（收起态仅剩 48px 图标条） */}
            <button
              onClick={toggleHistory}
              title={historyCollapsed ? "显示对话历史" : "隐藏对话历史"}
              aria-label={historyCollapsed ? "显示对话历史" : "隐藏对话历史"}
              aria-pressed={!historyCollapsed}
              className={cn(
                "hidden items-center gap-1.5 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-brand-600 md:flex",
                !historyCollapsed && "bg-brand-50 text-brand-600"
              )}
            >
              <PanelLeft className="h-4 w-4" />
              <span className="hidden text-xs lg:inline">历史</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-stone-800">智能助手</span>
              {active && (
                <button
                  onClick={() => setRenameOpen(true)}
                  // D45: 双击标题同样进入重命名，不再只有 hover 铅笔一个隐蔽入口
                  onDoubleClick={() => setRenameOpen(true)}
                  title="单击铅笔或双击标题即可重命名"
                  className="group flex max-w-[220px] items-center gap-1 truncate rounded px-1 text-sm text-stone-400 transition hover:text-brand-600"
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
              aria-label="返回首页"
              className="flex items-center gap-1 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
            >
              <Home className="h-4 w-4" />
              <span className="hidden text-xs lg:inline">首页</span>
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
            {/* THEME1: 三态主题。改成下拉菜单一次选到位，并展示当前态 */ }
            <div className="relative">
              <button
                onClick={() => setThemeMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={themeMenuOpen}
                aria-label="切换主题"
                title="切换主题（浅色 / 深色 / 跟随系统）"
                className={cn(
                  "flex items-center gap-1 rounded-lg p-1.5 transition",
                  themeMenuOpen
                    ? "bg-brand-50 text-brand-600"
                    : "text-stone-400 hover:bg-stone-100 hover:text-brand-600"
                )}
              >
                {theme === "light" ? (
                  <Sun className="h-4 w-4" />
                ) : theme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Monitor className="h-4 w-4" />
                )}
              </button>
              {themeMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-xl"
                >
                  {THEME_OPTIONS.map((o) => {
                    const cur = theme === o.id;
                    return (
                      <button
                        key={o.id}
                        role="menuitemradio"
                        aria-checked={cur}
                        onClick={() => applyTheme(o.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-stone-50",
                          cur && "bg-brand-50"
                        )}
                      >
                        <o.icon className={cn("h-4 w-4", cur ? "text-brand-600" : "text-stone-400")} />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-xs", cur ? "font-medium text-brand-700" : "text-stone-700")}>
                            {o.label}
                          </span>
                          <span className="block text-[10px] text-stone-400">{o.desc}</span>
                        </span>
                        {cur && <Check className="h-3.5 w-3.5 text-brand-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {/* 设置统一走 /settings 页面（与首页同入口，不再另开一套弹窗） */}
            <button
              onClick={() => router.push("/settings")}
              title="设置中心（模型 / 数据 / 外观）"
              aria-label="设置中心"
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
            >
              <Settings className="h-4 w-4" />
            </button>
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
      {/* A5: 全局命令面板接线（Cmd/Ctrl+K），此前只在 mockup 里可用 */}
      <CommandPalette />
      <Toaster />
    </div>
  );
}
