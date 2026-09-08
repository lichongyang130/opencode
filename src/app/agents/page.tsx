"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/lib/store/chat";
import {
  addCustomAgent,
  loadCustomAgents,
  loadSkillState,
  removeCustomAgent,
  setSkill,
  skillsOf,
  type CustomAgent,
} from "@/lib/agents";
import { PERSONAS, type Persona } from "@/lib/personas";
import {
  BookOpen,
  Box,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Folder,
  MessageCircle,
  MoreHorizontal,
  PencilRuler,
  Play,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Star,
  Target,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { ShellSidebar } from "@/components/mockup/ShellSidebar";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import {
  AppLauncherMenu,
  NotificationBell,
  shareAsCase,
} from "@/components/shell/TopBarMenus";
import { cn } from "@/lib/utils";
import { readJSON, writeJSON } from "@/lib/safe-storage";

type AgentCat = "工作" | "创作" | "开发" | "效率";

const CAT_STYLE: Record<string, { text: string; bg: string; dot: string }> = {
  工作: { text: "text-orange-600", bg: "bg-orange-50", dot: "bg-orange-500" },
  创作: { text: "text-sky-600", bg: "bg-sky-50", dot: "bg-sky-500" },
  开发: { text: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  效率: { text: "text-violet-600", bg: "bg-violet-50", dot: "bg-violet-500" },
  自定义: { text: "text-rose-600", bg: "bg-rose-50", dot: "bg-rose-500" },
};

const AVATARS = [
  "/mock-avatars/pm.png",
  "/mock-avatars/analyst.png",
  "/mock-avatars/content.png",
  "/mock-avatars/coder.png",
  "/mock-avatars/meeting.png",
];

/** 内置智能体：展示用的固定属性（头像、分类、统计） */
const BUILTIN_META: Record<
  string,
  { cat: AgentCat; avatar: string; count: string; time: string }
> = {
  pm: { cat: "工作", avatar: AVATARS[0], count: "128 次", time: "今天 14:30" },
  "data-analyst": { cat: "工作", avatar: AVATARS[1], count: "96 次", time: "今天 11:20" },
  copywriter: { cat: "创作", avatar: AVATARS[2], count: "75 次", time: "昨天 16:45" },
  "code-reviewer": { cat: "开发", avatar: AVATARS[3], count: "62 次", time: "昨天 10:15" },
  hr: { cat: "效率", avatar: AVATARS[4], count: "48 次", time: "08-13 09:30" },
};

const CATEGORY_TABS = ["全部智能体", "工作", "创作", "开发", "效率", "自定义", "市场"];

/* 收藏与排序的本地持久化 */
const FAVS_KEY = "oc:agent-favs.v1";
const ORDER_KEY = "oc:agent-order.v1";

function loadIds(key: string): string[] {
  const list = readJSON<string[]>(key, []);
  return Array.isArray(list) ? list : [];
}

function saveIds(key: string, ids: string[]) {
  writeJSON(key, ids);
}

/** 由智能体 id 生成稳定的 12 周使用趋势（演示数据，不随渲染跳动） */
function trendOf(id: string): number[] {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return Array.from({ length: 12 }, (_, i) => {
    h = (h * 31 + i * 17 + 7) % 9973;
    return 18 + (h % 82);
  });
}

/** 近 30 天使用趋势迷你图 */
function TrendChart({ id }: { id: string }) {
  const data = trendOf(id);
  const w = 280;
  const h = 56;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 8) + 4;
    const y = h - 8 - ((v - min) / span) * (h - 16);
    return { x, y };
  });
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `4,${h - 4} ${line} ${w - 4},${h - 4}`;
  const delta = Math.round(((data[11] - data[8]) / Math.max(1, data[8])) * 100);

  return (
    <div>
      <div className="flex items-end justify-between">
        <span className="text-[13.5px] font-semibold text-stone-800">使用趋势</span>
        <span
          className={cn(
            "text-[11.5px] font-medium",
            delta >= 0 ? "text-emerald-600" : "text-red-500",
          )}
        >
          {delta >= 0 ? "+" : ""}
          {delta}% 较上周
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-14 w-full" preserveAspectRatio="none">
        <polygon points={area} fill="#f07a3f" opacity="0.1" />
        <polyline
          points={line}
          fill="none"
          stroke="#f07a3f"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={pts[11].x} cy={pts[11].y} r="3" fill="#f07a3f" />
      </svg>
      <div className="mt-0.5 flex justify-between text-[10px] text-stone-300">
        <span>12 周前</span>
        <span>本周</span>
      </div>
    </div>
  );
}

