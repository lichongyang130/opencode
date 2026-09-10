"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, MessageCircle, Search } from "lucide-react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { PERSONAS, PERSONA_GROUPS, type Persona } from "@/lib/personas";
import { useChatStore } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";

const AVATAR: Record<string, string> = {
  "data-analyst": "/mock-avatars/analyst.png",
  "code-reviewer": "/mock-avatars/coder.png",
  copywriter: "/mock-avatars/content.png",
  "marketing-strategist": "/mock-avatars/content.png",
  pm: "/mock-avatars/pm.png",
  "interviewer-tech": "/mock-avatars/meeting.png",
  hr: "/mock-avatars/meeting.png",
};

export default function ExpertsPage() {
  const router = useRouter();
  const { newConversation, selectConversation, setPersona } = useChatStore();
  const [group, setGroup] = useState<(typeof PERSONA_GROUPS)[number] | "全部">("全部");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState("code-reviewer");
  const [copied, setCopied] = useState(false);

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

  const expert = list.find((p) => p.id === picked) ?? list[0];

  const start = async (p: Persona) => {
    const cid = await newConversation("chat");
    await selectConversation(cid);
    setPersona(p.id);
    toast(`已进入「${p.name}」专家对话`, "success");
    router.push("/chat");
  };

  const copyStarter = async (p: Persona) => {
    const text = p.starter || p.desc;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("已复制开场白", "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("复制失败", "error");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6efe4] text-stone-800">
      <Sidebar />
      <main className="flex min-w-0 flex-1">
        <section className="flex w-[min(300px,34vw)] shrink-0 flex-col border-r border-[#e8ddca] bg-[#f3ebe0]">
          <div className="px-5 pb-3 pt-7">
            <h1 className="text-[28px] font-extrabold tracking-tight text-stone-900">专家</h1>
            <p className="mt-1 text-[12px] leading-5 text-stone-500">选一位，看档案，再提问。</p>
            <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-stone-200">
              <Search className="h-3.5 w-3.5 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索专家"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-stone-400"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["全部", ...PERSONA_GROUPS] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    group === g ? "bg-[#c45c2a] text-white" : "bg-white/80 text-stone-600 ring-1 ring-stone-200"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {list.map((p) => {
              const on = expert?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPicked(p.id)}
                  className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    on ? "bg-white shadow-sm" : "hover:bg-white/60"
                  }`}
                  style={on ? { boxShadow: "inset 3px 0 0 #c45c2a" } : undefined}
                >
                  <Avatar p={p} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-stone-800">{p.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-stone-500">{p.desc}</span>
                  </span>
                </button>
              );
            })}
            {list.length === 0 && <p className="px-3 py-8 text-center text-[12px] text-stone-400">没有匹配的专家</p>}
          </div>
        </section>

        <section className="min-w-0 flex-1 overflow-y-auto px-8 py-10 lg:px-14">
          {expert ? (
            <article className="mx-auto max-w-[640px]">
              <Avatar p={expert} size={160} />
              <p className="mt-6 text-[12px] font-medium tracking-[0.16em] text-[#c45c2a]">{expert.group}</p>
              <h2 className="mt-1 text-[32px] font-semibold tracking-tight text-stone-900">{expert.name}</h2>
              <div className="mt-5 space-y-3 text-[15px] leading-7 text-stone-600">
                {bioOf(expert).map((para) => (
                  <p key={para}>{para}</p>
                ))}
              </div>
              {expert.starter && (
                <div className="mt-8 rounded-2xl bg-[#fbf3ec] px-5 py-4">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-[#c45c2a]">示例提问</p>
                  <p className="mt-2 text-[14px] leading-7 text-stone-700">{expert.starter}</p>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void start(expert)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(234,88,12,0.8)]"
                >
                  <MessageCircle className="h-4 w-4" /> 向 TA 提问
                </button>
                <button
                  type="button"
                  onClick={() => void copyStarter(expert)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-[14px] font-medium text-stone-700 hover:border-[#e0b79c]"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "已复制" : "复制开场白"}
                </button>
              </div>
            </article>
          ) : null}
        </section>
      </main>
      <Toaster />
    </div>
  );
}

function Avatar({ p, size }: { p: Persona; size: number }) {
  const src = AVATAR[p.id];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fbf3ec] text-stone-700 ring-1 ring-[#eadfcf]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        p.emoji
      )}
    </span>
  );
}

function bioOf(p: Persona): string[] {
  const raw = (p.system || p.desc).trim();
  const parts = raw
    .split(/(?<=。)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) return parts.slice(0, 4);
  return [p.desc, ...parts].filter(Boolean).slice(0, 4);
}
