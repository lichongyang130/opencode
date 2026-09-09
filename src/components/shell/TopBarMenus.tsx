"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  Database,
  FileText,
  LayoutGrid,
  LayoutTemplate,
  MessageSquare,
  Settings,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";
import { readJSON, readRaw, writeJSON, writeRaw } from "@/lib/safe-storage";

/** 顶栏「应用启动器」入口 */
export const APP_LAUNCHER = [
  { label: "AI 对话", icon: MessageSquare, route: "/chat", tint: "text-orange-600", bg: "bg-orange-50" },
  { label: "知识库", icon: Database, route: "/knowledge", tint: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "文档中心", icon: FileText, route: "/docs", tint: "text-sky-600", bg: "bg-sky-50" },
  { label: "模板中心", icon: LayoutTemplate, route: "/templates", tint: "text-violet-600", bg: "bg-violet-50" },
  { label: "工具箱", icon: Wrench, route: "/tools", tint: "text-amber-600", bg: "bg-amber-50" },
  { label: "智能体", icon: Bot, route: "/agents", tint: "text-indigo-600", bg: "bg-indigo-50" },
  { label: "会员中心", icon: Sparkles, route: "/membership", tint: "text-rose-600", bg: "bg-rose-50" },
  { label: "设置中心", icon: Settings, route: "/settings", tint: "text-stone-600", bg: "bg-stone-100" },
];

const MODE_LABELS: Record<string, string> = {
  chat: "对话",
  research: "深度研究",
  slides: "PPT",
  image: "绘图",
  video: "视频",
  docs: "文档",
};

function timeAgo(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d === 1) return "昨天";
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

interface FeedItem {
  id: string;
  title: string;
  mode?: string;
  updatedAt?: number;
  artifact?: string | null;
}

/* ────────── 系统通知（本机持久化已读位置） ────────── */

interface SysNotification {
  id: string;
  title: string;
  desc: string;
  ts: number;
}

const SYS_NOTIF_KEY = "oc:sys-notifications.v1";
const SYS_READ_KEY = "oc:sys-notifications-read.v1";

function sysNotifications(): SysNotification[] {
  const saved = readJSON<SysNotification[] | null>(SYS_NOTIF_KEY, null);
  if (Array.isArray(saved)) return saved;
  const seed: SysNotification[] = [
    { id: "n-cmdk", title: "已支持 ⌘K 全局搜索", desc: "对话、文档、知识库、工具一键直达", ts: Date.now() - 36e5 * 2 },
    { id: "n-kb", title: "知识库新增「检索测试」", desc: "输入问题，快速验证能否命中知识库内容", ts: Date.now() - 36e5 * 26 },
    { id: "n-model", title: "设置中心支持默认模型偏好", desc: "新建对话将默认使用你选择的模型", ts: Date.now() - 36e5 * 50 },
  ];
  writeJSON(SYS_NOTIF_KEY, seed);
  return seed;
}

function sysReadAt(): number {
  return Number(readRaw(SYS_READ_KEY) ?? 0) || 0;
}

function markSysRead() {
  writeRaw(SYS_READ_KEY, String(Date.now()));
}

