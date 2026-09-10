"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Search } from "lucide-react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { PERSONAS, PERSONA_GROUPS } from "@/lib/personas";
import { useChatStore } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";

export default function ExpertsPage() {
  const router = useRouter();
  const { newConversation, selectConversation, setPersona } = useChatStore();
  const [group, setGroup] = useState<(typeof PERSONA_GROUPS)[number] | "全部">("全部");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return PERSONAS.filter((p) => p.id !== "none")
      .filter((p) => group === "全部" || p.group === group)
      .filter(
        (p) =>
          !query ||
          p.name.toLowerCase().includes(query) ||
          p.desc.toLowerCase().includes(query),
      );
  }, [group, q]);

  const start = async (id: string, name: string) => {
    const cid = await newConversation("chat");
    await selectConversation(cid);
    setPersona(id);
    toast(`已进入「${name}」专家对话`, "success");
    router.push("/chat");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6efe4] text-stone-800">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-7 lg:px-10">
        <h1 className="text-[36px] font-extrabold tracking-tight text-stone-900">专家</h1>
        <p className="mt-1 text-[13px] text-stone-500">按领域选择一位专家，直接进入对话。</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["全部", ...PERSONA_GROUPS] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                group === g
                  ? "bg-[#c45c2a] text-white shadow-sm"
                  : "bg-white/90 text-stone-600 ring-1 ring-stone-300/70 hover:bg-white"
              }`}
            >
              {g}
            </button>
          ))}
          <div className="ml-auto flex min-w-[200px] items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-stone-200">
            <Search className="h-3.5 w-3.5 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索专家"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-stone-400"
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <article
              key={p.id}
              className="flex flex-col rounded-[22px] border border-[#ece6db] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbf3ec] text-[22px]">
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[16px] font-semibold text-stone-800">{p.name}</h2>
                  <p className="mt-0.5 text-[11px] text-[#c05f3c]">{p.group}</p>
                </div>
              </div>
              <p className="mt-3 flex-1 text-[13px] leading-6 text-stone-500">{p.desc}</p>
              {p.starter && (
                <p className="mt-3 line-clamp-2 rounded-xl bg-[#fbf8f4] px-3 py-2 text-[12px] text-stone-500">
                  示例：{p.starter}
                </p>
              )}
              <button
                type="button"
                onClick={() => void start(p.id, p.name)}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 py-2.5 text-[13px] font-medium text-white"
              >
                <MessageCircle className="h-4 w-4" /> 向 TA 提问
              </button>
            </article>
          ))}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
