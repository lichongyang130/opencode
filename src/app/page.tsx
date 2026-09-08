"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bell,
  Bot,
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Database,
  FileText,
  FileUp,
  Globe,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Lightbulb,
  MessageSquare,
  PanelRight,
  Presentation,
  Scan,
  Settings,
  SlidersHorizontal,
  X,
  Share2,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { WorkspaceMode } from "@/lib/store/chat";
import { ModelSelector } from "@/components/workspace/ModelSelector";
import { ArtifactPanel } from "@/components/workspace/ArtifactPanel";
import { AppLauncherMenu, NotificationBell } from "@/components/shell/TopBarMenus";
import { useChatStore } from "@/lib/store/chat";
import { loadDocuments } from "@/lib/documents";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

/* ---------------- 数据 ---------------- */

/** 侧边导航：每一项都指向真实存在的页面（此前全部指向 /chat） */
const NAV_ITEMS = [
  { icon: Home, label: "首页", route: "/", active: true },
  { icon: MessageSquare, label: "AI 对话", route: "/chat" },
  { icon: Bot, label: "智能体", route: "/agents" },
  { icon: Database, label: "知识库", route: "/knowledge" },
  { icon: FileText, label: "文档中心", route: "/docs" },
  { icon: LayoutTemplate, label: "模板中心", route: "/templates" },
  { icon: Wrench, label: "工具箱", route: "/tools" },
  { icon: LayoutGrid, label: "更多应用", route: "/apps" },
];

const QUICK_ACTIONS: Array<{
  icon: typeof FileText;
  label: string;
  color: string;
  mode: WorkspaceMode;
  prompt?: string;
}> = [
  { icon: FileText, label: "写文档", color: "text-blue-500", mode: "docs" },
  { icon: Presentation, label: "做PPT", color: "text-orange-500", mode: "slides" },
  { icon: ImageIcon, label: "生成图片", color: "text-emerald-500", mode: "image" },
  { icon: BarChart3, label: "数据分析", color: "text-violet-500", mode: "chat", prompt: "帮我分析以下数据，给出关键洞察和图表建议：\n" },
  { icon: Lightbulb, label: "头脑风暴", color: "text-amber-500", mode: "chat", prompt: "围绕以下主题做一次头脑风暴，给出 10 个有创意的想法：" },
  { icon: Scan, label: "更多", color: "text-stone-500", mode: "chat" },
];

const RECOMMEND_CARDS: Array<{
  icon: typeof FileText;
  title: string;
  desc: string;
  tile: string;
  bg: string;
  mode: WorkspaceMode;
  prompt?: string;
}> = [
  {
    icon: Presentation,
    title: "PPT 生成",
    desc: "一键生成专业演示文稿",
    tile: "from-orange-400 to-red-400",
    bg: "bg-orange-50/60",
    mode: "slides",
  },
  {
    icon: FileText,
    title: "文档写作",
    desc: "撰写各类专业文档",
    tile: "from-blue-400 to-sky-400",
    bg: "bg-blue-50/60",
    mode: "docs",
  },
  {
    icon: Share2,
    title: "思维导图",
    desc: "可视化你的思维与创意",
    tile: "from-emerald-400 to-green-400",
    bg: "bg-emerald-50/60",
    mode: "chat",
    prompt: "请以思维导图的结构（多级列表）帮我梳理这个主题：",
  },
  {
    icon: BarChart3,
    title: "数据分析",
    desc: "智能分析，洞察数据价值",
    tile: "from-violet-400 to-purple-400",
    bg: "bg-violet-50/60",
    mode: "chat",
    prompt: "帮我分析以下数据，输出关键结论、趋势与建议：\n",
  },
  {
    icon: Code2,
    title: "代码助手",
    desc: "编写、调试各类代码",
    tile: "from-indigo-400 to-blue-500",
    bg: "bg-indigo-50/60",
    mode: "chat",
    prompt: "你是资深工程师，请帮我：",
  },
  {
    icon: ImageIcon,
    title: "AI 绘图",
    desc: "描述想法，生成精美图片",
    tile: "from-pink-400 to-rose-400",
    bg: "bg-pink-50/60",
    mode: "image",
  },
];

