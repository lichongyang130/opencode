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
  BarChart3,
  FileText,
  Folder,
  Handshake,
  Loader2,
  Mail,
  Plus,
  Scale,
  Search,
  Star,
  Users,
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

const CATEGORY_TABS = ["全部", "工作", "创作", "开发", "效率"] as const;

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
  launchId?: string;
  tags?: string[];
  rating?: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const { newConversation, selectConversation, setPersona, runAgentSequence } = useChatStore();

  const [tab, setTab] = useState<(typeof CATEGORY_TABS)[number]>("工作");
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
      cat: a.group || "工作",
      avatar: AVATARS[i % AVATARS.length],
      count: "0 次",
      time: new Date(a.createdAt).toLocaleDateString("zh-CN"),
      custom: true,
      tags: [a.group || "工作", "自建"],
      rating: "—",
    }));
    const extra: AgentRow[] = [
      { id: "mail", launchId: "hr", name: "自动化邮件助手", desc: "整理收件箱、起草回复与跟进清单，不编造未发生的往来。", cat: "工作", avatar: AVATARS[4], count: "2.1k 使用", time: "", tags: ["工作", "团队"], rating: "4.8" },
      { id: "crm", launchId: "pm", name: "客户跟进专家", desc: "管好跟进节奏、下次动作与风险，不编造客户承诺。", cat: "工作", avatar: AVATARS[0], count: "2.1k 使用", time: "", tags: ["工作", "团队"], rating: "4.8" },
      { id: "minutes", launchId: "hr", name: "会议纪要生成器", desc: "结论、负责人、时间点；不确定处标待核实。", cat: "工作", avatar: AVATARS[4], count: "2.1k 使用", time: "", tags: ["工作", "团队"], rating: "4.8" },
      { id: "legal", launchId: "code-reviewer", name: "合同审核员", desc: "标出风险条款与谈判点，不构成法律意见。", cat: "工作", avatar: AVATARS[3], count: "2.1k 使用", time: "", tags: ["工作", "团队"], rating: "4.8" },
    ];
    const named = builtin.map((a) =>
      a.id === "pm"
        ? { ...a, name: "项目经理 Pro", desc: "把目标拆成里程碑、负责人和风险。缓冲公开，不编造完成度。", tags: ["工作", "团队"], count: "2.1k 使用", rating: "4.8" }
        : a.id === "data-analyst"
          ? { ...a, name: "数据分析助手", desc: "先口径再结论。未知数据标待核实，禁止编造显著。", tags: ["工作", "团队"], count: "2.1k 使用", rating: "4.8" }
          : { ...a, tags: [a.cat, "团队"], rating: "4.8", count: a.count.includes("使用") ? a.count : a.count.replace(" 次", "k 使用") },
    );
    const all = [...mine, ...extra, ...named];
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
    setTab("工作");
    toast(`已安装「${p.name}」到我的智能体`, "success");
  };

  const cards = showAll ? rows : rows.slice(0, 5);
  const current = rows.find((r) => r.id === selected) ?? rows[0];
  const skills = skillsOf(current?.id ?? "");
  const personaOf = (id: string) => PERSONAS.find((p) => p.id === id);

  /** 开始对话：创建绑定该智能体的会话并跳到 /chat */
  const startChat = async (agentId: string) => {
    const row = rows.find((r) => r.id === agentId);
    const pid = personaOf(agentId)?.id ?? row?.launchId ?? (custom.some((c) => c.id === agentId) ? agentId : "pm");
    const name =
      personaOf(pid)?.name ?? custom.find((c) => c.id === agentId)?.name ?? row?.name ?? "助手";
    const id = await newConversation("chat");
    await selectConversation(id);
    setPersona(pid);
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
    setTab("工作");
    toast(`已派生「${created.name}」，可自由修改设定`, "success");
  };

  const CARD_ICON = [Handshake, Folder, Users, FileText, Scale, BarChart3, Mail] as const;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f1e8] text-stone-800">
      <ShellSidebar active="agents" />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto max-w-[1100px]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[32px] font-extrabold tracking-tight text-stone-900">智能体中心</h1>
                <p className="mt-1 text-[14px] text-stone-500">探索、管理和部署您的 AI 助手</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPipelineOpen(true)}
                  className="rounded-xl border border-[#e0b79c] bg-white px-4 py-2 text-[13px] text-[#c05f3c]"
                >
                  流水线
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#c45c2a] px-4 py-2 text-[13px] font-medium text-white"
                >
                  <Plus className="h-4 w-4" /> 创建智能体
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-[13px] font-medium transition",
                      tab === t ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex min-w-[220px] items-center gap-2 rounded-full bg-white px-4 py-2 ring-1 ring-[#e0b79c]/80">
                <Search className="h-4 w-4 text-stone-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索智能体..."
                  className="w-full bg-transparent text-[13px] outline-none"
                />
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="mt-16 text-center text-[13px] text-stone-400">没有匹配的智能体</p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((a, i) => {
                  const Icon = CARD_ICON[i % CARD_ICON.length];
                  return (
                    <article key={a.id} className="flex flex-col rounded-[22px] border border-stone-200/80 bg-white p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f4eadc] text-[#c45c2a]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-[16px] font-semibold text-stone-900">{a.name}</h2>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-stone-500">{a.desc}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(a.tags ?? [a.cat, "团队"]).map((t) => (
                          <span key={t} className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-2">
                        <p className="text-[12px] text-stone-400">
                          {a.count.includes("使用") ? a.count : a.count} | {a.rating ?? "4.8"}★
                        </p>
                        <button
                          type="button"
                          onClick={() => void startChat(a.id)}
                          className="rounded-full border border-[#e0b79c] px-3.5 py-1.5 text-[12px] font-medium text-[#c45c2a] hover:bg-[#fdeee1]"
                        >
                          立即使用
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
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
            setTab("工作");
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
