"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Home,
  LayoutGrid,
  LayoutTemplate,
  MessageSquare,
  Moon,
  Pin,
  Search,
  Settings,
  Sparkles,
  Sun,
  Wrench,
} from "lucide-react";
import { useChatStore } from "@/lib/store/chat";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { t, useLang } from "@/lib/i18n";
// THEME1: mockup 开关改走共享主题模块（key 与解析口径和正式壳层一致）
import { readThemeMode, setThemeMode } from "@/lib/theme";

function readDark(): boolean {
  const mode = readThemeMode();
  if (mode === "dark") return true;
  if (mode === "light") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function applyDark(next: boolean) {
  setThemeMode(next ? "dark" : "light");
}

function dayLabelOf(ts: number): string {
  if (!ts) return "common.earlier";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "common.today";
  if (new Date(now.getTime() - 864e5).toDateString() === d.toDateString()) return "common.yesterday";
  return "common.earlier";
}

export type ShellActive =
  | "chat"
  | "agents"
  | "knowledge"
  | "docs"
  | "templates"
  | "tools"
  | "apps"
  | "membership"
  | "settings";

const NAV = [
  { label: "nav.home", icon: Home, route: "/" },
  { label: "nav.chat", icon: MessageSquare, route: "/chat" },
  { label: "nav.agents", icon: Bot, route: "/agents" },
  { label: "nav.knowledge", icon: Database, route: "/knowledge" },
  { label: "nav.docs", icon: FileText, route: "/docs" },
  { label: "nav.templates", icon: LayoutTemplate, route: "/templates" },
  { label: "nav.tools", icon: Wrench, route: "/tools" },
  { label: "nav.apps", icon: LayoutGrid, route: "/apps" },
];

export function ShellSidebar({ active }: { active: ShellActive }) {
  const router = useRouter();
  const { conversations, selectConversation, togglePin } = useChatStore();
  const [collapsed, setCollapsed] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dark, setDark] = useState<boolean | null>(null);
  const [convoQuery, setConvoQuery] = useState("");
  const [lang, switchLang] = useLang();

  // 同步 <html lang>
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  }, [lang]);

  /** 置顶优先，其次按更新时间；支持标题搜索 */
  const visibleConvos = useMemo(() => {
    const q = convoQuery.trim().toLowerCase();
    return [...conversations]
      .filter((c) => !c.archived)
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
          (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
      )
      .slice(0, 14);
  }, [conversations, convoQuery]);

  // 挂载后读取真实主题（layout 内联脚本已在首屏前设置），避免水合不一致
  useEffect(() => setDark(readDark()), []);

  const toggleTheme = () => {
    const next = !(dark ?? readDark());
    applyDark(next);
    setDark(next);
  };

  const go = (route: string, expand = false) => {
    if (route.startsWith("/agents")) router.push("/agents");
    else if (route.startsWith("/knowledge")) router.push("/knowledge");
    else if (route.startsWith("/docs")) router.push("/docs");
    else if (route.startsWith("/templates")) router.push("/templates");
    else if (route.startsWith("/tools")) router.push("/tools");
    else if (route.startsWith("/apps")) router.push("/apps");
    else router.push(route === "/" ? "/" : "/chat");
    if (expand) setCollapsed(false);
  };

  const openConvo = (id: string) => {
    router.push("/chat");
    void selectConversation(id);
  };

  /* ────────── 收起态：仅图标栏 ────────── */
  if (collapsed) {
    return (
      <aside className="flex w-[48px] shrink-0 flex-col items-center border-r border-[#efe9dd] bg-white py-2">
        <button
          onClick={() => router.push("/")}
          title="AI 对话"
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-sm font-bold text-white shadow-sm"
        >
          O
        </button>

        {/* 全局搜索 */}
        <button
          onClick={() => setPaletteOpen(true)}
          title="全局搜索（⌘K）"
          className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        {/* 展开按钮 */}
        <button
          onClick={() => setCollapsed(false)}
          title="展开菜单"
          className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <ChevronRight className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </button>

        <div className="my-1 h-px w-6 bg-stone-100" />

        {/* 导航图标 */}
        <nav className="flex flex-col items-center gap-1" aria-label="Main navigation">
          {NAV.map((item) => {
            const isActive = item.route === `/${active}`;
            return (
              <button
                key={item.label}
                title={t(item.label, lang)}
                onClick={() => go(item.route, true)}
                className={
                  isActive
                    ? "flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdeee1] text-[#c05f3c]"
                    : "flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                }
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.1 : 1.8} />
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* 语言切换 */}
        <button
          onClick={() => switchLang(lang === "zh" ? "en" : "zh")}
          title={lang === "zh" ? "Switch to English" : "切换到中文"}
          className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          {lang === "zh" ? "EN" : "中"}
        </button>

        {/* 主题切换 */}
        <button
          onClick={toggleTheme}
          title={dark ? t("sidebar.toLight", lang) : t("sidebar.toDark", lang)}
          suppressHydrationWarning
          className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        {/* 设置 */}
        <button
          title="设置"
          onClick={() => router.push("/settings")}
          className={
            active === "settings"
              ? "mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdeee1] text-[#c05f3c]"
              : "mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          }
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={active === "settings" ? 2.1 : 1.8} />
        </button>

        {/* 用户 */}
        <button
          title="会员中心"
          onClick={() => router.push("/membership")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-100 transition hover:border-[#c05f3c]"
        >
          <Image
            src="/avatar.png"
            alt="Alex Chen"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
          />
        </button>

        <CommandPalette />
      </aside>
    );
  }

  /* ────────── 展开态：完整侧栏 ────────── */
  return (
    <aside className="flex w-[196px] shrink-0 flex-col border-r border-[#efe9dd] bg-white">
      {/* 全局搜索 */}
      <div className="px-2 pt-3">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-[#ece6db] bg-[#fbf8f4] px-2.5 py-2 text-left text-[12.5px] text-stone-400 transition hover:border-[#e0b79c] hover:text-stone-600"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">{t("sidebar.searchAll", lang)}</span>
          <kbd className="rounded border border-stone-200 bg-white px-1 py-px text-[9.5px] text-stone-400">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* 顶部 Logo */}
      <div className="flex items-center justify-between px-2 py-4 pl-3.5">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2.5 text-left"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-lg font-bold text-white shadow-sm">
            O
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-stone-800">AI 对话</span>
        </button>
        <button
          onClick={() => setCollapsed(true)}
          title="收起菜单"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* 导航 */}
      <nav className="flex flex-col gap-0.5 px-2" aria-label="Main navigation">
        {NAV.map((item) => {
          const isActive = item.route === `/${active}`;
          return (
            <button
              key={item.label}
              onClick={() => go(item.route)}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "flex items-center gap-2.5 rounded-xl bg-[#fdeee1] px-2.5 py-2.5 text-[13.5px] font-medium text-[#c05f3c]"
                  : "flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13.5px] text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
              }
            >
              <item.icon
                className="h-[18px] w-[18px]"
                strokeWidth={isActive ? 2.1 : 1.8}
              />
              {t(item.label, lang)}
            </button>
          );
        })}
      </nav>

      <div className="mx-3.5 my-3.5 h-px bg-stone-100" />

      {/* 最近对话：搜索 + 置顶 + 按天分组 */}
      <div className="flex-1 overflow-y-auto px-3.5">
        <div className="flex items-center justify-between">
          <p className="mb-1.5 text-xs font-medium text-stone-400">{t("sidebar.recent", lang)}</p>
          {visibleConvos.length > 0 && (
            <button
              onClick={() => {
                const first = visibleConvos.find((c) => c.pinned);
                if (first) void togglePin(first.id);
              }}
              title={t("sidebar.unpinAll", lang)}
              className="mb-1.5 text-[10.5px] text-stone-300 transition hover:text-stone-500"
            >
              <Pin className="h-3 w-3" />
            </button>
          )}
        </div>
        {conversations.filter((c) => !c.archived).length > 3 && (
          <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-[#ece6db] bg-[#fbf8f4] px-2 py-1.5">
            <Search className="h-3 w-3 shrink-0 text-stone-400" />
            <input
              value={convoQuery}
              onChange={(e) => setConvoQuery(e.target.value)}
              placeholder={t("sidebar.searchChat", lang)}
              className="w-full bg-transparent text-[11.5px] text-stone-700 outline-none placeholder:text-stone-400"
            />
          </div>
        )}
        <div className="-mx-2 flex flex-col gap-0.5">
          {visibleConvos.length === 0 && (
            <p className="px-2 py-1 text-xs text-stone-300">
              {convoQuery ? t("sidebar.noMatch", lang) : t("sidebar.noHistory", lang)}
            </p>
          )}
          {(() => {
            let lastLabel = "";
            return visibleConvos.map((c) => {
              const ts = c.updatedAt ?? 0;
              const label = dayLabelOf(ts);
              const header = label !== lastLabel && !c.pinned ? (
                <p key={`g-${label}`} className="mt-1.5 px-2 pb-0.5 text-[10px] text-stone-300">
                  {t(label, lang)}
                </p>
              ) : null;
              lastLabel = label;
              return (
                <div key={c.id}>
                  {header}
                  <div className="group flex items-center gap-0.5">
                    <button
                      onClick={() => openConvo(c.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
                    >
                      {c.pinned ? (
                        <Pin className="h-3 w-3 shrink-0 fill-current text-orange-400" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-stone-300" />
                      )}
                      <span className="truncate">{c.title}</span>
                    </button>
                    <button
                      onClick={() => togglePin(c.id)}
                      title={c.pinned ? t("common.unpin", lang) : t("common.pin", lang)}
                      className="shrink-0 rounded p-1 text-stone-300 opacity-0 transition hover:bg-stone-100 hover:text-orange-500 group-hover:opacity-100"
                    >
                      <Pin className={`h-3 w-3 ${c.pinned ? "fill-current text-orange-400" : ""}`} />
                    </button>
                  </div>
                </div>
              );
            });
          })()}
          <button
            onClick={() => router.push("/chat")}
            className="mt-1 flex items-center gap-1 px-2 text-xs text-stone-400 transition hover:text-[#c05f3c]"
          >
            {t("sidebar.viewAll", lang)} <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      {/* 主题切换 */}
      <div className="px-2 pb-2">
        <button
          onClick={toggleTheme}
          suppressHydrationWarning
          className={
            "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
          }
        >
          {dark ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          {dark ? t("sidebar.theme.light", lang) : t("sidebar.theme.dark", lang)}
        </button>
        <button
          onClick={() => switchLang(lang === "zh" ? "en" : "zh")}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
        >
          <span className="flex h-[17px] w-[17px] items-center justify-center text-[10px] font-bold">
            {lang === "zh" ? "EN" : "中"}
          </span>
          {lang === "zh" ? "English" : "中文"}
        </button>
      </div>

      {/* 设置 */}
      <div className="px-2 pb-3">
        <button
          onClick={() => router.push("/settings")}
          className={
            active === "settings"
              ? "flex w-full items-center gap-2.5 rounded-xl bg-[#fdeee1] px-2.5 py-2.5 text-[13.5px] font-medium text-[#c05f3c]"
              : "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13.5px] text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
          }
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={active === "settings" ? 2.1 : 1.8} />
          {t("nav.settings", lang)}
          <span className="ml-auto text-[11px] text-stone-300">{t("sidebar.settingsHint", lang)}</span>
        </button>
      </div>

      {/* 用户 */}
      <div className="border-t border-stone-100 p-2">
        <button
          onClick={() => router.push("/membership")}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-stone-50"
        >
          <Image
            src="/avatar.png"
            alt="Alex Chen"
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover"
          />
          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span className="text-[13.5px] font-medium text-stone-800">Alex Chen</span>
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#fdeee1] px-1.5 py-px text-[10px] font-medium text-[#c05f3c]">
              <Sparkles className="h-2.5 w-2.5" /> 专业版
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-stone-400" />
        </button>
      </div>

      <CommandPalette />
    </aside>
  );
}
