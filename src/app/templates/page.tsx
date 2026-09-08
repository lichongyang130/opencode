"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  FileText,
  Filter,
  LayoutGrid,
  Plus,
  Play,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { ShellSidebar } from "@/components/mockup/ShellSidebar";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  MODE_LABEL_OF,
  TEMPLATES,
  applyVariables,
  extractVariables,
  type Template,
} from "@/lib/templates";
import { usePromptStore } from "@/lib/prompt-store";
import { useChatStore } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import { CreateTemplateModal } from "@/components/templates/CreateTemplateModal";
import { MyTemplatesModal } from "@/components/templates/MyTemplatesModal";
import { AppLauncherMenu, NotificationBell } from "@/components/shell/TopBarMenus";
import { readJSON, writeJSON } from "@/lib/safe-storage";

interface UseTmplState {
  tpl: Template;
  values: Record<string, string>;
}

const CAT_UI: Record<string, { icon: string; tint: string; bg: string }> = {
  marketing: { icon: "📈", tint: "text-violet-600", bg: "bg-violet-50" },
  ecommerce: { icon: "🛒", tint: "text-orange-600", bg: "bg-orange-50" },
  workplace: { icon: "💼", tint: "text-blue-600", bg: "bg-blue-50" },
  writing: { icon: "✍️", tint: "text-pink-600", bg: "bg-pink-50" },
  research: { icon: "🔬", tint: "text-emerald-600", bg: "bg-emerald-50" },
  business: { icon: "🚀", tint: "text-amber-600", bg: "bg-amber-50" },
  education: { icon: "🎓", tint: "text-sky-600", bg: "bg-sky-50" },
  design: { icon: "🎨", tint: "text-fuchsia-600", bg: "bg-fuchsia-50" },
  video: { icon: "🎬", tint: "text-red-600", bg: "bg-red-50" },
  productivity: { icon: "⚡", tint: "text-stone-600", bg: "bg-stone-100" },
};

const TABS = ["热门模板", "最新模板", "高评分模板", "我的收藏"];
const PAGE_STEP = 8;
const FAV_KEY = "oc:tpl-favs.v1";

/** 各模式的示例产出节选（展示模板能生成什么） */
const SAMPLE_OUTPUT: Record<string, string> = {
  docs: "# 品牌方案\n\n## 定位\n一句话说清品牌差异…\n\n## 核心信息\n- 主张：…\n- 证据：…",
  slides: "第 1 页｜封面\n第 2 页｜市场洞察：3 个关键数字\n第 3 页｜解决方案：一图流\n…",
  chat: "当然可以。以下是我为你准备的 3 个方案：\n1. …\n2. …\n3. …",
  research: "# 深度研究：XX 市场分析\n\n## 关键发现\n1. 市场规模 …（来源：…）\n2. 竞争格局 …",
  image: "（生成 1 张 1024×1024 配图：主视觉 + 品牌色 + 留白构图）",
  video: "（生成分镜脚本：5 个镜头，含景别与时长建议）",
};

function loadFavs(): string[] {
  const list = readJSON<string[]>(FAV_KEY, []);
  return Array.isArray(list) ? list : [];
}

/** 稳定哈希：让评分/热度对同一模板始终一致（不随渲染顺序跳动） */
function hashOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 100003;
  return h;
}

function scoreOf(t: Template) {
  const h = hashOf(t.id);
  return { rating: (4.4 + (h % 6) * 0.1).toFixed(1), usage: 3 + (h % 150) / 10 };
}

const THUMB_PALETTES = [
  { bg: "#eef3fb", line: "#c7d8f2", bar: "#4d7fe0" },
  { bg: "#f7f0fb", line: "#d8c6f0", bar: "#8b5cf6" },
  { bg: "#eefbf4", line: "#c7ecd8", bar: "#34a06c" },
  { bg: "#fdf3ee", line: "#f0cdb9", bar: "#e0703f" },
  { bg: "#f3f6fb", line: "#d0daf0", bar: "#5b86c9" },
  { bg: "#f6f1fb", line: "#dcccf2", bar: "#7c5cd6" },
  { bg: "#f0f5fa", line: "#cddded", bar: "#4a86c4" },
  { bg: "#faf3ef", line: "#e9d2c4", bar: "#c46a3f" },
];

