"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dice5, Search, X } from "lucide-react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { PERSONAS, PERSONA_GROUPS, type Persona } from "@/lib/personas";
import {
  biosOf,
  CARD_EXTRA,
  EXPERT_VERSION,
  faceOf,
  HERO_ART,
  metaOf,
  searchExperts,
  WEEKLY_DEFAULT,
} from "@/lib/expertsCatalog";
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
  const [group, setGroup] = useState<(typeof PERSONA_GROUPS)[number] | "全部" | "最近" | "收藏">("咨询");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(WEEKLY_DEFAULT);
  const [fav, setFav] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
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

  const continueLast = (id?: string) => {
    const hit = conversations.find((c) => c.personaId === (id ?? featured?.id));
    if (hit) {
      void selectConversation(hit.id);
      router.push("/chat");
      return;
    }
    toast("还没有和这位专家的会话", "info");
  };

  if (!featured || !meta) return null;
  const banner = HERO_ART[group] || HERO_ART["咨询"] || faceOf(featured.id);

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#fbf8f2]">
      <div className="mx-auto max-w-[1080px] px-6 py-6 lg:px-8">
        {guide && (
          <div className="mb-4 rounded-2xl bg-white px-4 py-3 text-[13px] text-stone-600 ring-1 ring-stone-200">
            ① 选咨询分类 ② 看横幅与专家卡 ③ 预约咨询进入对话
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

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-extrabold tracking-tight text-stone-900">专家</h1>
          <div className="ml-auto flex min-w-[220px] items-center gap-2 rounded-full bg-white px-3 py-2 ring-1 ring-stone-200">
            <Search className="h-4 w-4 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索"
              className="w-full bg-transparent text-[13px] outline-none"
            />
          </div>
          <button type="button" onClick={randomPick} className="rounded-full bg-white px-3 py-2 text-[12px] ring-1 ring-stone-200">
            <Dice5 className="mr-1 inline h-3.5 w-3.5" />
            随机
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["全部", "最近", "收藏", ...PERSONA_GROUPS] as const).map((g) => {
            const n = g === "全部" ? all.length : g === "收藏" ? fav.length : g === "最近" ? recent.length : counts[g] ?? 0;
            const empty = n === 0 && g !== "全部";
            return (
              <button
                key={g}
                type="button"
                disabled={empty}
                onClick={() => {
                  setGroup(g);
                  if (g === "咨询") pick("board-coach");
                }}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium disabled:opacity-40 ${
                  group === g ? "bg-[#c45c2a] text-white" : "bg-[#f3eee6] text-stone-600"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>

        <div className="relative mt-5 grid min-h-[200px] overflow-hidden rounded-[24px] bg-[#f3ebe0] md:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col justify-center px-8 py-8">
            <h2 className="text-[32px] font-bold tracking-tight text-stone-900">{featured.name}</h2>
            <p className="mt-3 max-w-md text-[15px] leading-7 text-stone-600">{meta.pitch}</p>
            <button
              type="button"
              onClick={() => setDetailId(featured.id)}
              className="mt-6 w-fit rounded-full bg-[#c45c2a] px-5 py-2 text-[13px] font-semibold text-white"
            >
              了解更多
            </button>
          </div>
          <div className="relative min-h-[180px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          </div>
        </div>



        {rail.length === 0 && (
          <p className="mt-6 text-[13px] text-stone-500">
            没有匹配。试试：
            {["写文案", "审代码", "规划旅行"].map((t) => (
              <button key={t} type="button" className="ml-2 text-[#c45c2a]" onClick={() => setQ(t)}>
                {t}
              </button>
            ))}
          </p>
        )}

        <div className="mt-6 grid gap-4 pb-10 md:grid-cols-2">
          {rail.map((p) => {
            const m = metaOf(p.id);
            const cx = CARD_EXTRA[p.id];
            const src = faceOf(p.id);
            const on = featured.id === p.id;
            return (
              <article
                key={p.id}
                className={`rounded-[22px] border bg-white p-5 ${on ? "border-[#e0b79c] shadow-sm" : "border-stone-200/80"}`}
              >
                <div className="flex gap-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#fbf3ec]">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl">{p.emoji}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold text-stone-900">{cx?.alias ?? p.name}</p>
                    <p className="text-[12px] text-stone-500">{cx?.title ?? p.group}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(cx?.skills ?? m.suited).slice(0, 3).map((s) => (
                        <span key={s} className="rounded-full bg-[#fbf3ec] px-2 py-0.5 text-[11px] text-[#c45c2a]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-stone-600">{m.pitch}</p>
                <p className="mt-2 text-[12px] text-amber-700">★ {cx?.rating ?? "—"} · 技能：{(cx?.skills ?? m.suited).join("  ")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void start(p)}
                    className="rounded-full bg-[#c45c2a] px-4 py-1.5 text-[13px] font-medium text-white"
                  >
                    预约咨询
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pick(p.id);
                      setDetailId(p.id);
                    }}
                    className="rounded-full border border-stone-200 px-4 py-1.5 text-[13px] text-stone-600"
                  >
                    查看详情
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <p className="pb-8 text-center text-[11px] text-stone-400">
          人设是提示词，不是真人执业。{EXPERT_VERSION} · 预约咨询即进入对话。
        </p>
      </div>

      {detailId &&
        (() => {
          const p = all.find((x) => x.id === detailId);
          if (!p) return null;
          const m = metaOf(p.id);
          const cx = CARD_EXTRA[p.id];
          const src = faceOf(p.id);
          return (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setDetailId(null)}>
              <div
                className="max-h-[88vh] w-full max-w-[640px] overflow-y-auto rounded-[24px] bg-[#fbf8f2] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-4">
                  <span className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#f3ebe0]">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-3xl">{p.emoji}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[22px] font-bold text-stone-900">{cx?.alias ?? p.name}</p>
                    <p className="text-[13px] text-stone-500">
                      {p.name} · {cx?.title ?? p.group}
                    </p>
                    <p className="mt-1 text-[13px] text-amber-700">★ {cx?.rating ?? "—"} · {p.group}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(cx?.skills ?? m.suited).map((s) => (
                        <span key={s} className="rounded-full bg-[#f3ebe0] px-2.5 py-0.5 text-[11px] text-[#c45c2a]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="rounded-full p-1 text-stone-400" onClick={() => setDetailId(null)} aria-label="关闭">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <h3 className="mt-6 text-[13px] font-semibold tracking-wide text-[#c45c2a]">详细介绍</h3>
                <div className="mt-2 space-y-3 text-[14px] leading-7 text-stone-700">
                  {biosOf(p).map((para) => (
                    <p key={para}>{para}</p>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 text-[13px] leading-6 text-stone-600 sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-stone-800">擅长</span>
                    <br />
                    {m.suited.join("、") || "通用"}
                  </p>
                  <p>
                    <span className="font-semibold text-stone-800">不接</span>
                    <br />
                    {m.notSuited.join("、") || "—"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-semibold text-stone-800">工作方式</span>
                    <br />
                    {m.works}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-semibold text-stone-800">禁用</span>
                    <br />
                    {m.bans.join("；") || "—"}
                  </p>
                </div>
                {m.warning && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{m.warning}</p>}

                <h3 className="mt-5 text-[13px] font-semibold tracking-wide text-[#c45c2a]">可以这样开始</h3>
                <div className="mt-2 space-y-2">
                  {m.starters.map((st) => (
                    <button
                      key={st.text}
                      type="button"
                      onClick={() => void start(p, st.text)}
                      className="block w-full rounded-xl bg-white px-3 py-2.5 text-left text-[13px] leading-6 text-stone-700 ring-1 ring-stone-100"
                    >
                      <span className="text-[11px] text-[#c45c2a]">
                        {st.lv} · {st.out}
                      </span>
                      <span className="mt-0.5 block">{st.text}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void start(p)}
                    className="rounded-full bg-[#c45c2a] px-5 py-2 text-[13px] font-semibold text-white"
                  >
                    预约咨询
                  </button>
                  <button type="button" onClick={() => continueLast(p.id)} className="rounded-full border border-stone-200 px-4 py-2 text-[13px] text-stone-600">
                    继续上次
                  </button>
                  <button type="button" onClick={() => setDetailId(null)} className="rounded-full px-4 py-2 text-[13px] text-stone-500">
                    返回列表
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </main>
  );
}
