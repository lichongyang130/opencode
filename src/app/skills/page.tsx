"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Clapperboard,
  Layout,
  Mic,
  PenLine,
  Plus,
  Search,
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
  removeCustomSkill,
  saveCustomSkill,
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

const CATS = ["全部", "写作", "演示", "视觉"] as const;

export default function SkillsPage() {
  const router = useRouter();
  const { newConversation, selectConversation } = useChatStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("全部");
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState(false);
  const [draft, setDraft] = useState({ label: "", desc: "", system: "", task: "", cat: "写作" as SkillCat, mode: "docs" as WorkspaceMode });

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

  const list = useMemo(() => {
    const s = q.trim();
    return skills.filter((x) => {
      if (cat !== "全部" && x.cat !== cat) return false;
      if (!s) return true;
      return `${x.label}${x.desc}${x.cat}${x.system}`.includes(s);
    });
  }, [q, cat, skills]);

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
    const key = `custom-${Date.now()}`;
    saveCustomSkill({
      key,
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
    <div className="flex h-screen overflow-hidden bg-[#fbf8f2] text-stone-800">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-7 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[32px] font-extrabold tracking-tight text-stone-900">技能</h1>
          <button
            type="button"
            onClick={() => setForm(true)}
            className="inline-flex items-center gap-1 rounded-full bg-stone-800 px-4 py-1.5 text-[13px] text-white"
          >
            <Plus className="h-3.5 w-3.5" /> 自定义技能
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 ring-1 ring-stone-200">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索技能"
              className="w-full bg-transparent text-[14px] outline-none"
            />
            <Search className="h-4 w-4 text-stone-400" />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium ${
                  cat === c
                    ? "bg-stone-800 text-white"
                    : c === "写作"
                      ? "bg-white text-emerald-700 ring-1 ring-emerald-300"
                      : c === "演示"
                        ? "bg-white text-rose-700 ring-1 ring-rose-300"
                        : c === "视觉"
                          ? "bg-white text-amber-700 ring-1 ring-amber-300"
                          : "bg-white text-stone-600 ring-1 ring-stone-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 && <p className="mt-8 text-[13px] text-stone-500">没有匹配的技能。</p>}

        <div className="mt-6 grid gap-4 pb-12 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const prog = progressOf(s.key);
            const Icon = ICONS[s.key] ?? PenLine;
            return (
              <article key={s.key} className="flex flex-col rounded-[22px] border border-stone-200/80 bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbf3ec] text-[#e07a2f]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="text-[18px] font-semibold text-stone-900">{s.label}</h2>
                </div>
                <p className="mt-3 min-h-[72px] text-[13px] leading-6 text-stone-500">{s.desc}</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-[#e07a2f]" style={{ width: `${prog.pct}%` }} />
                  </div>
                  <span className="text-[12px] text-stone-500">{prog.level}</span>
                </div>
                <p className="mt-1 text-[11px] text-stone-400">本机练习 {prog.uses} 次 · 按开始使用与发送次数累计</p>
                <button
                  type="button"
                  onClick={() => setOpen(s.key)}
                  className="mt-4 w-full rounded-full border border-stone-200 py-2 text-[13px] text-stone-700 hover:border-[#e07a2f]"
                >
                  查看详情
                </button>
              </article>
            );
          })}
        </div>
      </main>

      {current && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setOpen(null)}>
          <div className="w-full max-w-[560px] rounded-[24px] bg-[#fbf8f2] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbf3ec] text-[#e07a2f]">
                {(() => {
                  const Icon = ICONS[current.key] ?? PenLine;
                  return <Icon className="h-6 w-6" />;
                })()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[20px] font-bold text-stone-900">{current.label}</p>
                <p className="text-[13px] text-stone-500">
                  {current.cat} · {progressOf(current.key).level}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(null)} aria-label="关闭">
                <X className="h-5 w-5 text-stone-400" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-[14px] leading-7 text-stone-700">
              {current.detail.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void start(current)}
                className="rounded-full bg-[#c45c2a] px-5 py-2 text-[13px] font-semibold text-white"
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