/** 按模板 mode 渲染不同版式的缩略图，seed 决定稳定配色（不随列表位置变化） */
function PreviewThumb({ seed, mode }: { seed: number; mode: Template["mode"] }) {
  const p = THUMB_PALETTES[seed % THUMB_PALETTES.length];
  const base = "h-24 w-full overflow-hidden rounded-lg border border-stone-100";

  if (mode === "slides") {
    return (
      <div className={base} style={{ backgroundColor: p.bg }}>
        <div className="p-3">
          <div className="h-2.5 w-20 rounded" style={{ backgroundColor: p.bar }} />
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 rounded" style={{ backgroundColor: p.line, opacity: 0.75 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (mode === "research") {
    const bars = [14, 26, 20, 34, 24];
    return (
      <div className={base} style={{ backgroundColor: p.bg }}>
        <div className="p-3">
          <div className="h-2 w-16 rounded" style={{ backgroundColor: p.bar }} />
          <div className="mt-2.5 flex items-end gap-1.5">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: h + ((seed >> i) % 8),
                  backgroundColor: i === 3 ? p.bar : p.line,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (mode === "image" || mode === "video") {
    return (
      <div className={`${base} relative`} style={{ backgroundColor: p.bg }}>
        <div className="flex items-center justify-center gap-2 p-3">
          <div className="relative h-16 flex-1 overflow-hidden rounded" style={{ backgroundColor: p.line, opacity: 0.8 }}>
            <span className="absolute left-2.5 top-2.5 h-3 w-3 rounded-full" style={{ backgroundColor: p.bar }} />
            <span
              className="absolute bottom-0 left-0 h-6 w-full"
              style={{ backgroundColor: p.bar, clipPath: "polygon(0 100%, 0 45%, 38% 80%, 62% 35%, 100% 75%, 100% 100%)", opacity: 0.55 }}
            />
          </div>
          <div className="h-16 w-6 rounded" style={{ backgroundColor: p.line }} />
        </div>
        {mode === "video" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: p.bar }}
            >
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
            </span>
          </span>
        )}
      </div>
    );
  }
  if (mode === "chat") {
    return (
      <div className={base} style={{ backgroundColor: p.bg }}>
        <div className="space-y-1.5 p-3">
          <div className="h-4 w-3/5 rounded-lg rounded-tl-sm" style={{ backgroundColor: p.line }} />
          <div className="ml-auto h-7 w-4/5 rounded-lg rounded-tr-sm" style={{ backgroundColor: p.bar, opacity: 0.8 }} />
          <div className="h-4 w-2/5 rounded-lg rounded-tl-sm" style={{ backgroundColor: p.line }} />
        </div>
      </div>
    );
  }
  // docs 及其他：文档正文版式
  return (
    <div className={base} style={{ backgroundColor: p.bg }}>
      <div className="space-y-1.5 p-3">
        <div className="h-2 w-16 rounded" style={{ backgroundColor: p.bar }} />
        <div className="h-1.5 w-full rounded" style={{ backgroundColor: p.line }} />
        <div className="h-1.5 w-5/6 rounded" style={{ backgroundColor: p.line }} />
        <div className="h-1.5 w-4/6 rounded" style={{ backgroundColor: p.line }} />
        <div className="mt-2 h-1.5 w-3/6 rounded" style={{ backgroundColor: p.line }} />
      </div>
      <div className="flex gap-1.5 px-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 flex-1 rounded" style={{ backgroundColor: p.line, opacity: 0.7 }} />
        ))}
      </div>
    </div>
  );
}