const RECENT_USE = [
  { icon: Presentation, label: "季度汇报 PPT", color: "text-orange-500", mode: "slides" as WorkspaceMode, prompt: "生成一份季度工作汇报 PPT，包含业绩回顾、问题复盘、下季度计划" },
  { icon: FileText, label: "竞品分析报告", color: "text-blue-500", mode: "docs" as WorkspaceMode, prompt: "写一份竞品分析报告，对比核心功能、定价与市场策略" },
  { icon: Lightbulb, label: "营销文案", color: "text-amber-500", mode: "chat" as WorkspaceMode, prompt: "为新品上市写 5 条小红书风格的营销文案：" },
  { icon: BarChart3, label: "周报助手", color: "text-violet-500", mode: "chat" as WorkspaceMode, prompt: "根据以下工作要点，帮我整理一份结构清晰的周报：\n" },
  { icon: ImageIcon, label: "海报设计", color: "text-pink-500", mode: "image" as WorkspaceMode, prompt: "设计一张暖色调的活动宣传海报，主题：" },
];

interface RecentConvo {
  id: string;
  title: string;
  mode?: string;
  updatedAt?: number;
  /** 产物类型标签：PPT / 研究报告 / 文档 / 图片 */
  artifact?: string | null;
}

/* ---------------- 页面 ---------------- */

