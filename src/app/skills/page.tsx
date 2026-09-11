"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Clapperboard,
  Layout,
  Mic,
  PenLine,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { useChatStore, type WorkspaceMode } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";

type Cat = "写作" | "演示" | "视觉";
type Level = "精通" | "进阶" | "入门";

const SKILLS: {
  key: string;
  label: string;
  desc: string;
  detail: string[];
  cat: Cat;
  mode: WorkspaceMode;
  icon: LucideIcon;
  level: Level;
  pct: number;
}[] = [
  {
    key: "copy",
    label: "文案写作",
    desc: "标题、种草、方案与商务邮件。先钩子再结构，一次给多个版本。",
    detail: [
      "适合广告、社媒、邮件和方案里的文字。会先问对象与渠道，再给标题和正文。",
      "输出：多版标题、钩子-利益-行动正文、禁用未验证功效。",
      "不适合：把未测参数写成卖点。",
    ],
    cat: "写作",
    mode: "docs",
    icon: PenLine,
    level: "精通",
    pct: 92,
  },
  {
    key: "speech",
    label: "演讲技巧",
    desc: "开场、停顿、翻页与收束。把稿子改成能讲的节奏。",
    detail: [
      "适合发布、述职和路演。会标强攻页与带过页，控制时间。",
      "输出：口播稿、时间切分、可能被追问的三题。",
      "不适合：只要一张装饰封面。",
    ],
    cat: "演示",
    mode: "slides",
    icon: Mic,
    level: "进阶",
    pct: 68,
  },
  {
    key: "ui",
    label: "界面设计",
    desc: "信息架构、状态与空态。先流程再视觉，不堆装饰。",
    detail: [
      "适合后台、工作台和活动页。会给关键路径与组件清单。",
      "输出：页面清单、状态表、一页一意的示意。",
      "不适合：要未提供的像素终稿冒充已开发。",
    ],
    cat: "视觉",
    mode: "image",
    icon: Layout,
    level: "精通",
    pct: 46,
  },
  {
    key: "video",
    label: "视频编辑",
    desc: "分镜、时长、字幕与导出规格。先脚本再镜头。",
    detail: [
      "适合产品演示和短视频口播。会写镜头表和字幕节奏。",
      "输出：分镜、旁白、B-roll 清单。",
      "不适合：承诺未拍摄素材已成片。",
    ],
    cat: "视觉",
    mode: "video",
    icon: Clapperboard,
    level: "精通",
    pct: 58,
  },
  {
    key: "data",
    label: "数据分析",
    desc: "先口径再结论。漏斗、对比与可跑的汇总思路。",
    detail: [
      "适合运营周报和实验解读。未知数据标待核实，不编造显著。",
      "输出：口径、假设、图表建议、SQL 示意。",
      "不适合：要未提供数仓的真实结果。",
    ],
    cat: "写作",
    mode: "research",
    icon: BarChart3,
    level: "进阶",
    pct: 54,
  },
  {
    key: "pm",
    label: "项目管理",
    desc: "里程碑、依赖、风险与负责人。会议要有产出。",
    detail: [
      "适合版本节奏和跨部门接口。缓冲公开，完成度不编造。",
      "输出：里程碑、RACI、风险黄灯。",
      "不适合：只要愿景海报。",
    ],
    cat: "演示",
    mode: "docs",
    icon: Calendar,
    level: "进阶",
    pct: 50,
  },
];

const CATS = ["全部", "写作", "演示", "视觉"] as const;

export default function SkillsPage() {
  const router = useRouter();
  const { newConversation, selectConversation } = useChatStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("全部");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim();
    return SKILLS.filter((x) => {
      if (cat !== "全部" && x.cat !== cat) return false;
      if (!s) return true;
      return `${x.label}${x.desc}${x.cat}`.includes(s);
    });
  }, [q, cat]);

  const current = SKILLS.find((x) => x.key === open) ?? null;

  const start = async (mode: WorkspaceMode, label: string, hint?: string) => {
    const id = await newConversation(mode);
    await selectConversation(id);
    toast(`已打开「${label}」技能`, "success");
    router.push(hint ? `/chat?skill=${encodeURIComponent(label)}` : "/chat");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f2] text-stone-800">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-7 lg:px-10">
        <h1 className="text-[32px] font-extrabold tracking-tight text-stone-900">技能</h1>

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
          {list.map((s) => (
            <article key={s.key} className="flex flex-col rounded-[22px] border border-stone-200/80 bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbf3ec] text-[#e07a2f]">
                  <s.icon className="h-5 w-5" />
                </span>
                <h2 className="text-[18px] font-semibold text-stone-900">{s.label}</h2>
              </div>
              <p className="mt-3 min-h-[72px] text-[13px] leading-6 text-stone-500">{s.desc}</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-[#e07a2f]" style={{ width: `${s.pct}%` }} />
                </div>
                <span className="text-[12px] text-stone-500">{s.level}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(s.key)}
                className="mt-4 w-full rounded-full border border-stone-200 py-2 text-[13px] text-stone-700 hover:border-[#e07a2f]"
              >
                查看详情
              </button>
            </article>
          ))}
        </div>
      </main>

      {current && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setOpen(null)}>
          <div className="w-full max-w-[560px] rounded-[24px] bg-[#fbf8f2] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbf3ec] text-[#e07a2f]">
                <current.icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[20px] font-bold text-stone-900">{current.label}</p>
                <p className="text-[13px] text-stone-500">
                  {current.cat} · {current.level}
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
                onClick={() => void start(current.mode, current.label)}
                className="rounded-full bg-[#c45c2a] px-5 py-2 text-[13px] font-semibold text-white"
              >
                开始使用
              </button>
              <button type="button" onClick={() => setOpen(null)} className="rounded-full px-4 py-2 text-[13px] text-stone-500">
                返回
              </button>
            </div>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
