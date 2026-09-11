"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Clapperboard,
  Heart,
  Layout,
  Mic,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { useChatStore, type WorkspaceMode } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import {
  SKILL_CHANGE_EVENT,
  allSkills,
  launchSkill,
  progressOf,
  readFav,
  readRecent,
  removeCustomSkill,
  saveCustomSkill,
  toggleFav,
  type SkillCat,
  type SkillDef,
} from "@/lib/skillsHub";

const ICONS: Record<string, LucideIcon> = {
  copy: PenLine,
  speech: Mic,
  ui: Layout,
  video: Clapperboard,
  data: BarChart3,
  pm: Calendar,
};

const COVERS: Record<string, string> = {
  copy: "/skills/cover-copy.jpg",
  speech: "/skills/cover-speech.jpg",
  ui: "/skills/cover-ui.jpg",
  video: "/skills/cover-video.jpg",
  data: "/skills/cover-data.jpg",
  pm: "/skills/cover-pm.jpg",
};

const SAMPLES: Record<string, string> = {
  copy: "3 个标题 + 一条钩子-利益-行动正文",
  speech: "12 分钟口播：开场 / 强攻 / 收束",
  ui: "列表 → 编辑 → 空态 关键路径",
  video: "15 秒分镜：画面 / 旁白 / 字幕",
  data: "口径定义 + 三周对比画法",
  pm: "4 里程碑 + 黄灯风险",
};

const CAT_TONE: Record<SkillCat | "全部", string> = {
  全部: "bg-stone-800 text-white",
  写作: "text-emerald-800 ring-1 ring-emerald-300 bg-white",
  演示: "text-rose-800 ring-1 ring-rose-300 bg-white",
  视觉: "text-amber-800 ring-1 ring-amber-300 bg-white",
};

const CATS = ["全部", "写作", "演示", "视觉", "最近", "收藏"] as const;

const MODE_TAG: Record<SkillDef["mode"], string> = {
  docs: "文档",
  slides: "PPT",
  image: "图片",
  video: "视频",
  research: "研究",
  chat: "对话",
};