/**
 * 顶栏通知：最近动态（真实会话数据）。
 * 点击某条会带上 convo 意图跳到 /chat 并打开该会话。
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [sys, setSys] = useState<SysNotification[]>([]);
  const [readAt, setReadAt] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    setSys(sysNotifications());
    setReadAt(sysReadAt());
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(
        (d: {
          conversations?: Array<{
            id: string;
            title: string;
            archived?: boolean;
            mode?: string;
            updatedAt?: number;
            deck?: unknown;
            report?: unknown;
            doc?: unknown;
            images?: unknown[];
          }>;
        }) => {
          const list = (d.conversations ?? []).filter((c) => !c.archived);
          setItems(
            list.slice(0, 8).map((c) => ({
              id: c.id,
              title: c.title,
              mode: c.mode,
              updatedAt: c.updatedAt,
              artifact: c.deck
                ? "PPT"
                : c.report
                  ? "研究报告"
                  : c.doc
                    ? "文档"
                    : (c.images?.length ?? 0) > 0
                      ? "图片"
                      : null,
            })),
          );
        },
      )
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unreadCount = sys.filter((n) => n.ts > readAt).length + (items.length > 0 ? 1 : 0);

  const openConvo = (id: string) => {
    setOpen(false);
    try {
      sessionStorage.setItem("oc:homeIntent", JSON.stringify({ type: "convo", id, ts: Date.now() }));
    } catch {}
    router.push("/chat");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="通知中心"
        aria-label="通知中心"
        className={
          open
            ? "flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600 transition hover:bg-orange-100"
            : "flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white hover:text-stone-700"
        }
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9.5px] font-semibold text-white shadow">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[340px] overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <span className="text-[13.5px] font-semibold text-stone-800">通知中心</span>
            <button
              onClick={() => {
                markSysRead();
                setReadAt(Date.now());
              }}
              disabled={unreadCount === 0}
              className="text-[11.5px] text-stone-400 transition hover:text-orange-600 disabled:opacity-40"
            >
              全部已读
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {/* 系统通知 */}
            {sys.map((n) => {
              const unread = n.ts > readAt;
              return (
                <div
                  key={n.id}
                  className="flex items-start gap-2.5 border-b border-stone-50 px-4 py-2.5"
                >
                  <span
                    className={
                      unread
                        ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500"
                        : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stone-200"
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[13px]",
                        unread ? "font-medium text-stone-800" : "text-stone-500",
                      )}
                    >
                      {n.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-stone-400">
                      <span className="truncate">{n.desc}</span>
                      <span className="ml-auto shrink-0">{timeAgo(n.ts)}</span>
                    </span>
                  </span>
                </div>
              );
            })}

            {/* 最近动态 */}
            <p className="bg-stone-50/70 px-4 py-1.5 text-[10.5px] font-medium text-stone-400">
              最近动态
            </p>
            {items.length === 0 ? (
              <p className="px-4 py-5 text-center text-[12px] text-stone-400">
                还没有对话记录，开始第一段对话吧
              </p>
            ) : (
              items.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConvo(c.id)}
                  className="flex w-full items-start gap-2.5 border-b border-stone-50 px-4 py-2.5 text-left transition last:border-0 hover:bg-stone-50"
                >
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-stone-700">{c.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                      {MODE_LABELS[c.mode ?? "chat"] ?? "对话"}
                      {c.artifact && (
                        <span className="rounded bg-orange-50 px-1 py-px text-[10px] font-medium text-orange-600">
                          {c.artifact}
                        </span>
                      )}
                      <span className="ml-auto shrink-0">{timeAgo(c.updatedAt)}</span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              router.push("/chat");
            }}
            className="w-full border-t border-stone-100 px-4 py-2.5 text-[12px] text-stone-500 transition hover:bg-stone-50 hover:text-orange-600"
          >
            查看全部历史记录
          </button>
        </div>
      )}
    </div>
  );
}

/** 顶栏「更多应用」九宫格启动器 */
export function AppLauncherMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="更多应用"
        aria-label="更多应用"
        className={
          open
            ? "flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600 transition hover:bg-orange-100"
            : "flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white hover:text-stone-700"
        }
      >
        <LayoutGrid className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[300px] rounded-2xl border border-stone-200/80 bg-white p-2 shadow-xl">
          <div className="px-2 py-1.5 text-[11px] text-stone-400">全部应用</div>
          <div className="grid grid-cols-4 gap-1">
            {APP_LAUNCHER.map((a) => (
              <button
                key={a.route}
                onClick={() => {
                  setOpen(false);
                  router.push(a.route);
                }}
                className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 transition hover:bg-stone-50"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.bg} ${a.tint}`}>
                  <a.icon className="h-[17px] w-[17px]" />
                </span>
                <span className="w-full truncate text-center text-[11px] text-stone-600">
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 把一段内容做成分享链接（/s/{code}）并复制到剪贴板 */
export async function shareAsCase(prompt: string, templateId = "shared"): Promise<void> {
  try {
    const res = await fetch("/api/cases/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, prompt }),
    });
    const data = (await res.json()) as { code?: string; error?: string };
    if (!res.ok || !data.code) throw new Error(data.error ?? "分享失败");
    const link = `${window.location.origin}/s/${data.code}`;
    await navigator.clipboard?.writeText(link);
    toast(`分享链接已复制：${link}`, "success");
  } catch (e) {
    toast(`分享失败：${e instanceof Error ? e.message : ""}`, "error");
  }
}
