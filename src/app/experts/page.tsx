"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/workspace/Sidebar";
import { PERSONAS, PERSONA_GROUPS, type Persona } from "@/lib/personas";
import { useChatStore } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";

const FACE: Record<string, string> = {
  "marketing-strategist": "/cases/experts/hero-week.jpg",
  copywriter: "/cases/experts/p-copy.jpg",
  writer: "/cases/experts/p-copy.jpg",
  editor: "/cases/experts/p-copy.jpg",
  translator: "/cases/experts/p-copy.jpg",
  pm: "/cases/experts/p-pm.jpg",
  hr: "/cases/experts/p-pm.jpg",
  "data-analyst": "/cases/experts/p-pm.jpg",
  legal: "/cases/experts/p-pm.jpg",
  "code-reviewer": "/cases/experts/p-code.jpg",
  "interviewer-tech": "/cases/experts/p-code.jpg",
  travel: "/cases/experts/p-travel.jpg",
  psychologist: "/cases/experts/p-travel.jpg",
  english: "/cases/experts/p-travel.jpg",
  chef: "/cases/experts/p-chef.jpg",
  tutor: "/cases/experts/p-chef.jpg",
};

const PITCH: Record<string, string> = {
  "marketing-strategist": "把 Campaign 拆成可执行的周计划：定位、渠道、节奏与衡量，不说空话。",
  copywriter: "开头三秒有钩子。标题、正文、结尾各司其职，一次给多个版本。",
  translator: "中英互译信达雅。商务正式，营销留情绪。有歧义会括号备注。",
  writer: "小说、散文、诗歌。帮你长人物、磨对白、改视角，不堆辞藻。",
  editor: "先总评，再逐条原文→建议，最后给改稿。逻辑与错字一起过。",
  pm: "背景、用户故事、优先级、验收标准、边界，写成能开发的 PRD。",
  "data-analyst": "先口径再结论。漏斗、同期群、假设与验证，SQL 可跑。",
  hr: "简历量化、JD、模拟面试与谈薪，两边视角都给。",
  legal: "指出风险条款与不利表述。非执业意见，大事仍要律师。",
  tutor: "不直接喂答案。提问、类比、再检查你是否真懂。",
  english: "英文对话练习。每轮纠错、地道说法、可套句型。",
  "code-reviewer": "正确性、边界、可读、性能、安全。指出问题给改法，不臆造 API。",
  "interviewer-tech": "一次一题，逐步追问，结束给评价与改进。",
  chef: "按手头食材出菜谱：份量、步骤、用时与营养要点。",
  psychologist: "先听，再拆想法与事实。非医疗，严重情况建议专业帮助。",
  travel: "按天排行程、交通、预算与避坑，节奏不赶场。",
};

export default function ExpertsPage() {
  const router = useRouter();
  const { newConversation, selectConversation, setPersona } = useChatStore();
  const [group, setGroup] = useState<(typeof PERSONA_GROUPS)[number] | "全部">("全部");
  const [picked, setPicked] = useState("marketing-strategist");

  const all = useMemo(() => PERSONAS.filter((p) => p.id !== "none"), []);
  const rail = useMemo(
    () => all.filter((p) => group === "全部" || p.group === group),
    [all, group],
  );
  const featured = all.find((p) => p.id === picked) ?? rail[0] ?? all[0];
  const heroSrc = (featured && FACE[featured.id]) || "/cases/experts/hero-week.jpg";

  const start = async (p: Persona) => {
    const cid = await newConversation("chat");
    await selectConversation(cid);
    setPersona(p.id);
    toast(`已进入「${p.name}」专家对话`, "success");
    router.push("/chat");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6efe4] text-stone-800">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-6 py-7 lg:px-10">
          <p className="text-[12px] font-medium tracking-[0.2em] text-[#c45c2a]">EXPERTS</p>
          <h1 className="mt-1 text-[36px] font-extrabold tracking-tight text-stone-900">专家</h1>
          <p className="mt-1 text-[13px] text-stone-500">点头像换本周主视觉，再开始对话。</p>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {(["全部", ...PERSONA_GROUPS] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                  group === g ? "bg-[#c45c2a] text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {featured && (
            <div className="relative mt-6 aspect-[16/5] min-h-[240px] overflow-hidden rounded-[22px] bg-stone-900 shadow-[0_24px_60px_-28px_rgba(80,40,10,0.45)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroSrc} alt="" className="absolute inset-0 h-full w-full object-cover object-[68%_28%]" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/40 to-black/10" />
              <div className="relative z-[1] flex h-full max-w-xl flex-col justify-end px-8 py-8">
                <p className="text-[12px] tracking-[0.28em] text-[#e2c48a]">
                  本周专家 · {featured.group}
                </p>
                <h2 className="mt-2 text-[32px] font-semibold tracking-tight text-white">{featured.name}</h2>
                <p className="mt-2 text-[14px] leading-7 text-white/80">
                  {PITCH[featured.id] || featured.desc}
                </p>
                {featured.starter && (
                  <p className="mt-2 line-clamp-1 text-[12px] text-white/55">示例：{featured.starter}</p>
                )}
                <button
                  type="button"
                  onClick={() => void start(featured)}
                  className="mt-5 w-fit rounded-full bg-gradient-to-r from-orange-400 to-red-500 px-5 py-2 text-[13px] font-semibold text-white"
                >
                  开始对话
                </button>
              </div>
            </div>
          )}

          <h3 className="mt-8 text-[13px] font-semibold tracking-wide text-stone-500">全部专家</h3>
          <div className="mt-4 flex gap-5 overflow-x-auto pb-6 pt-1">
            {rail.map((p) => {
              const on = featured?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPicked(p.id)}
                  className="group flex w-[92px] shrink-0 flex-col items-center text-center"
                >
                  <span
                    className={`relative h-[72px] w-[72px] overflow-hidden rounded-full shadow-md ring-2 transition ${
                      on ? "ring-[#c45c2a] ring-offset-2 ring-offset-[#f6efe4]" : "ring-white group-hover:ring-[#e0b79c]"
                    }`}
                  >
                    {FACE[p.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={FACE[p.id]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[#fbf3ec] text-[28px]">{p.emoji}</span>
                    )}
                  </span>
                  <span className="mt-2 line-clamp-2 text-[12px] font-medium leading-4 text-stone-700">{p.name}</span>
                  <span className="mt-0.5 text-[10px] text-[#c45c2a]">{p.group}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