export default function SkillsPage() {
  const router = useRouter();
  const { newConversation, selectConversation } = useChatStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("全部");
  const [heroIdx, setHeroIdx] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState(false);
  const [draft, setDraft] = useState({
    label: "",
    desc: "",
    system: "",
    task: "",
    cat: "写作" as SkillCat,
    mode: "docs" as WorkspaceMode,
  });

  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    window.addEventListener(SKILL_CHANGE_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(SKILL_CHANGE_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const skills = useMemo(() => allSkills(), [tick]);
  const fav = useMemo(() => readFav(), [tick]);
  const recent = useMemo(() => readRecent(), [tick]);

  const list = useMemo(() => {
    const s = q.trim();
    return skills.filter((x) => {
      if (cat === "收藏") {
        if (!fav.includes(x.key)) return false;
      } else if (cat === "最近") {
        if (!recent.includes(x.key)) return false;
      } else if (cat !== "全部" && x.cat !== cat) return false;
      if (!s) return true;
      return `${x.label}${x.desc}${x.cat}${x.system}`.includes(s);
    });
  }, [q, cat, skills, fav, recent]);

  const featured = skills[heroIdx % Math.max(skills.length, 1)] ?? skills[0];

  const catCount = (c: (typeof CATS)[number]) => {
    if (c === "全部") return skills.length;
    if (c === "收藏") return fav.length;
    if (c === "最近") return recent.length;
    return skills.filter((x) => x.cat === c).length;
  };

  const practiced = skills.filter((s) => progressOf(s.key).uses > 0).length;
  const current = skills.find((x) => x.key === open) ?? null;

  const start = async (s: SkillDef) => {
    launchSkill(s);
    const id = await newConversation(s.mode);
    await selectConversation(id);
    toast(`已带上「${s.label}」技能提示词`, "success");
    router.push("/chat");
  };

  const addCustom = () => {
    const label = draft.label.trim();
    if (!label || !draft.system.trim()) {
      toast("请填写名称和系统提示", "error");
      return;
    }
    saveCustomSkill({
      key: `custom-${Date.now()}`,
      label,
      desc: draft.desc.trim() || "自定义技能",
      detail: [draft.desc.trim() || "本地自定义技能，只保存在本机。"],
      cat: draft.cat,
      mode: draft.mode,
      system: draft.system.trim(),
      draft: draft.task.trim() || `请按「${label}」技能帮我完成任务。`,
      custom: true,
    });
    setForm(false);
    setDraft({ label: "", desc: "", system: "", task: "", cat: "写作", mode: "docs" });
    toast("已添加自定义技能", "success");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4eee4] text-stone-800">
      <Sidebar />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(closest-side,rgba(196,92,42,0.12),transparent_70%)]" />
        <div className="relative mx-auto max-w-[1180px] px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c45c2a]">Studio</p>
              <h1 className="mt-1 text-[36px] font-extrabold tracking-tight text-stone-900">技能</h1>
              <p className="mt-1 text-[14px] text-stone-500">选一种产出方式。开始使用会带上该技能的系统提示与任务草稿。</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-[13px] text-white shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> 自定义技能
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-[12px] text-stone-500">
            <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-stone-200">{skills.length} 项技能</span>
            <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-stone-200">已练习 {practiced} 项</span>
            <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-stone-200">进度按本机使用次数</span>
          </div>

          {featured && (
            <section className="mt-7 overflow-hidden rounded-[28px] bg-[#2b2118] text-[#f6efe4] shadow-[0_24px_50px_-28px_rgba(43,33,24,0.7)]">
              <div className="grid md:grid-cols-[1.15fr_0.85fr]">
                <div className="p-7 lg:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8a06a]">推荐上手</p>
                    <button
                      type="button"
                      onClick={() => setHeroIdx((n) => n + 1)}
                      className="inline-flex items-center gap-1 text-[12px] text-stone-400 hover:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> 换一个
                    </button>
                  </div>
                  <h2 className="mt-2 text-[28px] font-bold tracking-tight">{featured.label}</h2>
                  <p className="mt-2 max-w-xl text-[14px] leading-7 text-stone-300">{featured.desc}</p>
                  <p className="mt-3 text-[12px] text-[#e8a06a]">{SAMPLES[featured.key] ?? "带系统提示进入对话"}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void start(featured)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#e07a2f] px-5 py-2.5 text-[13px] font-semibold text-white"
                    >
                      立即使用 <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(featured.key)}
                      className="rounded-full px-4 py-2.5 text-[13px] text-stone-300 ring-1 ring-white/20"
                    >
                      查看详情
                    </button>
                  </div>
                </div>
                <div className="relative min-h-[180px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={COVERS[featured.key] ?? "/skills/cover-copy.jpg"}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#2b2118]/40 md:bg-gradient-to-l md:from-transparent md:to-[#2b2118]/55" />
                </div>
              </div>
            </section>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-sm ring-1 ring-stone-200">
              <Search className="h-4 w-4 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索技能、用途或提示词"
                className="w-full bg-transparent text-[14px] outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                    cat === c ? "bg-stone-900 text-white shadow-sm" : CAT_TONE[c as SkillCat | "全部"] ?? "bg-white text-stone-600 ring-1 ring-stone-200"
                  }`}
                >
                  {c} {catCount(c)}
                </button>
              ))}
            </div>
          </div>

          {recent.length > 0 && cat === "全部" && !q && (
            <div className="mt-6">
              <p className="text-[12px] font-semibold tracking-wide text-stone-500">最近用过</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {recent.map((key) => {
                  const s = skills.find((x) => x.key === key);
                  if (!s) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void start(s)}
                      className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] text-stone-700 ring-1 ring-stone-200 hover:border-[#e07a2f]"
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {list.length === 0 && <p className="mt-10 text-[13px] text-stone-500">没有匹配的技能。</p>}

          <div className="mt-6 space-y-10 pb-16">
            {(cat === "全部" && !q.trim() ? (["写作", "演示", "视觉"] as SkillCat[]) : [null]).map((section) => {
              const rows = section ? list.filter((x) => x.cat === section) : list;
              if (rows.length === 0) return null;
              return (
                <section key={section ?? cat}>
                  {section && (
                    <div className="mb-4 flex items-baseline justify-between">
                      <h2 className="text-[18px] font-bold text-stone-900">{section}</h2>
                      <button type="button" className="text-[12px] text-stone-400" onClick={() => setCat(section)}>
                        只看{section} · {rows.length}
                      </button>
                    </div>
                  )}
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {rows.map((s) => {
                      const prog = progressOf(s.key);
                      const Icon = ICONS[s.key] ?? Sparkles;
                      const cover = COVERS[s.key];
                      return (
                        <article
                          key={s.key}
                          className="group flex flex-col overflow-hidden rounded-[26px] border border-stone-200/80 bg-white shadow-[0_10px_30px_-22px_rgba(76,29,149,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(196,92,42,0.45)]"
                        >
                          <div className="relative h-[132px] overflow-hidden bg-[#fbf3ec]">
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Icon className="h-10 w-10 text-[#e07a2f]/70" />
                              </div>
                            )}
                            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] text-stone-600 backdrop-blur">
                              {s.cat} · {MODE_TAG[s.mode]}
                            </span>
                            <button
                              type="button"
                              aria-label="收藏"
                              onClick={() => toggleFav(s.key)}
                              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-400"
                            >
                              <Heart className={`h-4 w-4 ${fav.includes(s.key) ? "fill-[#c45c2a] text-[#c45c2a]" : ""}`} />
                            </button>
                          </div>
                          <div className="flex flex-1 flex-col p-5">
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fbf3ec] text-[#e07a2f]">
                                <Icon className="h-5 w-5" />
                              </span>
                              <h3 className="text-[18px] font-semibold text-stone-900">{s.label}</h3>
                            </div>
                            <p className="mt-3 min-h-[64px] text-[13px] leading-6 text-stone-500">{s.desc}</p>
                            <p className="mt-1 text-[12px] text-[#c45c2a]">{SAMPLES[s.key] ?? "自定义产出"}</p>
                            <div className="mt-4 flex items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                                <div className="h-full rounded-full bg-[#e07a2f]" style={{ width: `${Math.max(prog.pct, 6)}%` }} />
                              </div>
                              <span className="text-[12px] text-stone-500">{prog.level}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-stone-400">本机练习 {prog.uses} 次</p>
                            <div className="mt-4 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setOpen(s.key)}
                                className="flex-1 rounded-full border border-stone-200 py-2 text-[13px] text-stone-700 hover:border-[#e07a2f]"
                              >
                                查看详情
                              </button>
                              <button
                                type="button"
                                onClick={() => void start(s)}
                                className="rounded-full bg-[#c45c2a] px-4 py-2 text-[13px] font-semibold text-white"
                              >
                                使用
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>

      {current && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center" onClick={() => setOpen(null)}>
          <div className="w-full max-w-[640px] overflow-hidden rounded-[28px] bg-[#fbf8f2] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-40 bg-[#2b2118]">
              {COVERS[current.key] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={COVERS[current.key]} alt="" className="h-full w-full object-cover opacity-80" />
              )}
              <button type="button" onClick={() => setOpen(null)} aria-label="关闭" className="absolute right-3 top-3 rounded-full bg-black/35 p-1.5 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbf3ec] text-[#e07a2f]">
                  {(() => {
                    const Icon = ICONS[current.key] ?? Sparkles;
                    return <Icon className="h-6 w-6" />;
                  })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[22px] font-bold text-stone-900">{current.label}</p>
                  <p className="text-[13px] text-stone-500">
                    {current.cat} · {progressOf(current.key).level} · 练习 {progressOf(current.key).uses} 次
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-[14px] leading-7 text-stone-700">
                {current.detail.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c45c2a]">系统提示</p>
                <p className="mt-1 text-[13px] leading-6 text-stone-600">{current.system}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c45c2a]">任务草稿</p>
                <p className="mt-1 text-[13px] text-stone-600">{current.draft}</p>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => void start(current)}
                  className="rounded-full bg-[#c45c2a] px-5 py-2.5 text-[13px] font-semibold text-white"
                >
                  开始使用
                </button>
                {current.custom && (
                  <button
                    type="button"
                    onClick={() => {
                      removeCustomSkill(current.key);
                      setOpen(null);
                      toast("已删除自定义技能", "info");
                    }}
                    className="rounded-full px-4 py-2 text-[13px] text-red-500"
                  >
                    删除
                  </button>
                )}
                <button type="button" onClick={() => setOpen(null)} className="rounded-full px-4 py-2 text-[13px] text-stone-500">
                  返回
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setForm(false)}>
          <div className="w-full max-w-[480px] space-y-3 rounded-[24px] bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-[18px] font-bold">自定义技能</p>
            <input className="w-full rounded-xl border px-3 py-2 text-[13px]" placeholder="名称" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            <input className="w-full rounded-xl border px-3 py-2 text-[13px]" placeholder="简介" value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} />
            <textarea className="h-24 w-full rounded-xl border px-3 py-2 text-[13px]" placeholder="系统提示（必填）" value={draft.system} onChange={(e) => setDraft({ ...draft, system: e.target.value })} />
            <input className="w-full rounded-xl border px-3 py-2 text-[13px]" placeholder="开始任务草稿" value={draft.task} onChange={(e) => setDraft({ ...draft, task: e.target.value })} />
            <div className="flex gap-2">
              {(["写作", "演示", "视觉"] as SkillCat[]).map((c) => (
                <button key={c} type="button" onClick={() => setDraft({ ...draft, cat: c })} className={`rounded-full px-3 py-1 text-[12px] ${draft.cat === c ? "bg-stone-800 text-white" : "ring-1 ring-stone-200"}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(false)} className="text-[13px] text-stone-500">取消</button>
              <button type="button" onClick={addCustom} className="rounded-full bg-[#c45c2a] px-4 py-1.5 text-[13px] text-white">保存</button>
            </div>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
