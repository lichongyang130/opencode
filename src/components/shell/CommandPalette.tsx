"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Database,
  FileText,
  Home,
  LayoutGrid,
  LayoutTemplate,
  MessageSquare,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useChatStore } from "@/lib/store/chat";
import { loadDocuments } from "@/lib/documents";
import { loadKnowledgeBases } from "@/lib/knowledge";
import { TEMPLATES } from "@/lib/templates";
import { ALL_TOOLS } from "@/lib/tools";
import { PERSONAS } from "@/lib/personas";
import { cn } from "@/lib/utils";

interface CmdItem {
  id: string;
  group: string;
  label: string;
  desc?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 执行动作 */
  run: () => void;
}

const GROUP_ORDER = ["页面", "对话", "文档", "知识库", "模板", "工具", "智能体"];
void GROUP_ORDER;

/**
 * 全局命令面板：Cmd/Ctrl+K 唤起，跨页面搜索
 * 会话 / 文档 / 知识库 / 模板 / 工具 / 智能体 / 页面导航。
 * 挂载在 ShellSidebar 里，全站可用。
 */
export function CommandPalette() {
  const router = useRouter();
  const { conversations, selectConversation } = useChatStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIdx(0);
  }, []);

  /* 全局快捷键：Cmd/Ctrl+K 开关 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setIdx(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* 打开时聚焦输入框 */
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const openConvo = useCallback(
    (id: string) => {
      try {
        sessionStorage.setItem(
          "oc:homeIntent",
          JSON.stringify({ type: "convo", id, ts: Date.now() }),
        );
      } catch {}
      router.push("/chat");
    },
    [router],
  );

  /* 搜索索引：打开时构建即可（数据量小，不必 memo 全局） */
  const items = useMemo<CmdItem[]>(() => {
    if (!open) return [];
    const nav = [
      { label: "首页", route: "/", icon: Home, desc: "工作台总览" },
      { label: "AI 对话", route: "/chat", icon: MessageSquare, desc: "开始新的对话" },
      { label: "智能体", route: "/agents", icon: Bot, desc: "管理 AI 智能体团队" },
      { label: "知识库", route: "/knowledge", icon: Database, desc: "管理知识资源" },
      { label: "文档中心", route: "/docs", icon: FileText, desc: "浏览与上传文档" },
      { label: "模板中心", route: "/templates", icon: LayoutTemplate, desc: "专业提示词模板" },
      { label: "工具箱", route: "/tools", icon: Wrench, desc: "24 个即开即用工具" },
      { label: "更多应用", route: "/apps", icon: LayoutGrid, desc: "扩展工作能力" },
      { label: "会员中心", route: "/membership", icon: Sparkles, desc: "套餐与权益" },
      { label: "设置中心", route: "/settings", icon: Settings, desc: "模型密钥 / 备份" },
    ].map((n) => ({
      id: `nav:${n.route}`,
      group: "页面",
      label: n.label,
      desc: n.desc,
      icon: n.icon,
      run: () => router.push(n.route),
    }));

    const convos: CmdItem[] = conversations.slice(0, 40).map((c) => ({
      id: `convo:${c.id}`,
      group: "对话",
      label: c.title,
      desc: "打开这段对话",
      icon: MessageCircle,
      run: () => {
        void selectConversation(c.id);
        openConvo(c.id);
      },
    }));

    const docs: CmdItem[] = loadDocuments()
      .slice(0, 30)
      .map((d) => ({
        id: `doc:${d.id ?? d.name}`,
        group: "文档",
        label: d.name,
        desc: d.desc || "文档中心",
        icon: FileText,
        run: () => router.push("/docs"),
      }));

    const kbs: CmdItem[] = loadKnowledgeBases()
      .slice(0, 20)
      .map((k) => ({
        id: `kb:${k.id}`,
        group: "知识库",
        label: k.name,
        desc: `${k.count} 个文档 · ${k.size}`,
        icon: Database,
        run: () => router.push("/knowledge"),
      }));

    const tpls: CmdItem[] = TEMPLATES.slice(0, 60).map((t) => ({
      id: `tpl:${t.id}`,
      group: "模板",
      label: t.label,
      desc: t.desc,
      icon: LayoutTemplate,
      run: () => router.push("/templates"),
    }));

    const tools: CmdItem[] = ALL_TOOLS.slice(0, 40).map((t) => ({
      id: `tool:${t.id}`,
      group: "工具",
      label: t.name,
      desc: t.desc,
      icon: Wrench,
      run: () => router.push("/tools"),
    }));

    const agents: CmdItem[] = PERSONAS.filter((p) => p.id !== "none").map((p) => ({
      id: `agent:${p.id}`,
      group: "智能体",
      label: p.name,
      desc: p.desc,
      icon: Bot,
      run: () => router.push("/agents"),
    }));

    return [...nav, ...convos, ...docs, ...kbs, ...tpls, ...tools, ...agents];
  }, [open, conversations, router, selectConversation, openConvo]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            (it.desc ?? "").toLowerCase().includes(q) ||
            it.group.toLowerCase().includes(q),
        )
      : items.filter((it) => it.group === "页面" || it.group === "对话").slice(0, 12);
    return list.slice(0, 24);
  }, [items, query]);

  useEffect(() => setIdx(0), [query]);

  /* 打开时锁滚动，Esc 关闭 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const exec = (it: CmdItem) => {
    close();
    it.run();
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = results[Math.min(idx, results.length - 1)];
      if (it) exec(it);
    }
  };

  /* 当前选中项滚动到可见 */
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${idx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!open) return null;

  /* 按 group 分组渲染 */
  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-stone-900/40 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-stone-100 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-stone-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="搜索对话、文档、知识库、模板、工具…"
            className="w-full bg-transparent text-[14px] text-stone-800 outline-none placeholder:text-stone-400"
          />
          <kbd className="shrink-0 rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-400">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-stone-400">
              没有匹配的结果，换个关键词试试
            </p>
          )}
          {results.map((it, i) => {
            const header =
              it.group !== lastGroup ? (
                <p
                  key={`g-${it.group}`}
                  className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-stone-400"
                >
                  {it.group}
                </p>
              ) : null;
            lastGroup = it.group;
            const Icon = it.icon;
            return (
              <div key={it.id}>
                {header}
                <button
                  data-idx={i}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => exec(it)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                    i === idx ? "bg-[#fdeee1]" : "hover:bg-stone-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      i === idx ? "bg-white text-[#c05f3c]" : "bg-stone-100 text-stone-500",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-stone-800">
                      {it.label}
                    </span>
                    {it.desc && (
                      <span className="block truncate text-[11.5px] text-stone-400">
                        {it.desc}
                      </span>
                    )}
                  </span>
                  {i === idx && (
                    <span className="shrink-0 text-[10.5px] text-stone-400">回车打开</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-stone-100 bg-stone-50/60 px-4 py-2 text-[10.5px] text-stone-400">
          <span>↑↓ 选择</span>
          <span>回车 打开</span>
          <span>Esc 关闭</span>
          <span className="ml-auto">OpenCanvas 全局搜索</span>
        </div>
      </div>
    </div>
  );
}