export default function HomePage() {
  const router = useRouter();
  const { model, setModel } = useChatStore();
  const [input, setInput] = useState("");
  const [greeting, setGreeting] = useState("你好");
  const [recent, setRecent] = useState<RecentConvo[]>([]);
  const [featureOpen, setFeatureOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
  const [latestDoc, setLatestDoc] = useState<{ name: string } | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  /** AI 创作画布显隐（右上角按钮控制，默认收起） */
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasConvoId, setCanvasConvoId] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const featureRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  /** 为你推荐：左右箭头滚动一屏 */
  const scrollRail = (dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: "smooth" });
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (featureRef.current && !featureRef.current.contains(t)) setFeatureOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setFeatureOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 6 ? "夜深了" : h < 12 ? "上午好" : h < 18 ? "下午好" : "晚上好");
    // 拉取最近对话
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
          setRecent(
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
          // AI 画布默认展示「最近一条有产物的会话」，没有就展示最近一条
          const withArtifact = list.find(
            (c) => c.deck || c.report || c.doc || (c.images?.length ?? 0) > 0,
          );
          setCanvasConvoId((withArtifact ?? list[0])?.id ?? null);
        },
      )
      .catch(() => {});
    // 文档中心：取最新文档与总数（本地数据，读得到就用）
    try {
      const docs = loadDocuments().filter((d) => !d.trashed);
      setDocCount(docs.length);
      setLatestDoc(docs[0] ? { name: docs[0].name } : null);
    } catch {}
  }, []);

  /** 读取文本文件作为附件（上传按钮与拖拽共用） */
  const readFile = (f: File) => {
    const isText =
      /\.(txt|md|mdx|csv|json|log|yaml|yml|ini|tsv|xml)$/i.test(f.name) ||
      f.type.startsWith("text/");
    if (!isText) {
      toast("目前支持文本文件：txt / md / csv / json / log 等", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "").slice(0, 12000);
      setAttachment({ name: f.name, content });
      toast(`已读取附件《${f.name}》，发送时一并发给模型`, "success");
    };
    reader.readAsText(f);
  };

  /** 把意图写入 sessionStorage，交给 /chat 工作区消费 */
  const goChat = (intent?: Record<string, unknown>) => {
    if (intent) {
      try {
        sessionStorage.setItem("oc:homeIntent", JSON.stringify({ ...intent, ts: Date.now() }));
      } catch {}
    }
    router.push("/chat");
  };

  const submit = () => {
    const text = input.trim();
    if (!text) return goChat();
    goChat({
      type: "send",
      mode: "chat",
      text,
      deep: thinking,
      web: webSearch,
      attachment: attachment ?? undefined,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fdfaf6] text-stone-800">
      {/* ============ 移动端顶部导航（侧栏在小屏隐藏，这里补上入口） ============ */}
      <div className="fixed inset-x-0 top-0 z-30 border-b border-stone-100 bg-white/95 backdrop-blur md:hidden">
        <div className="flex items-center gap-2 px-4 pt-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-base font-bold text-white shadow-sm">
            O
          </div>
          <span className="text-[15px] font-semibold tracking-tight">AI 对话</span>
          <button
            onClick={() => router.push("/membership")}
            className="ml-auto rounded-lg border border-orange-200 px-2.5 py-1 text-[12px] font-medium text-orange-600"
          >
            专业版
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => (item.active ? undefined : router.push(item.route))}
              className={
                item.active
                  ? "flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[12.5px] font-medium text-orange-600"
                  : "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-stone-600"
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ============ 左侧导航 ============ */}
      <aside className="hidden w-[208px] shrink-0 flex-col border-r border-stone-100 bg-white md:flex">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 pb-2 pt-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-lg font-bold text-white shadow-sm">
            O
          </div>
          <span className="text-[16px] font-semibold tracking-tight">AI 对话</span>
        </div>

        {/* 导航 */}
        <nav className="mt-3 flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => (item.active ? undefined : router.push(item.route))}
              className={
                item.active
                  ? "flex items-center gap-3 rounded-xl bg-orange-50 px-2.5 py-2.5 text-[13.5px] font-medium text-orange-600"
                  : "flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13.5px] text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
              }
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={item.active ? 2.2 : 1.8} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* 最近对话 */}
        <div className="mt-5 flex-1 overflow-y-auto px-3.5">
          <p className="mb-2 text-xs font-medium text-stone-400">最近对话</p>
          <div className="flex flex-col gap-0.5 -mx-2">
            {recent.length === 0 && (
              <p className="px-2 py-1 text-xs text-stone-300">暂无历史对话</p>
            )}
            {recent.map((c) => (
              <button
                key={c.id}
                onClick={() => goChat({ type: "convo", id: c.id })}
                className="flex items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-[13px] text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-stone-300" />
                <span className="truncate">{c.title}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => goChat()}
            className="mt-2 flex items-center gap-1 text-xs text-stone-400 transition hover:text-orange-600"
          >
            查看全部历史记录 <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* 用户卡片 */}
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
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-orange-50 px-1.5 py-px text-[10px] font-medium text-orange-600">
                <Sparkles className="h-2.5 w-2.5" /> 专业版
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-stone-400" />
          </button>
        </div>

        {/* 设置入口 */}
        <div className="px-2 pb-3">
          <button
            onClick={() => router.push("/settings")}
            title="设置中心"
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13.5px] text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.8} />
            设置
            <span className="ml-auto text-[11px] text-stone-300">模型 / 备份</span>
          </button>
        </div>
      </aside>

      {/* ============ 主区域 ============ */}
      <main className="relative flex-1 overflow-y-auto pt-[92px] md:pt-0">
        {/* 背景光晕 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,183,148,0.18),rgba(244,114,182,0.07)_55%,transparent_100%)]" />

        {/* 顶栏 */}
        <header className="relative z-10 flex items-center justify-end gap-2 px-8 pt-5">
          {/* AI 创作画布：点击显示 / 再点隐藏 */}
          <button
            onClick={() => setCanvasOpen((v) => !v)}
            title={canvasOpen ? "隐藏 AI 画布" : "显示 AI 画布"}
            aria-pressed={canvasOpen}
            className={
              canvasOpen
                ? "flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600 transition hover:bg-orange-100"
                : "flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-white hover:text-stone-800"
            }
          >
            <PanelRight className="h-[18px] w-[18px]" />
          </button>

          <button
            onClick={() => router.push("/settings")}
            title="设置中心"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-white hover:text-stone-800"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>

          {/* 最近动态 */}
          <NotificationBell />

          {/* 更多应用 */}
          <AppLauncherMenu />

          <button
            onClick={() => goChat({ type: "new" })}
            className="ml-2 rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-600 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
          >
            新建对话
          </button>
        </header>

        <div className="relative z-10 mx-auto max-w-[1080px] px-8 pb-16">
          {/* 问候 */}
          <div className="mt-10 text-center">
            <h1 className="text-[40px] font-bold leading-tight tracking-tight text-stone-900">
              {greeting}，Alex 👋
            </h1>
            <p className="mt-1 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-[34px] font-bold tracking-tight text-transparent">
              今天想创造点什么？
            </p>
            <p className="mt-3 text-[15px] text-stone-500">
              用 AI 把想法变成现实，探索<span className="font-medium text-stone-700">无限可能</span>
            </p>
          </div>

          {/* 输入舱（支持拖拽文本文件直接附上） */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) readFile(f);
            }}
            className={cn(
              "mt-8 rounded-2xl border bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.05)] transition",
              dragOver ? "border-orange-400 ring-2 ring-orange-200" : "border-stone-200/80"
            )}
          >
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              placeholder="描述你的需求，或直接 @ 提及文件 / 智能体 / 知识库..."
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-stone-800 outline-none placeholder:text-stone-400"
            />
            {attachment && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-stone-100 px-2.5 py-1.5 text-[13px] text-stone-600">
                <FileUp className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                <span className="min-w-0 truncate">{attachment.name}</span>
                <span className="shrink-0 text-[11px] text-stone-400">
                  {attachment.content.length} 字
                </span>
                <button
                  onClick={() => setAttachment(null)}
                  aria-label="移除附件"
                  className="ml-auto text-stone-400 transition hover:text-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <div ref={featureRef} className="relative">
                <button
                  onClick={() => setFeatureOpen((v) => !v)}
                  className={cn(
                    "flex h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition",
                    featureOpen
                      ? "border-orange-300 bg-orange-50 text-orange-600"
                      : "border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  功能
                  <span className="text-stone-400">
                    {[thinking && "深度", webSearch && "联网"].filter(Boolean).join(" · ") || "未开启"}
                  </span>
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 text-stone-400 transition-transform", featureOpen && "rotate-180")}
                  />
                </button>

                {featureOpen && (
                  <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[248px] overflow-hidden rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
                    <button
                      onClick={() => setThinking((v) => !v)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-orange-50"
                    >
                      <BrainCircuit className={cn("h-4 w-4", thinking ? "text-orange-500" : "text-stone-400")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-stone-800">深度思考</span>
                        <span className="block text-[11px] text-stone-400">慢速逐点推理，更适合复杂问题</span>
                      </span>
                      <Toggle on={thinking} />
                    </button>
                    <button
                      onClick={() => setWebSearch((v) => !v)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-orange-50"
                    >
                      <Globe className={cn("h-4 w-4", webSearch ? "text-orange-500" : "text-stone-400")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-stone-800">联网搜索</span>
                        <span className="block text-[11px] text-stone-400">检索互联网最新信息回答</span>
                      </span>
                      <Toggle on={webSearch} />
                    </button>

                    <div className="my-1 border-t border-stone-100" />

                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-orange-50"
                    >
                      <FileUp className="h-4 w-4 text-stone-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-stone-800">上传文件</span>
                        <span className="block text-[11px] text-stone-400">PDF / Word / 图片等附件</span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-stone-300" />
                    </button>
                    <button
                      onClick={() => {
                        setFeatureOpen(false);
                        goChat();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-orange-50"
                    >
                      <Bot className="h-4 w-4 text-stone-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-stone-800">选择智能体</span>
                        <span className="block text-[11px] text-stone-400">指定擅长某个领域的 AI</span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-stone-300" />
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f);
                  setFeatureOpen(false);
                  e.currentTarget.value = "";
                }}
              />
              <div className="flex shrink-0 items-center gap-2">
                <ModelSelector value={model} onChange={(id, provider) => setModel(id, provider)} />
                <button
                  onClick={submit}
                  aria-label="发送"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md shadow-orange-200 transition hover:brightness-105 active:scale-95"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>

          {/* 继续上次 + 今日用量 */}
          {(recent[0] || latestDoc) && (
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="text-[12.5px] font-medium text-stone-400">继续上次</span>
              {recent[0] && (
                <button
                  onClick={() => goChat({ type: "convo", id: recent[0].id })}
                  className="flex max-w-[300px] items-center gap-1.5 rounded-full border border-stone-200/80 bg-white px-3 py-1.5 text-[12.5px] text-stone-600 shadow-sm transition hover:border-orange-300 hover:text-orange-600"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                  <span className="truncate">{recent[0].title}</span>
                </button>
              )}
              {latestDoc && (
                <button
                  onClick={() => router.push("/docs")}
                  className="flex max-w-[300px] items-center gap-1.5 rounded-full border border-stone-200/80 bg-white px-3 py-1.5 text-[12.5px] text-stone-600 shadow-sm transition hover:border-orange-300 hover:text-orange-600"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span className="truncate">{latestDoc.name}</span>
                </button>
              )}
              <span className="ml-auto text-[11.5px] text-stone-400">
                今日对话 {recent.filter((c) => c.updatedAt && new Date(c.updatedAt).toDateString() === new Date().toDateString()).length} 次 · 文档 {docCount} 个
              </span>
            </div>
          )}

          {/* 快捷操作 */}
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() =>
                  a.prompt
                    ? goChat({ type: "fill", mode: a.mode, text: a.prompt })
                    : goChat({ type: "mode", mode: a.mode })
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-stone-200/80 bg-white py-3 text-[13.5px] font-medium text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow"
              >
                <a.icon className={`h-4 w-4 ${a.color}`} />
                {a.label}
              </button>
            ))}
          </div>

          {/* 为你推荐 */}
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-stone-800">
                <Sparkles className="h-4 w-4 text-orange-500" /> 为你推荐
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => scrollRail(-1)}
                  title="向前"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 transition hover:text-stone-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => scrollRail(1)}
                  title="向后"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:text-stone-900"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              ref={railRef}
              className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {RECOMMEND_CARDS.map((c) => (
                <div
                  key={c.title}
                  className={`group flex w-[62%] shrink-0 snap-start flex-col rounded-2xl border border-stone-200/70 ${c.bg} p-4 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60 sm:w-[30%] xl:w-[15.5%]`}
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${c.tile} text-white shadow-sm`}
                  >
                    <c.icon className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-[14.5px] font-semibold text-stone-800">{c.title}</p>
                  <p className="mt-1 min-h-[36px] text-xs leading-relaxed text-stone-500">
                    {c.desc}
                  </p>
                  <button
                    onClick={() =>
                      c.prompt
                        ? goChat({ type: "fill", mode: c.mode, text: c.prompt })
                        : goChat({ type: "mode", mode: c.mode })
                    }
                    className="mt-3 self-start rounded-lg border border-stone-300/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-600 transition group-hover:border-orange-300 group-hover:text-orange-600"
                  >
                    立即使用
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 最近使用 */}
          <div className="mt-10">
            <h2 className="text-[15px] font-semibold text-stone-800">最近使用</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {RECENT_USE.map((r) => (
                <button
                  key={r.label}
                  onClick={() => goChat({ type: "fill", mode: r.mode, text: r.prompt })}
                  className="flex items-center gap-2.5 rounded-xl border border-stone-200/80 bg-white px-4 py-3.5 text-left text-[13.5px] font-medium text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow"
                >
                  <r.icon className={`h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 ${r.color}`} />
                  <span className="truncate">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* AI 创作画布：点右上角按钮显示 / 隐藏。窄屏浮层，宽屏贴靠右侧 */}
      {canvasOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-stone-900/25 md:hidden"
            onClick={() => setCanvasOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[26rem] flex-col border-l border-stone-200 bg-white shadow-2xl md:static md:z-auto md:w-[26rem] md:max-w-none md:shadow-none lg:w-[30rem]">
            <ArtifactPanel
              conversationId={canvasConvoId ?? undefined}
              onClose={() => setCanvasOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition",
        on ? "bg-orange-500" : "bg-stone-200"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
          on ? "left-[18px]" : "left-0.5"
        )}
      />
    </span>
  );
}