function UseTemplateModal({ state, onClose }: { state: UseTmplState | null; onClose: () => void }) {
  const router = useRouter();
  const { runTemplate } = useChatStore();
  const markUsed = usePromptStore((s) => s.markUsed);
  const [values, setValues] = useState<Record<string, string>>({});

  if (!state) return null;
  const tpl = state.tpl;
  const vars = extractVariables(tpl.prompt);
  const ui = CAT_UI[tpl.category];

  const setVal = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const start = async () => {
    if (vars.some((v) => !values[v]?.trim())) {
      toast("请先填写所有变量", "error");
      return;
    }
    const prompt = applyVariables(tpl.prompt, values);
    markUsed(tpl.id);
    onClose();
    toast(`已创建「${tpl.label}」任务，正在生成…`, "success");
    await runTemplate({ mode: tpl.mode, prompt });
    router.push("/chat");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="使用模板"
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${ui?.bg}`}>{ui?.icon}</span>
            <div>
              <h3 className="text-[15px] font-semibold text-stone-800">{tpl.label}</h3>
              <p className="text-[11px] text-stone-400">
                {CATEGORY_LABELS[tpl.category]} · {MODE_LABEL_OF[tpl.mode]}
                {!tpl.builtin && " · 我的模板"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-[12.5px] leading-6 text-stone-500">{tpl.desc}</p>

        {/* 模板详情 */}
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-stone-100 bg-stone-50 p-2.5 text-center text-[10.5px] text-stone-400">
          <div>
            <p className="flex items-center justify-center gap-0.5 text-[13px] font-semibold text-stone-700">
              <Star className="h-3 w-3 fill-current text-amber-400" />
              {scoreOf(tpl).rating}
            </p>
            评分
          </div>
          <div>
            <p className="text-[13px] font-semibold text-stone-700">{scoreOf(tpl).usage.toFixed(1)}k</p>
            使用次数
          </div>
          <div>
            <p className="text-[13px] font-semibold text-stone-700">{vars.length}</p>
            需填变量
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-stone-100 bg-[#fbf8f4] p-2.5">
          <p className="text-[11px] font-medium text-stone-400">示例输出 · {MODE_LABEL_OF[tpl.mode]}</p>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-[11.5px] leading-5 text-stone-500">
            {SAMPLE_OUTPUT[tpl.mode] ?? "（按你的输入生成对应内容）"}
          </pre>
        </div>
        <div className="mt-4 space-y-3">
          {vars.length === 0 ? (
            <p className="rounded-lg bg-[#fbf3ec] px-3 py-2 text-[12px] text-[#c05f3c]">此模板无需额外信息，点击开始将直接生成。</p>
          ) : (
            vars.map((v) => (
              <label key={v} className="block">
                <span className="mb-1 block text-[12px] font-medium text-stone-600">「{v}」</span>
                <input
                  value={values[v] ?? ""}
                  onChange={(e) => setVal(v, e.target.value)}
                  placeholder={`请输入${v}`}
                  className="w-full rounded-xl border border-[#ece6db] bg-white px-3 py-2 text-[13px] text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-[#e0b79c]"
                />
              </label>
            ))
          )}
        </div>
        <button
          onClick={() => void start()}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 py-2.5 text-[13px] font-medium text-white shadow-sm transition hover:brightness-105"
        >
          <Sparkles className="h-4 w-4" /> 开始使用
        </button>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const storedCustom = usePromptStore((s) => s.custom);
  const addCustom = usePromptStore((s) => s.addCustom);
  // 自建模板存在 localStorage，服务端渲染时读不到；挂载后再使用，避免水合不一致
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const custom = useMemo(() => (mounted ? storedCustom : []), [mounted, storedCustom]);
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => setFavs(loadFavs()), []);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((i) => i !== id) : [id, ...favs];
    setFavs(next);
    writeJSON(FAV_KEY, next);
    toast(next.includes(id) ? "已收藏，可在「我的收藏」里查看" : "已取消收藏", "success");
  };

  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [modal, setModal] = useState<UseTmplState | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [myOpen, setMyOpen] = useState(false);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [recOffset, setRecOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_STEP);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sceneOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sceneRef.current && !sceneRef.current.contains(e.target as Node)) setSceneOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sceneOpen]);

  /** 内置模板 + 我的自建模板（自建排在前） */
  const all = useMemo(() => [...custom, ...TEMPLATES], [custom]);

  const categoryCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of all) m[t.category] = (m[t.category] ?? 0) + 1;
    return m;
  }, [all]);

  const list = useMemo(() => {
    let arr = all;
    if (cat) arr = arr.filter((t) => t.category === cat);
    if (tab === 3) arr = arr.filter((t) => favs.includes(t.id));
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q) ||
          t.prompt.toLowerCase().includes(q)
      );
    }
    arr = [...arr];
    if (tab === 0) arr.sort((a, b) => scoreOf(b).usage - scoreOf(a).usage);
    else if (tab === 1)
      arr.sort((a, b) => Number(b.id.startsWith("custom-")) - Number(a.id.startsWith("custom-")) || b.id.localeCompare(a.id));
    else if (tab === 2) arr.sort((a, b) => Number(scoreOf(b).rating) - Number(scoreOf(a).rating));
    return arr;
  }, [all, cat, query, tab, favs]);

  const visible = list.slice(0, limit);
  const hasMore = list.length > visible.length;

  const recs = useMemo(() => {
    if (all.length === 0) return [];
    return Array.from({ length: Math.min(5, all.length) }, (_, i) => all[(recOffset + i) % all.length]);
  }, [all, recOffset]);

  const openUse = (t: Template) => setModal({ tpl: t, values: {} });

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4] text-stone-800">
      <ShellSidebar active="templates" />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#f0eadf] bg-[#fbf8f4] px-6 py-4">
          <div>
            <h1 className="text-[18px] font-semibold text-stone-900">模板中心</h1>
            <p className="mt-0.5 text-[12.5px] text-stone-400">精选各类专业模板，助你高效完成各类工作</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => router.push("/apps")}
              title="更多应用"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white hover:text-stone-700"
            >
              <LayoutGrid className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="ml-2 flex items-center gap-1.5 rounded-xl border border-[#f0c9a8] bg-white px-4 py-2 text-[13px] font-medium text-[#c05f3c] transition hover:bg-[#fdeee1]"
            >
              <Plus className="h-4 w-4" /> 提交模板
            </button>
          </div>
        </header>

        {/* 内容 */}
        <div className="flex min-h-0 flex-1 overflow-hidden px-6 pb-6 pt-5">
          {/* 主区域 */}
          <div className="min-w-0 flex-1 overflow-y-auto pr-4">
            {/* 搜索 + 筛选 */}
            <div className="flex gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#ece6db] bg-white px-3 py-2.5 text-stone-400">
                <Search className="h-4 w-4" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLimit(PAGE_STEP);
                  }}
                  placeholder="搜索模板名称、描述或关键词"
                  className="w-full bg-transparent text-[13px] text-stone-700 outline-none placeholder:text-stone-400"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-stone-300 hover:text-stone-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {/* 场景筛选：真实过滤列表 */}
              <div className="relative" ref={sceneRef}>
                <button
                  onClick={() => setSceneOpen((v) => !v)}
                  className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-[13px] transition ${
                    cat ? "border-[#e0b79c] text-[#c05f3c]" : "border-[#ece6db] text-stone-600 hover:border-[#e0b79c] hover:text-[#c05f3c]"
                  }`}
                >
                  <Filter className="h-4 w-4" /> {cat ? CATEGORY_LABELS[cat as never] ?? cat : "全部场景"}{" "}
                  <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition ${sceneOpen ? "rotate-180" : ""}`} />
                </button>
                {sceneOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-80 w-52 overflow-y-auto rounded-xl border border-[#ece6db] bg-white p-1.5 shadow-xl">
                    <button
                      onClick={() => {
                        setCat(null);
                        setLimit(PAGE_STEP);
                        setSceneOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] transition hover:bg-[#fdfaf5] ${
                        cat === null ? "text-[#c05f3c]" : "text-stone-600"
                      }`}
                    >
                      全部场景 <span className="text-[11px] text-stone-400">{all.length}</span>
                    </button>
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCat(c.id);
                          setLimit(PAGE_STEP);
                          setSceneOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] transition hover:bg-[#fdfaf5] ${
                          cat === c.id ? "text-[#c05f3c]" : "text-stone-600"
                        }`}
                      >
                        <span>
                          {CAT_UI[c.id]?.icon} {c.label}
                        </span>
                        <span className="text-[11px] text-stone-400">{categoryCount[c.id] ?? 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 按场景分类 */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-stone-800">按场景分类</h2>
                <button
                  onClick={() => {
                    setCat(null);
                    setLimit(PAGE_STEP);
                  }}
                  className="flex items-center gap-1 text-[12.5px] text-stone-400 transition hover:text-[#c05f3c]"
                >
                  查看全部 <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 lg:grid-cols-6">
                {CATEGORIES.slice(0, 6).map((c) => {
                  const ui = CAT_UI[c.id];
                  const active = cat === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCat(active ? null : c.id);
                        setLimit(PAGE_STEP);
                      }}
                      className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
                        active ? "border-[#f0c9a8] bg-[#fdf1e3]" : "border-[#ece6db] bg-white"
                      }`}
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${ui?.bg}`}>{ui?.icon}</span>
                      <p className={`mt-2 text-[13px] font-semibold ${active ? "text-[#c05f3c]" : "text-stone-800"}`}>{c.label}</p>
                      <p className="mt-1 text-[11px] leading-4 text-stone-400">{categoryCount[c.id] ?? 0} 个模板</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 模板列表 */}
            <div className="mt-5">
              <div className="border-b border-[#efe9dd]">
                <div className="flex gap-5">
                  {TABS.map((t, i) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTab(i);
                        setLimit(PAGE_STEP);
                      }}
                      className={`relative pb-3 pt-1 text-[13px] ${i === tab ? "font-medium text-[#c05f3c]" : "text-stone-500 transition hover:text-stone-800"}`}
                    >
                      {t}
                      {t === "热门模板" && <span className="ml-1 text-[10px] text-orange-400">🔥</span>}
                      {i === tab && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#f07a3f]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {visible.map((t) => {
                  const sc = scoreOf(t);
                  return (
                    <div
                      key={t.id}
                      onClick={() => openUse(t)}
                      className="relative cursor-pointer rounded-2xl border border-[#ece6db] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition hover:shadow-md"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFav(t.id);
                        }}
                        title={favs.includes(t.id) ? "取消收藏" : "收藏模板"}
                        className={`absolute right-2.5 top-2.5 z-10 rounded-lg bg-white/90 p-1 transition ${
                          favs.includes(t.id) ? "text-red-400" : "text-stone-300 hover:text-red-300"
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${favs.includes(t.id) ? "fill-current" : ""}`} />
                      </button>
                      <PreviewThumb seed={hashOf(t.id)} mode={t.mode} />
                      <p className="mt-3 flex items-center gap-1 text-[13.5px] font-semibold text-stone-800">
                        <span className="truncate">{t.label}</span>
                        {!t.builtin && (
                          <span className="shrink-0 rounded bg-[#fdf1e3] px-1 py-px text-[9px] font-normal text-[#c05f3c]">我的</span>
                        )}
                      </p>
                      <p className="mt-1 min-h-[36px] text-xs leading-5 text-stone-400">{t.desc}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-stone-400">
                        <span className="rounded-md bg-[#fbf3ec] px-1.5 py-0.5 font-medium text-[#c05f3c]">{CATEGORY_LABELS[t.category]}</span>
                        <span className="text-[10px] text-stone-400">{MODE_LABEL_OF[t.mode]}</span>
                        <span className="flex items-center gap-0.5 text-amber-400">
                          <Star className="h-3 w-3 fill-current" />
                          {sc.rating}
                        </span>
                        <span className="ml-auto">{sc.usage.toFixed(1)}k 使用</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {list.length === 0 && <div className="py-16 text-center text-sm text-stone-400">没有找到匹配的模板</div>}

              {hasMore && (
                <button
                  onClick={() => setLimit((l) => l + PAGE_STEP)}
                  className="mx-auto mt-5 flex items-center gap-1 rounded-full border border-[#ece6db] bg-white px-4 py-2 text-[12.5px] text-stone-500 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                >
                  查看更多模板 <ChevronDown className="h-3.5 w-3.5" />
                </button>
              )}
              {!hasMore && list.length > PAGE_STEP && (
                <button
                  onClick={() => setLimit(PAGE_STEP)}
                  className="mx-auto mt-5 flex items-center gap-1 rounded-full border border-[#ece6db] bg-white px-4 py-2 text-[12.5px] text-stone-400 transition hover:text-[#c05f3c]"
                >
                  收起
                </button>
              )}
            </div>
          </div>

          {/* 右侧面板 */}
          <aside className="hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#ece6db] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] xl:flex">
            {/* 推荐模板 */}
            <div className="border-b border-[#f0eadf] p-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-stone-800">
                  <Sparkles className="h-4 w-4 text-orange-500" />推荐模板
                </p>
                <button
                  onClick={() => setRecOffset((o) => (o + 5) % Math.max(1, all.length))}
                  className="text-[11px] text-stone-400 transition hover:text-[#c05f3c]"
                >
                  换一批
                </button>
              </div>
              <div className="mt-3 space-y-1">
                {recs.map((t) => {
                  const ui = CAT_UI[t.category];
                  const sc = scoreOf(t);
                  return (
                    <button key={t.id} onClick={() => openUse(t)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[#fdfaf5]">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${ui?.bg}`}>{ui?.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-stone-700">{t.label}</span>
                        <span className="block text-[10px] text-stone-400">{CATEGORY_LABELS[t.category]}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-amber-400">
                        <Star className="h-3 w-3 fill-current" />
                        {sc.rating}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 我的模板 */}
            <div className="border-b border-[#f0eadf] p-5">
              <p className="text-[14px] font-semibold text-stone-800">我的模板</p>
              <div className="mt-3 space-y-1">
                {custom.length === 0 && (
                  <p className="px-2 py-2 text-[11.5px] leading-5 text-stone-400">
                    还没有自建模板，点「提交模板」把你常用的提示词存成模板。
                  </p>
                )}
                {custom.slice(0, 3).map((t) => {
                  const ui = CAT_UI[t.category];
                  return (
                    <button key={t.id} onClick={() => openUse(t)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[#fdfaf5]">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ui?.bg}`}>
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-stone-700">{t.label}</span>
                        <span className="block text-[10px] text-stone-400">
                          {CATEGORY_LABELS[t.category]} · {MODE_LABEL_OF[t.mode]}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setMyOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 text-[12px] text-[#c05f3c] transition hover:opacity-80"
                >
                  查看全部（{custom.length}） <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* 提交模板 */}
            <div className="p-5">
              <p className="text-[14px] font-semibold text-stone-800">没有找到合适的模板？</p>
              <p className="mt-1 text-[12px] text-stone-400">提交你的模板，与更多人分享</p>
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#f0c9a8] bg-white py-2.5 text-[13px] font-medium text-[#c05f3c] transition hover:bg-[#fdeee1]"
              >
                <Plus className="h-4 w-4" /> 提交模板
              </button>
            </div>
          </aside>
        </div>
      </main>

      <UseTemplateModal state={modal} onClose={() => setModal(null)} />
      {createOpen && (
        <CreateTemplateModal
          onClose={() => setCreateOpen(false)}
          onSave={(p) => {
            addCustom(p);
            setCreateOpen(false);
            toast(`模板「${p.label}」已保存到我的模板`, "success");
          }}
        />
      )}
      {myOpen && <MyTemplatesModal onClose={() => setMyOpen(false)} onUse={(t) => { setMyOpen(false); openUse(t); }} />}
      <Toaster />
    </div>
  );
}
