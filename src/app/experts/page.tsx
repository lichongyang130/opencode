"use client";

import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/workspace/Sidebar";
import { PERSONAS, type Persona } from "@/lib/personas";
import { useChatStore } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";

const FEATURED_ID = "marketing-strategist";

const FACE: Record<string, string> = {
  "marketing-strategist": "/cases/experts/hero-week.jpg",
  copywriter: "/cases/experts/p-copy.jpg",
  writer: "/cases/experts/p-copy.jpg",
  editor: "/cases/experts/p-copy.jpg",
  pm: "/cases/experts/p-pm.jpg",
  hr: "/cases/experts/p-pm.jpg",
  "data-analyst": "/cases/experts/p-pm.jpg",
  "code-reviewer": "/cases/experts/p-code.jpg",
  "interviewer-tech": "/cases/experts/p-code.jpg",
  travel: "/cases/experts/p-travel.jpg",
  psychologist: "/cases/experts/p-travel.jpg",
  english: "/cases/experts/p-travel.jpg",
  chef: "/cases/experts/p-chef.jpg",
  tutor: "/cases/experts/p-chef.jpg",
  translator: "/cases/experts/p-copy.jpg",
  legal: "/cases/experts/p-pm.jpg",
};

export default function ExpertsPage() {
  const router = useRouter();
  const { newConversation, selectConversation, setPersona } = useChatStore();
  const experts = PERSONAS.filter((p) => p.id !== "none");
  const featured = experts.find((p) => p.id === FEATURED_ID) ?? experts[0];

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
          <p className="mt-1 text-[13px] text-stone-500">本周主推一位，其余在横幅下滑过即可提问。</p>

          <div className="relative mt-6 aspect-[16/5] min-h-[220px] overflow-hidden rounded-[22px] bg-stone-900 shadow-[0_24px_60px_-28px_rgba(80,40,10,0.45)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cases/experts/hero-week.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[68%_30%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
            <div className="relative z-[1] flex h-full max-w-xl flex-col justify-end px-8 py-8">
              <p className="text-[12px] tracking-[0.28em] text-[#e2c48a]">本周专家 · {featured.group}</p>
              <h2 className="mt-2 text-[32px] font-semibold tracking-tight text-white">{featured.name}</h2>
              <p className="mt-2 text-[14px] leading-7 text-white/80">
                把 Campaign 拆成可执行的周计划：定位、渠道、节奏与衡量，不说空话。
              </p>
              <button
                type="button"
                onClick={() => void start(featured)}
                className="mt-5 w-fit rounded-full bg-gradient-to-r from-orange-400 to-red-500 px-5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(234,88,12,0.85)]"
              >
                开始对话
              </button>
            </div>
          </div>

          <h3 className="mt-8 text-[13px] font-semibold tracking-wide text-stone-500">全部专家</h3>
          <div className="mt-4 flex gap-5 overflow-x-auto pb-4 pt-1">
            {experts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void start(p)}
                className="group flex w-[92px] shrink-0 flex-col items-center text-center"
              >
                <span className="relative h-[72px] w-[72px] overflow-hidden rounded-full ring-2 ring-white shadow-md transition group-hover:ring-[#c45c2a]">
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
            ))}
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
