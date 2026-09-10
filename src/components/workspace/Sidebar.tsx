"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Database,
  GraduationCap,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Wand2,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 左侧产品导航（图标 + 文字）。
 *  AI 对话 = /chat 工作台；画布 = /canvas 产物墙（AI 产物之家）；灵感 = /templates 模板灵感；
 *  知识库 / 智能体 / 工具 = 各自独立模块页；底部固定会员中心。 */
const NAV: { key: string; label: string; icon: LucideIcon; href: string }[] = [
  { key: "chat", label: "AI 对话", icon: MessageSquare, href: "/chat" },
  { key: "ideas", label: "灵感", icon: Lightbulb, href: "/templates" },
  { key: "experts", label: "专家", icon: GraduationCap, href: "/experts" },
  { key: "skills", label: "技能", icon: Wand2, href: "/skills" },
  { key: "knowledge", label: "知识库", icon: Database, href: "/knowledge" },
  { key: "agents", label: "智能体", icon: Bot, href: "/agents" },
  { key: "tools", label: "工具", icon: Wrench, href: "/tools" },
];

function sectionOf(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/canvas")) return "canvas";
  if (pathname.startsWith("/templates")) return "ideas";
  if (pathname.startsWith("/experts")) return "experts";
  if (pathname.startsWith("/skills")) return "skills";
  if (pathname.startsWith("/knowledge")) return "knowledge";
  if (pathname.startsWith("/agents")) return "agents";
  if (pathname.startsWith("/tools")) return "tools";
  if (pathname.startsWith("/membership")) return "membership";
  return null;
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const current = sectionOf(pathname);

  return (
    <aside className="relative z-40 flex w-12 shrink-0 flex-col items-stretch border-r border-[#e8ddca] bg-[#f5efe4] py-3 md:w-[196px] md:px-2">
      {/* 品牌：点击回首页（窄屏只显示图标） */}
      <button
        onClick={() => router.push("/")}
        title="OpenCanvas · 返回首页"
        aria-label="OpenCanvas · 返回首页"
        className="mb-3 flex items-center gap-2.5 self-center rounded-lg px-1 py-1 transition hover:opacity-90 md:self-stretch md:px-1.5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 text-sm font-bold text-white shadow-sm">
          O
        </span>
        <span className="hidden text-[15px] font-semibold tracking-tight text-stone-800 md:inline">
          OpenCanvas
        </span>
      </button>

      {/* 导航 */}
      <nav className="flex flex-col items-center gap-1 md:items-stretch" aria-label="主导航">
        {NAV.map(({ key, label, icon: Icon, href }) => {
          const isActive = current === key;
          return (
            <button
              key={key}
              onClick={() => router.push(href)}
              title={label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-10 items-center justify-center gap-2.5 rounded-xl px-2 text-[13.5px] transition md:justify-start md:px-2.5",
                isActive
                  ? "bg-white font-medium text-brand-700 shadow-sm"
                  : "text-stone-500 hover:bg-white/70 hover:text-stone-800"
              )}
            >
              <Icon
                className="h-[18px] w-[18px] shrink-0"
                strokeWidth={isActive ? 2.1 : 1.8}
              />
              <span className="hidden truncate md:inline">{label}</span>
              {isActive && (
                <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-brand-500 md:inline" />
              )}
            </button>
          );
        })}
      </nav>

      {/* 弹性空间 */}
      <div className="flex-1" />

      {/* 会员中心：固定底部 */}
      <button
        onClick={() => router.push("/membership")}
        title="会员中心"
        aria-current={current === "membership" ? "page" : undefined}
        className={cn(
          "flex h-10 items-center justify-center gap-2.5 rounded-xl px-2 text-[13.5px] transition md:justify-start md:px-2.5",
          current === "membership"
            ? "bg-white font-medium text-rose-600 shadow-sm"
            : "text-stone-500 hover:bg-white/70 hover:text-rose-600"
        )}
      >
        <Sparkles
          className={cn(
            "h-[18px] w-[18px] shrink-0",
            current === "membership" ? "text-rose-500" : "text-amber-500"
          )}
          strokeWidth={current === "membership" ? 2.1 : 1.8}
        />
        <span className="hidden truncate md:inline">会员中心</span>
        <span className="ml-auto hidden rounded-full bg-rose-100 px-1.5 py-px text-[10px] font-medium text-rose-600 md:inline">
          Pro
        </span>
      </button>
    </aside>
  );
}