interface AgentRow {
  id: string;
  name: string;
  desc: string;
  cat: string;
  avatar: string;
  count: string;
  time: string;
  custom?: boolean;
}

export default function AgentsPage() {
  const router = useRouter();
  const { newConversation, selectConversation, setPersona, runAgentSequence } = useChatStore();

  const [tab, setTab] = useState(CATEGORY_TABS[0]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"default" | "count" | "time">("default");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string>("pm");
  const [detailOpen, setDetailOpen] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [custom, setCustom] = useState<CustomAgent[]>([]);
  const [skillState, setSkillState] = useState<Record<string, Record<string, boolean>>>({});
  const [favs, setFavs] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustom(loadCustomAgents());
    setSkillState(loadSkillState());
    setFavs(loadIds(FAVS_KEY));
    setOrder(loadIds(ORDER_KEY));
  }, []);

  const toggleFav = (id: string) => {
    const wasFav = favs.includes(id);
    const next = wasFav ? favs.filter((i) => i !== id) : [id, ...favs];
    setFavs(next);
    saveIds(FAVS_KEY, next);
    toast(wasFav ? "已取消收藏" : "已收藏，将优先展示", "info");
  };

  /** 拖拽排序：把拖动卡片插到目标卡片之前，顺序持久化 */
  const onDropCard = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = rows.map((r) => r.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const next = [...new Set(ids)];
    setOrder(next);
    saveIds(ORDER_KEY, next);
    setDragId(null);
  };

  // 点击外部关闭筛选 / 行菜单（用 DOM 属性判定，避免条件挂载 ref 导致菜单项点击前被卸载）
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      const insideMenu =
        t instanceof Element && Boolean(t.closest("[data-menu-open]"));
      if (filterRef.current && !filterRef.current.contains(t)) setFilterOpen(false);
      if (!insideMenu) setMenuFor(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const rows = useMemo<AgentRow[]>(() => {
    const builtin: AgentRow[] = Object.keys(BUILTIN_META).map((id) => {
      const p = PERSONAS.find((x) => x.id === id)!;
      const meta = BUILTIN_META[id];
      return {
        id,
        name: p.name,
        desc: p.desc,
        cat: meta.cat,
        avatar: meta.avatar,
        count: meta.count,
        time: meta.time,
      };
    });
    const mine: AgentRow[] = custom.map((a, i) => ({
      id: a.id,
      name: a.name,
      desc: a.desc,
      cat: "自定义",
      avatar: AVATARS[i % AVATARS.length],
      count: "0 次",
      time: new Date(a.createdAt).toLocaleDateString("zh-CN"),
      custom: true,
    }));
    const all = [...mine, ...builtin];
    const q = query.trim().toLowerCase();
    let list = all.filter(
      (a) =>
        (tab === CATEGORY_TABS[0] || a.cat === tab) &&
        (!q || a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)),
    );
    if (sort === "count") {
      list = [...list].sort((a, b) => parseInt(b.count) - parseInt(a.count));
    } else if (sort === "time") {
      list = [...list].sort((a, b) => (a.custom === b.custom ? 0 : a.custom ? -1 : 1));
    }
    // 收藏优先，其次用户拖拽定义的顺序
    return [...list].sort((a, b) => {
      const favDiff = Number(favs.includes(b.id)) - Number(favs.includes(a.id));
      if (favDiff) return favDiff;
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [custom, query, tab, sort, favs, order]);

  /** 市场可安装的智能体：内置 5 个之外、且未安装过的角色 */
  const marketAgents = useMemo(
    () =>
      PERSONAS.filter(
        (p) => p.id !== "none" && !BUILTIN_META[p.id] && !custom.some((c) => c.name === p.name),
      ),
    [custom],
  );

  /** 安装市场智能体：复制为可编辑的自定义智能体 */
  const installAgent = (p: Persona) => {
    const created = addCustomAgent({
      name: p.name,
      desc: p.desc,
      group: "工作",
      system: p.system,
      emoji: p.emoji,
    });
    setCustom(loadCustomAgents());
    setSelected(created.id);
    setDetailOpen(true);
    setTab("自定义");
    toast(`已安装「${p.name}」到我的智能体`, "success");
  };

  const cards = showAll ? rows : rows.slice(0, 5);
  const current = rows.find((r) => r.id === selected) ?? rows[0];
  const skills = skillsOf(current?.id ?? "");
  const personaOf = (id: string) => PERSONAS.find((p) => p.id === id);

  /** 开始对话：创建绑定该智能体的会话并跳到 /chat */
  const startChat = async (agentId: string) => {
    const name =
      personaOf(agentId)?.name ?? custom.find((c) => c.id === agentId)?.name ?? "助手";
    const id = await newConversation("chat");
    await selectConversation(id);
    setPersona(agentId);
    toast(`已创建「${name}」智能体对话`, "success");
    router.push("/chat");
  };

  const toggleSkill = (agentId: string, label: string) => {
    const cur = skillState[agentId]?.[label] ?? true;
    setSkillState(setSkill(agentId, label, !cur));
    toast(`${label} 已${!cur ? "启用" : "关闭"}`, "info");
  };

  const shareAgent = (agentId: string) => {
    const p = personaOf(agentId);
    const c = custom.find((x) => x.id === agentId);
    const prompt = [
      `【智能体】${p?.name ?? c?.name ?? "智能体"}`,
      c?.system ?? p?.system ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");
    void shareAsCase(prompt, agentId);
  };

  const removeAgent = (agentId: string) => {
    removeCustomAgent(agentId);
    setCustom(loadCustomAgents());
    if (selected === agentId) setSelected("pm");
    toast("已删除该智能体", "success");
  };

  /** 一键派生：把现有智能体（内置或自建）复制成一个可编辑的自定义副本 */
  const forkAgent = (agentId: string) => {
    const p = personaOf(agentId);
    const c = custom.find((x) => x.id === agentId);
    const name = p?.name ?? c?.name ?? "智能体";
    const created = addCustomAgent({
      name: `${name} 副本`,
      desc: c?.desc ?? p?.desc ?? name,
      group: c?.group ?? "工作",
      system: c?.system ?? p?.system ?? `你是${name}。`,
      emoji: c?.emoji ?? p?.emoji ?? "🤖",
    });
    setMenuFor(null);
    setCustom(loadCustomAgents());
    setSelected(created.id);
    setDetailOpen(true);
    setTab("自定义");
    toast(`已派生「${created.name}」，可自由修改设定`, "success");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4] text-stone-800">
      <ShellSidebar active="agents" />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#f0eadf] bg-[#fbf8f4] px-6 py-4">
          <div>
            <h1 className="text-[18px] font-semibold text-stone-900">智能体</h1>
            <p className="mt-0.5 text-[12.5px] text-stone-400">
              创建、管理和使用你的 AI 智能体团队
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <AppLauncherMenu />
            <button
              onClick={() => setPipelineOpen(true)}
              title="多个智能体依次处理同一任务，产出接力传递"
              className="ml-2 flex items-center gap-1.5 rounded-xl border border-[#f0c9a8] bg-white px-4 py-2 text-[13px] font-medium text-[#c05f3c] transition hover:bg-[#fdeee1]"
            >
              <Workflow className="h-4 w-4" /> 流水线
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="ml-2 flex items-center gap-1.5 rounded-xl border border-[#f0c9a8] bg-white px-4 py-2 text-[13px] font-medium text-[#c05f3c] transition hover:bg-[#fdeee1]"
            >
              <Plus className="h-4 w-4" /> 创建智能体
            </button>
          </div>
        </header>

        {/* 内容 */}
        <div className="flex min-h-0 flex-1 overflow-hidden px-6 pb-6 pt-5">
          {/* 主区域 */}
          <div className="min-w-0 flex-1 overflow-y-auto pr-4">
            {/* 我的智能体 */}
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-stone-800">
                我的智能体
                <span className="ml-2 text-[12px] font-normal text-stone-400">
                  {rows.length} 个
                </span>
              </h2>
              <button
                onClick={() => setShowAll((v) => !v)}
                className="flex items-center gap-1 text-[12.5px] text-stone-400 transition hover:text-[#c05f3c]"
              >
                {showAll ? "收起" : "查看全部"} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 市场可安装 */}
            {tab === "市场" && (
              marketAgents.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-[#ece6db] bg-white/60 py-10 text-center text-[13px] text-stone-400">
                  市场里的智能体都已安装完毕
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {marketAgents.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col items-center rounded-2xl border border-dashed border-[#e0b79c] bg-white p-4 text-center"
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-amber-100 text-[26px]">
                        {p.emoji}
                      </span>
                      <p className="mt-2.5 truncate text-[13.5px] font-semibold text-stone-800">{p.name}</p>
                      <p className="mt-1 line-clamp-2 text-center text-[11px] leading-4 text-stone-400">{p.desc}</p>
                      <button
                        onClick={() => installAgent(p)}
                        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 py-2 text-[12px] font-medium text-white shadow-sm transition hover:brightness-105"
                      >
                        <Plus className="h-3.5 w-3.5" /> 安装
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab !== "市场" && (rows.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-[#ece6db] bg-white/60 py-10 text-center text-[13px] text-stone-400">
                没有匹配的智能体，试试换个分类或关键词
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {cards.map((a) => {
                  const s = CAT_STYLE[a.cat] ?? CAT_STYLE.自定义;
                  return (
                    <div
                      key={a.id}
                      onClick={() => {
                        setSelected(a.id);
                        setDetailOpen(true);
                      }}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropCard(a.id)}
                      className={cn(
                        "relative cursor-grab rounded-2xl border bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition hover:shadow-md active:cursor-grabbing",
                        selected === a.id ? "border-[#e0b79c]" : "border-[#ece6db]",
                        dragId === a.id && "opacity-50",
                      )}
                    >
                      <span className={cn("absolute right-3 top-3 h-2 w-2 rounded-full", s.dot)} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFav(a.id);
                        }}
                        title={favs.includes(a.id) ? "取消收藏" : "收藏"}
                        className={cn(
                          "absolute left-3 top-2.5 rounded p-0.5 transition",
                          favs.includes(a.id) ? "text-amber-400" : "text-stone-200 hover:text-stone-400",
                        )}
                      >
                        <Star className={cn("h-3.5 w-3.5", favs.includes(a.id) && "fill-current")} />
                      </button>
                      <div className="mx-auto h-16 w-16 overflow-hidden rounded-full border border-stone-100">
                        <Image
                          src={a.avatar}
                          alt={a.name}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <p className="mt-3 truncate text-center text-[14px] font-semibold text-stone-800">
                        {a.name}
                      </p>
                      <div className="mt-1 flex justify-center">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-medium",
                            s.bg,
                            s.text,
                          )}
                        >
                          {a.cat}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-center text-xs leading-5 text-stone-400">
                        {a.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* 列表区 */}
            <div
              className={`mt-6 rounded-2xl border border-[#ece6db] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${tab === "市场" ? "hidden" : ""}`}
            >
              {/* 标签栏 */}
              <div className="flex flex-wrap items-center gap-1 border-b border-[#f0eadf] px-4 pt-3">
                {CATEGORY_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "relative px-3 pb-3 pt-1 text-[13px] transition",
                      tab === t
                        ? "font-medium text-[#c05f3c]"
                        : "text-stone-500 hover:text-stone-800",
                    )}
                  >
                    {t}
                    {tab === t && (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#f07a3f]" />
                    )}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2 pb-2">
                  <div className="flex items-center gap-2 rounded-lg border border-[#ece6db] bg-white px-3 py-1.5 text-stone-400">
                    <Search className="h-4 w-4" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜索智能体"
                      className="w-36 bg-transparent text-[12.5px] text-stone-700 outline-none placeholder:text-stone-400"
                    />
                  </div>
                  <div ref={filterRef} className="relative">
                    <button
                      onClick={() => setFilterOpen((v) => !v)}
                      className="flex items-center gap-1 rounded-lg border border-[#ece6db] bg-white px-3 py-1.5 text-[12.5px] text-stone-500 transition hover:text-stone-700"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {sort === "default" ? "筛选" : sort === "count" ? "按使用次数" : "按最近创建"}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {filterOpen && (
                      <div className="absolute right-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-xl border border-[#ece6db] bg-white p-1 shadow-lg">
                        {[
                          { id: "default", label: "默认排序" },
                          { id: "count", label: "按使用次数" },
                          { id: "time", label: "自建优先" },
                        ].map((o) => (
                          <button
                            key={o.id}
                            onClick={() => {
                              setSort(o.id as typeof sort);
                              setFilterOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] transition hover:bg-stone-50",
                              sort === o.id ? "text-[#c05f3c]" : "text-stone-600",
                            )}
                          >
                            {o.label}
                            {sort === o.id && <ChevronDown className="h-3 w-3" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 表头 */}
              <div className="flex items-center px-5 py-2.5 text-[12px] text-stone-400">
                <span className="w-[42%]">名称</span>
                <span className="w-[20%]">使用次数</span>
                <span className="w-[24%]">更新时间</span>
                <span className="flex-1 text-right">操作</span>
              </div>

              {rows.length === 0 && (
                <p className="border-t border-[#f5f0e8] py-10 text-center text-[13px] text-stone-400">
                  没有匹配的智能体
                </p>
              )}

              {rows.map((r) => {
                const s = CAT_STYLE[r.cat] ?? CAT_STYLE.自定义;
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelected(r.id);
                      setDetailOpen(true);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center border-t border-[#f5f0e8] px-5 py-3.5 transition hover:bg-[#fdfaf5]",
                      selected === r.id && "bg-[#fdf6ee]",
                    )}
                  >
                    <div className="flex w-[42%] items-center gap-3 pr-2">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-stone-100">
                        <Image
                          src={r.avatar}
                          alt={r.name}
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-stone-800">
                          {r.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-stone-400">{r.desc}</p>
                        <span
                          className={cn(
                            "mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                            s.bg,
                            s.text,
                          )}
                        >
                          {r.cat}
                        </span>
                      </div>
                    </div>
                    <span className="w-[20%] text-[13px] text-stone-600">{r.count}</span>
                    <span className="w-[24%] text-[13px] text-stone-500">{r.time}</span>
                    <div className="relative flex flex-1 items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFav(r.id);
                        }}
                        title={favs.includes(r.id) ? "取消收藏" : "收藏"}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-stone-100",
                          favs.includes(r.id) ? "text-amber-400" : "text-stone-400 hover:text-stone-600",
                        )}
                      >
                        <Star className={cn("h-4 w-4", favs.includes(r.id) && "fill-current")} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void startChat(r.id);
                        }}
                        title={`与 ${r.name} 开始对话`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <div data-menu-open className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(menuFor === r.id ? null : r.id);
                          }}
                          title="更多操作"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuFor === r.id && (
                          <div className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-xl border border-[#ece6db] bg-white p-1 text-left shadow-lg">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor(null);
                                void startChat(r.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 transition hover:bg-stone-50"
                            >
                              <Play className="h-3.5 w-3.5" /> 开始对话
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor(null);
                                shareAgent(r.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 transition hover:bg-stone-50"
                            >
                              <Share2 className="h-3.5 w-3.5" /> 分享智能体
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor(null);
                                forkAgent(r.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 transition hover:bg-stone-50"
                            >
                              <Copy className="h-3.5 w-3.5" /> 派生副本
                            </button>
                            {r.custom && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuFor(null);
                                  removeAgent(r.id);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-red-600 transition hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> 删除
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右侧详情面板 */}
          {detailOpen && current && (
            <aside className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#ece6db] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] xl:flex">
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="text-[11px] text-stone-300">智能体详情</span>
                <button
                  onClick={() => setDetailOpen(false)}
                  title="收起详情"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-start gap-3 px-5">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-stone-100">
                  <Image
                    src={current.avatar}
                    alt={current.name}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 pt-1">
                  <p className="flex items-center gap-1.5 text-[16px] font-semibold text-stone-800">
                    {current.name} <PencilRuler className="h-3.5 w-3.5 text-stone-400" />
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 在线
                  </p>
                  <p className="mt-1 text-[12px] text-stone-400">
                    {current.cat} · {current.custom ? "自建" : "v1.0"}
                  </p>
                </div>
              </div>

              <p className="mt-3 px-5 text-[12.5px] leading-6 text-stone-500">{current.desc}</p>

              {/* 统计 */}
              <div className="mx-5 mt-4 grid grid-cols-3 divide-x divide-[#f0eadf] rounded-xl border border-[#f0eadf] py-3 text-center">
                <div>
                  <p className="text-[18px] font-bold text-stone-800">
                    {current.count.replace(" 次", "")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone-400">使用次数</p>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-stone-800">
                    {skills.filter((s) => (skillState[current.id]?.[s.label] ?? true)).length}/
                    {skills.length}
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone-400">已启用能力</p>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-stone-800">{current.time}</p>
                  <p className="mt-0.5 text-[11px] text-stone-400">最近更新</p>
                </div>
              </div>

              {/* 使用趋势 */}
              <div className="mx-5 mt-4 rounded-xl border border-[#f0eadf] px-4 py-3">
                <TrendChart id={current.id} />
              </div>

              {/* 能力设置 */}
              <div className="mt-5 px-5">
                <p className="text-[13.5px] font-semibold text-stone-800">能力设置</p>
                <p className="mt-0.5 text-[11px] text-stone-400">
                  关闭的能力会写进角色设定，下次对话生效
                </p>
                <div className="mt-2 space-y-1">
                  {skills.map((s, i) => {
                    const on = skillState[current.id]?.[s.label] ?? true;
                    const Icon = [Target, Box, FileText, PencilRuler][i % 4];
                    return (
                      <div key={s.label} className="flex items-center gap-3 py-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fbf3ec] text-[#c05f3c]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-stone-700">{s.label}</p>
                          <p className="text-[11px] text-stone-400">{s.desc}</p>
                        </div>
                        <button
                          onClick={() => toggleSkill(current.id, s.label)}
                          title={on ? "点击关闭" : "点击启用"}
                          className={cn(
                            "relative h-5 w-9 rounded-full transition",
                            on ? "bg-[#ff6a3d]" : "bg-stone-300",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                              on ? "right-0.5" : "left-0.5",
                            )}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 知识库 */}
              <div className="mt-5 px-5">
                <p className="text-[13.5px] font-semibold text-stone-800">知识库</p>
                <div className="mt-2 space-y-1">
                  {[
                    { name: "产品文档库", n: 45, icon: BookOpen, tint: "bg-orange-50 text-orange-600" },
                    { name: "竞品资料库", n: 23, icon: Folder, tint: "bg-amber-50 text-amber-600" },
                  ].map((k) => (
                    <button
                      key={k.name}
                      onClick={() => router.push("/knowledge")}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#fdfaf5]"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          k.tint,
                        )}
                      >
                        <k.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-stone-700">
                          {k.name}
                        </span>
                        <span className="block text-[11px] text-stone-400">
                          在知识库中查看 · 包含 {k.n} 个文档
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-stone-300" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto flex items-center gap-2 border-t border-[#f0eadf] p-4">
                <button
                  onClick={() => shareAgent(current.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#ece6db] bg-white py-2.5 text-[13px] font-medium text-stone-600 transition hover:border-[#e0b79c]"
                >
                  <Share2 className="h-4 w-4" /> 分享智能体
                </button>
                <button
                  onClick={() => void startChat(current.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 py-2.5 text-[13px] font-medium text-white shadow-sm transition hover:brightness-105"
                >
                  <MessageCircle className="h-4 w-4" /> 开始对话
                </button>
              </div>
            </aside>
          )}

          {!detailOpen && (
            <button
              onClick={() => setDetailOpen(true)}
              title="展开详情"
              className="hidden w-8 shrink-0 flex-col items-center justify-center rounded-2xl border border-[#ece6db] bg-white text-stone-400 transition hover:text-stone-700 xl:flex"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
          )}
        </div>
      </main>

      {/* 创建智能体 */}
      {pipelineOpen && (
        <PipelineModal
          onClose={() => setPipelineOpen(false)}
        />
      )}

      {createOpen && (
        <CreateAgentModal
          onClose={() => setCreateOpen(false)}
          onCreated={(a) => {
            setCustom(loadCustomAgents());
            setSelected(a.id);
            setDetailOpen(true);
            setTab("自定义");
          }}
        />
      )}

      <Toaster />
    </div>
  );
}

function CreateAgentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (a: CustomAgent) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [group, setGroup] = useState("工作");
  const [system, setSystem] = useState("");
  const [emoji, setEmoji] = useState("🤖");

  const submit = () => {
    const n = name.trim();
    if (!n) {
      toast("请填写智能体名称", "error");
      return;
    }
    const s = system.trim();
    if (!s) {
      toast("请填写角色设定（决定它怎么回答）", "error");
      return;
    }
    const created = addCustomAgent({
      name: n,
      desc: desc.trim() || n,
      group,
      system: s,
      emoji,
    });
    toast(`已创建智能体「${n}」`, "success");
    onCreated(created);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/45 p-4 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200/80 bg-[#fdfaf6] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-stone-800">创建智能体</h2>
            <p className="mt-0.5 text-xs text-stone-400">保存在本机浏览器，可随时删除</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex flex-wrap gap-1">
              {["🤖", "📊", "✍️", "💻", "🎯", "🌿", "🧳", "🎨"].map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border text-[16px] transition",
                    emoji === e ? "border-orange-300 bg-orange-50" : "border-stone-200 bg-white",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：产品发布会策划师"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">一句话简介</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="例如：擅长发布会流程、话术与物料清单"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">分组</label>
            <div className="flex flex-wrap gap-1.5">
              {["工作", "创作", "开发", "效率"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[12.5px] transition",
                    group === g
                      ? "border-orange-300 bg-orange-50 text-[#c05f3c]"
                      : "border-stone-200 bg-white text-stone-600",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">
              角色设定（system prompt，决定它怎么回答）
            </label>
            <textarea
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={5}
              placeholder="你是……先做什么，再做什么，输出格式是什么，语气如何。"
              className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm leading-6 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-stone-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-50"
          >
            取消
          </button>
          <button
            onClick={submit}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2 text-sm font-medium text-white shadow-md shadow-orange-200 transition hover:brightness-105"
          >
            创建
          </button>
        </footer>
      </div>
    </div>
  );
}

/** 智能体流水线：按顺序勾选 2-4 个角色，任务产出逐棒传递 */
function PipelineModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { runAgentSequence } = useChatStore();
  const [picked, setPicked] = useState<Array<{ id: string; name: string }>>([]);
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const customAgents = useMemo(() => loadCustomAgents(), []);

  /** 可选角色：内置 5 个 + 自建 */
  const options: Array<{ id: string; name: string }> = [
    ...Object.keys(BUILTIN_META).map((id) => ({
      id,
      name: PERSONAS.find((p) => p.id === id)?.name ?? id,
    })),
    ...customAgents.map((c) => ({ id: c.id, name: c.name })),
  ];

  const toggle = (opt: { id: string; name: string }) => {
    setPicked((cur) => {
      if (cur.some((p) => p.id === opt.id)) return cur.filter((p) => p.id !== opt.id);
      if (cur.length >= 4) {
        toast("流水线最多 4 个角色", "error");
        return cur;
      }
      return [...cur, opt];
    });
  };

  const run = async () => {
    if (picked.length < 2) {
      toast("请至少选择 2 个角色", "error");
      return;
    }
    if (!task.trim()) {
      toast("请填写任务描述", "error");
      return;
    }
    setBusy(true);
    try {
      const newId = await runAgentSequence(
        picked.map((p) => p.id),
        task.trim(),
        { pipeline: true },
      );
      onClose();
      if (newId) {
        router.push("/chat");
        toast(`流水线已启动：${picked.map((p) => p.name).join(" → ")}`, "success");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/45 p-4 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200/80 bg-[#fdfaf6] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-stone-800">智能体流水线</h2>
            <p className="mt-0.5 text-xs text-stone-400">按顺序勾选角色，上一步产出自动交给下一步</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">
              选择角色（按处理顺序，2-4 个）
            </label>
            <div className="flex flex-wrap gap-1.5">
              {options.map((opt) => {
                const idx = picked.findIndex((p) => p.id === opt.id);
                const activeP = idx >= 0;
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggle(opt)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12.5px] transition",
                      activeP
                        ? "border-orange-300 bg-orange-50 text-[#c05f3c]"
                        : "border-stone-200 bg-white text-stone-600 hover:border-orange-200",
                    )}
                  >
                    {activeP && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#c05f3c] text-[9px] font-bold text-white">
                        {idx + 1}
                      </span>
                    )}
                    {opt.name}
                  </button>
                );
              })}
            </div>
            {picked.length > 0 && (
              <p className="mt-2 text-[11.5px] text-stone-400">
                处理顺序：{picked.map((p) => p.name).join(" → ")}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">任务描述</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={4}
              placeholder="例如：为一款 AI 影像手机制定新品发布方案（第一位负责策略，后续角色接力完善）"
              className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm leading-6 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-stone-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-50"
          >
            取消
          </button>
          <button
            onClick={() => void run()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2 text-sm font-medium text-white shadow-md shadow-orange-200 transition hover:brightness-105 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
            启动流水线
          </button>
        </footer>
      </div>
    </div>
  );
}
