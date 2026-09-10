"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dice5, Search, Star } from "lucide-react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { PERSONAS, PERSONA_GROUPS, type Persona } from "@/lib/personas";
import { biosOf, EXPERT_VERSION, faceOf, metaOf, searchExperts, WEEKLY_DEFAULT } from "@/lib/expertsCatalog";
import { useChatStore } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import { readJSON, writeJSON } from "@/lib/safe-storage";

const FAV_KEY = "oc:experts.fav";
const REC_KEY = "oc:experts.recent";
const WEEK_KEY = "oc:experts.week";

export default function ExpertsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f6efe4] text-stone-800">
      <Sidebar />
      <Suspense fallback={<main className="flex-1" />}>
        <ExpertsStudio />
      </Suspense>
      <Toaster />
    </div>
  );
}

function ExpertsStudio() {
  const router = useRouter();
  const sp = useSearchParams();
  const { newConversation, selectConversation, setPersona, conversations, activeId } = useChatStore();
  const [group, setGroup] = useState<(typeof PERSONA_GROUPS)[number] | "全部" | "最近" | "收藏">("全部");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(WEEKLY_DEFAULT);
  const [fav, setFav] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [strict, setStrict] = useState(false);
  const [teach, setTeach] = useState(false);
  const [goal, setGoal] = useState("");
  const [guide, setGuide] = useState(false);

  const all = useMemo(() => PERSONAS.filter((p) => p.id !== "none"), []);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of all) c[p.group] = (c[p.group] ?? 0) + 1;
    return c;
  }, [all]);

  useEffect(() => {
    setFav(readJSON<string[]>(FAV_KEY, []));
    setRecent(readJSON<string[]>(REC_KEY, []));
    const week = readJSON<string>(WEEK_KEY, WEEKLY_DEFAULT);
    const fromUrl = sp.get("id");
    if (fromUrl && all.some((p) => p.id === fromUrl)) setPicked(fromUrl);
    else if (week && all.some((p) => p.id === week)) setPicked(week);
    const seen = readJSON<boolean>("oc:experts.guide", false);
    if (!seen) setGuide(true);
  }, [all, sp]);

  const featured = all.find((p) => p.id === picked) ?? all[0];
  const meta = featured ? metaOf(featured.id) : null;

  const rail = useMemo(() => {
    let list = all;
    if (group === "收藏") list = all.filter((p) => fav.includes(p.id));
    else if (group === "最近") list = recent.map((id) => all.find((p) => p.id === id)).filter(Boolean) as Persona[];
    else if (group !== "全部") list = all.filter((p) => p.group === group);
    return searchExperts(q, list);
  }, [all, group, fav, recent, q]);

  const touchRecent = (id: string) => {
    const next = [id, ...recent.filter((x) => x !== id)].slice(0, 8);
    setRecent(next);
    writeJSON(REC_KEY, next);
  };

  const toggleFav = (id: string) => {
    const next = fav.includes(id) ? fav.filter((x) => x !== id) : [id, ...fav];
    setFav(next);
    writeJSON(FAV_KEY, next);
  };

  const pick = (id: string) => {
    setPicked(id);
    router.replace(`/experts?id=${id}`, { scroll: false });
  };

  const start = async (p: Persona, starter?: string) => {
    touchRecent(p.id);
    const cid = await newConversation("chat");
    await selectConversation(cid);
    setPersona(p.id);
    const bits = [
      starter,
      goal.trim() && `【此轮目标】${goal.trim()}`,
      strict && "【严格模式】少寒暄，只要结构。",
      teach && "【教学模式】多解释为什么。",
    ].filter(Boolean);
    if (bits.length) writeJSON("oc:experts.launch", { text: bits.join("\n"), ts: Date.now() });
    toast(`已进入「${p.name}」专家对话`, "success");
    router.push("/chat");
  };

  const randomPick = () => {
    if (!rail.length) return;
    pick(rail[Math.floor(Math.random() * rail.length)].id);
  };

  const continueLast = () => {
    const hit = conversations.find((c) => c.personaId === featured?.id);
    if (hit) {
      void selectConversation(hit.id);
      router.push("/chat");
      return;
    }
    toast("还没有和这位专家的会话", "info");
  };

  if (!featured || !meta) return null;
  const hero = faceOf(featured.id);
  const toneRing =
    featured.group === "技术" ? "from-slate-800" : featured.group === "生活" ? "from-emerald-900" : "from-black/80";

  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-6 py-7 lg:px-10">
        {guide && (
          <div className="mb-4 rounded-2xl bg-white px-4 py-3 text-[13px] text-stone-600 ring-1 ring-stone-200">
            ① 点头像换横幅 ② 看档案与示例 ③ 开始对话
            <button
              type="button"
              className="ml-3 text-[#c45c2a]"
              onClick={() => {
                writeJSON("oc:experts.guide", true);
                setGuide(false);
              }}
            >
              知道了
            </button>
          </div>
        )}

        <p className="text-[13px] font-semibold text-stone-900">本周专家</p>
        <p className="mt-1 text-[13px] text-stone-500">
          点头像换主视觉，再开始对话。人设是提示词，不是真人执业。{EXPERT_VERSION}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[180px] items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-stone-200">
            <Search className="h-3.5 w-3.5 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜姓名、技能、PRD、行程…"
              className="w-full bg-transparent text-[13px] outline-none"
            />
          </div>
          <button type="button" onClick={randomPick} className="rounded-full bg-white px-3 py-1.5 text-[12px] ring-1 ring-stone-200">
            <Dice5 className="mr-1 inline h-3.5 w-3.5" />
            随机一位
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["全部", "最近", "收藏", ...PERSONA_GROUPS] as const).map((g) => {
            const n = g === "全部" ? all.length : g === "收藏" ? fav.length : g === "最近" ? recent.length : counts[g] ?? 0;
            const empty = n === 0 && g !== "全部";
            return (
              <button
                key={g}
                type="button"
                disabled={empty}
                onClick={() => setGroup(g)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium disabled:opacity-40 ${
                  group === g ? "bg-[#c45c2a] text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
                }`}
              >
                {g}
                <span className="ml-1 opacity-70">{n}</span>
              </button>
            );
          })}
        </div>

        <div
          className={`relative mt-6 overflow-hidden rounded-[22px] bg-stone-800 shadow-[0_24px_60px_-28px_rgba(80,40,10,0.45)] max-md:aspect-[4/5] md:aspect-[16/5] md:min-h-[240px]`}
        >
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover object-[68%_28%]" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#fbf3ec] text-7xl">{featured.emoji}</div>
          )}
          <div className={`absolute inset-0 bg-gradient-to-r ${toneRing} via-black/40 to-transparent`} />
          <div className="relative z-[1] flex h-full max-w-[36em] flex-col justify-end px-8 py-8">
            <p className="text-[12px] tracking-[0.28em] text-[#e2c48a]">
              本周专家 · {featured.group}
              {meta.official ? " · 开帆工坊" : " · 我的"}
            </p>
            <h2 className="mt-2 text-[32px] font-semibold tracking-tight text-white">{featured.name}</h2>
            <p className="mt-2 text-[14px] leading-7 text-white/80">{meta.pitch}</p>
            <p className="mt-1 text-[12px] text-white/70">擅长：{meta.suited.join("、") || "通用"}</p>
            <p className="mt-0.5 text-[12px] text-white/55">不接：{meta.notSuited.join("、") || "—"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void start(featured)}
                className="rounded-full bg-gradient-to-r from-orange-400 to-red-500 px-5 py-2 text-[13px] font-semibold text-white"
              >
                开始对话
              </button>
              <button type="button" onClick={() => setPreview((v) => !v)} className="rounded-full bg-white/15 px-4 py-2 text-[13px] text-white">
                预览人设
              </button>
              <button type="button" onClick={() => toggleFav(featured.id)} className="rounded-full bg-white/15 px-3 py-2 text-white">
                <Star className={`h-4 w-4 ${fav.includes(featured.id) ? "fill-amber-300 text-amber-300" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {preview && (
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-900 p-4 text-[12px] leading-6 text-amber-50">
            {featured.system}
          </pre>
        )}
        {meta.warning && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-[12px] text-amber-900">{meta.warning}</p>}

        <div className="mt-6 rounded-2xl bg-white/70 p-5 ring-1 ring-[#ece6db]">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-[#c45c2a]">档案 · {EXPERT_VERSION}</p>
          <div className="mt-3 space-y-2 text-[14px] leading-7 text-stone-600">
            {biosOf(featured).map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-stone-500">工作方式：{meta.works}</p>
          <p className="mt-1 text-[13px] text-stone-500">禁用：{meta.bans.join("；")}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {meta.starters.map((st) => (
              <button
                key={st.text}
                type="button"
                onClick={() => void start(featured, st.text)}
                className="rounded-xl bg-[#fbf3ec] px-3 py-3 text-left"
              >
                <span className="text-[10px] text-[#c45c2a]">
                  {st.lv} · {st.out}
                </span>
                <span className="mt-1 block text-[13px] leading-6 text-stone-700">{st.text}</span>
              </button>
            ))}
          </div>
          <label className="mt-4 block text-[12px] text-stone-500">
            此轮目标（写入上下文）
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] outline-none"
              placeholder="一句话目标，可空"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-stone-600">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
              严格模式
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={teach} onChange={(e) => setTeach(e.target.checked)} />
              教学模式
            </label>
            <button type="button" className="text-[#c45c2a]" onClick={continueLast}>
              继续上次
            </button>
            {activeId && (
              <button
                type="button"
                className="text-[#c45c2a]"
                onClick={() => {
                  const draft = conversations.find((c) => c.id === activeId);
                  void start(featured, draft?.messages.filter((m) => m.role === "user").at(-1)?.content);
                }}
              >
                带着当前草稿问 TA
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-wide text-stone-500">全部专家</h3>
          <p className="text-[11px] text-stone-400">← → 切换 · Enter 开始</p>
        </div>
        {rail.length === 0 && (
          <p className="mt-4 text-[13px] text-stone-500">
            没有匹配。试试：
            {["写文案", "审代码", "规划旅行"].map((t) => (
              <button key={t} type="button" className="ml-2 text-[#c45c2a]" onClick={() => setQ(t)}>
                {t}
              </button>
            ))}
          </p>
        )}
        <div
          className="mt-4 grid grid-cols-4 gap-4 pb-8 sm:grid-cols-6 lg:grid-cols-8"
          onKeyDown={(e) => {
            const idx = rail.findIndex((p) => p.id === featured.id);
            if (e.key === "ArrowRight") {
              e.preventDefault();
              pick(rail[(idx + 1) % rail.length]?.id ?? featured.id);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              pick(rail[(idx - 1 + rail.length) % rail.length]?.id ?? featured.id);
            }
            if (e.key === "Enter") void start(featured);
          }}
          tabIndex={0}
        >
          {rail.map((p) => {
            const on = featured.id === p.id;
            const src = faceOf(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                title={metaOf(p.id).starters[0]?.text}
                onClick={() => pick(p.id)}
                className={`flex flex-col items-center text-center ${on ? "scale-105" : "opacity-80 hover:opacity-100"}`}
              >
                <span
                  className={`relative h-[72px] w-[72px] overflow-hidden rounded-full bg-[#fbf3ec] shadow-md ring-2 ${
                    on ? "ring-[#c45c2a] ring-offset-2 ring-offset-[#f6efe4]" : "ring-white"
                  }`}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full h-full w-full items-center justify-center text-[28px]">{p.emoji}</span>
                  )}
                </span>
                <span className={`mt-2 line-clamp-2 text-[12px] font-medium leading-4 ${on ? "underline decoration-[#c45c2a]" : "text-stone-700"}`}>
                  {p.name}
                </span>
                <span className="mt-0.5 line-clamp-1 text-[10px] text-[#c45c2a]">{p.desc}</span>
              </button>
            );
          })}
        </div>
        <p className="pb-8 text-center text-[11px] text-stone-400">人设是提示词，不是真人执业。法律与心理咨询有额外边界。</p>
      </div>
    </main>
  );
}
