"use client";

import { useState } from "react";
import { caseAudioOf, caseFramesOf, caseShotsOf } from "@/lib/canvasCaseArtifacts";
import { protoScreensOf, realtimeKpisOf, researchPackOf, sitePackOf } from "@/lib/livePacks";
import { LiveLamp3D } from "./LiveLamp3D";

export function LiveResearch({ title }: { title: string }) {
  const pack = researchPackOf(title);
  return (
    <div className="h-full overflow-y-auto bg-[#e8e4dc] px-3 py-6 sm:px-8">
      <article className="mx-auto max-w-[920px] bg-white px-10 py-10 shadow-xl">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-bold text-sky-700">InsightResearch</p>
            <p className="text-[11px] text-stone-400">洞察 · 专业 · 前瞻</p>
          </div>
          <p className="text-right text-[11px] text-stone-400">
            深度研究报告
            <br />
            2026年5月
          </p>
        </header>
        <h1 className="mt-8 text-[28px] font-extrabold text-sky-800">{pack.title}</h1>
        <p className="mt-1 text-[13px] text-stone-500">关键发现、玩家对照与可执行判断</p>
        <div className="mt-2 h-1 w-14 bg-sky-500" />
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] text-stone-600">
          <div>报告类型：深度研究报告</div>
          <div>行业领域：{pack.field}</div>
        </dl>
        <h2 className="mt-8 text-[15px] font-bold text-stone-800">1. 关键发现</h2>
        <ul className="mt-2 list-disc pl-5 text-[12px] leading-6 text-stone-600">
          {pack.findings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <h2 className="mt-6 text-[15px] font-bold text-stone-800">2. 格局对照</h2>
        <table className="mt-2 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-sky-700 text-white">
              {["维度", "形态", "要点", "商业化"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-stone-700">
            {pack.players.map((r) => (
              <tr key={r[0]} className="border-b border-stone-100">
                {r.map((c) => (
                  <td key={c} className="px-2 py-1.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <h2 className="mt-6 text-[15px] font-bold text-stone-800">3. 可执行建议</h2>
        <ul className="mt-2 list-disc pl-5 text-[12px] leading-6 text-stone-600">
          {pack.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}

export function LiveWebsite({ title, interactive = true }: { title: string; interactive?: boolean }) {
  const s = sitePackOf(title);
  const [tab, setTab] = useState(0);
  const bar = s.accent === "orange" ? "bg-orange-500" : s.accent === "stone" ? "bg-stone-800" : "bg-violet-600";
  const btn = s.accent === "orange" ? "bg-orange-500" : s.accent === "stone" ? "bg-stone-900" : "bg-violet-600";
  const nav = ["首页", ...s.cards.map(([t]) => t).slice(0, 3)];
  const Hit = interactive ? "button" : "div";
  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className={`${bar} py-1.5 text-center text-[11px] text-white`}>{s.tag} · {s.brand}</div>
      <header className="flex items-center justify-between px-8 py-4">
        <span className="text-[15px] font-semibold text-stone-900">{s.brand}</span>
        <nav className="hidden gap-3 text-[12px] text-stone-500 sm:flex">
          {nav.map((n, i) => (
            <Hit
              key={n}
              type="button"
              onClick={() => interactive && setTab(i)}
              className={i === tab ? "font-semibold text-stone-900" : "hover:text-stone-800"}
            >
              {n}
            </Hit>
          ))}
        </nav>
        <span className={`rounded-lg ${btn} px-3 py-1.5 text-[13px] text-white`}>{s.cta}</span>
      </header>
      <section className="px-8 py-10">
        {tab === 0 ? (
          <>
            <h1 className="max-w-2xl text-[42px] font-bold leading-[1.15] tracking-tight text-stone-900">{s.h1}</h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-stone-500">{s.sub}</p>
            <Hit type="button" onClick={() => interactive && setTab(1)} className={`mt-6 inline-block rounded-lg ${btn} px-4 py-2.5 text-[13px] font-medium text-white`}>
              {s.cta}
            </Hit>
          </>
        ) : (
          <>
            <h1 className="text-[28px] font-bold text-stone-900">{s.cards[tab - 1]?.[0]}</h1>
            <p className="mt-3 max-w-lg text-[15px] leading-7 text-stone-500">{s.cards[tab - 1]?.[1]}</p>
          </>
        )}
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          {s.cards.map(([t, d], i) => (
            <Hit
              key={t}
              type="button"
              onClick={() => interactive && setTab(i + 1)}
              className="rounded-2xl border border-stone-200 p-4 text-left hover:border-stone-400"
            >
              <p className="font-semibold text-stone-800">{t}</p>
              <p className="mt-1 text-[12px] text-stone-500">{d}</p>
            </Hit>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LivePrototype({ title, interactive = true }: { title: string; interactive?: boolean }) {
  const screens = protoScreensOf(title);
  const [cur, setCur] = useState(0);
  const Hit = interactive ? "button" : "div";
  const n = Math.max(screens.length, 1);
  const a = screens[cur % n] ?? screens[0];
  const b = screens[(cur + 1) % n] ?? a;
  const pair = [a, b].filter(Boolean);
  return (
    <div className="flex h-full flex-col bg-[#ece6dc]">
      {interactive && (
        <div className="flex items-center justify-between border-b bg-white/70 px-4 py-2 text-[12px] text-stone-500">
          <span>Pages · {title}</span>
          <span>点击机身切换 · {cur + 1}/{screens.length}</span>
        </div>
      )}
      <div className="flex min-h-0 flex-1 items-center justify-center gap-8 overflow-hidden p-8">
        {pair.map((s, i) => (
          <Hit
            key={`${s.id}-${i}`}
            type="button"
            onClick={() => interactive && setCur((x) => (x + 1) % n)}
            className={`w-[200px] shrink-0 rounded-[36px] border-[10px] border-stone-900 bg-white p-4 text-left shadow-2xl ${i === 0 ? "ring-2 ring-orange-300" : ""}`}
          >
            <p className="text-center text-[10px] text-stone-400">9:41</p>
            <p className="mt-3 text-center text-[13px] font-semibold">{s.title}</p>
            <div className="mt-3 space-y-1.5">
              {s.fields.map((f) => (
                <div key={f} className="rounded-md border border-stone-200 px-2 py-1.5 text-[10px] text-stone-400">
                  {f}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-md bg-stone-800 py-1.5 text-center text-[11px] text-white">{s.cta}</div>
          </Hit>
        ))}
      </div>
    </div>
  );
}

export function LiveVideo({ title, interactive = true }: { title: string; interactive?: boolean }) {
  const shots = caseShotsOf(title);
  const [cur, setCur] = useState(0);
  const Hit = interactive ? "button" : "div";
  return (
    <div className="h-full overflow-y-auto bg-stone-950 p-4">
      <p className="mb-3 text-sm font-semibold text-white">{title} · 分镜台本（点镜头切换）</p>
      <div className="space-y-2">
        {shots.map((s, i) => (
          <Hit
            key={i}
            type="button"
            onClick={() => interactive && setCur(i)}
            className={`grid w-full grid-cols-[88px_1fr] overflow-hidden rounded-xl border text-left ${i === cur ? "border-rose-400 bg-stone-800" : "border-white/10 bg-stone-900"}`}
          >
            <span className="flex flex-col items-center justify-center bg-gradient-to-br from-rose-900/80 to-stone-900 p-3 text-center">
              <span className="text-[10px] text-rose-200">SHOT {i + 1}</span>
              <span className="mt-1 text-xs font-semibold text-white">{s.t}</span>
            </span>
            <span className="p-3">
              <span className="block text-[13px] font-medium text-stone-100">{s.shot}</span>
              <span className="mt-1 block text-[12px] text-stone-400">VO：{s.vo}</span>
            </span>
          </Hit>
        ))}
      </div>
    </div>
  );
}

export function LiveFrames({ title, interactive = true }: { title: string; interactive?: boolean }) {
  const frames = caseFramesOf(title);
  const [cur, setCur] = useState(0);
  const Hit = interactive ? "button" : "div";
  return (
    <div className="flex h-full flex-col bg-zinc-950 p-4">
      <p className="mb-3 text-sm font-semibold text-white">{title} · 逐帧（点选）</p>
      <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto">
        {frames.map((f, i) => (
          <Hit
            key={f.n}
            type="button"
            onClick={() => interactive && setCur(i)}
            className={`flex w-40 shrink-0 flex-col overflow-hidden rounded-xl border ${i === cur ? "border-fuchsia-400" : "border-white/10"}`}
          >
            <span className="flex aspect-[9/16] flex-col justify-between bg-gradient-to-b from-fuchsia-800/70 to-zinc-950 p-3 text-left">
              <span className="text-[10px] text-fuchsia-100">
                F{f.n} · {f.dur}
              </span>
              <span className="text-[12px] font-medium text-white">{f.visual}</span>
            </span>
            <span className="p-2 text-left text-[11px] text-zinc-400">{f.motion}</span>
          </Hit>
        ))}
      </div>
    </div>
  );
}

export function LiveAudio({ title, interactive = true }: { title: string; interactive?: boolean }) {
  const cues = caseAudioOf(title);
  const [cur, setCur] = useState(0);
  const Hit = interactive ? "button" : "div";
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-orange-50 to-white p-6">
      <div className="mx-auto w-full max-w-lg rounded-3xl bg-stone-900 p-5 text-white">
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-4 flex h-16 items-end gap-0.5">
          {Array.from({ length: 48 }, (_, i) => (
            <span key={i} className="flex-1 rounded-t bg-orange-400/80" style={{ height: `${20 + ((i * 17) % 70)}%` }} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-stone-400">当前段落 {cues[cur]?.at}</p>
      </div>
      <ol className="mx-auto mt-5 w-full max-w-lg space-y-2">
        {cues.map((c, i) => (
          <li key={c.at}>
            <Hit
              type="button"
              onClick={() => interactive && setCur(i)}
              className={`w-full rounded-xl border p-3 text-left ${i === cur ? "border-orange-400 bg-orange-50" : "border-stone-200 bg-white"}`}
            >
              <p className="text-[11px] text-orange-600">
                {c.at} · {c.mood}
              </p>
              <p className="mt-1 text-[13px] leading-6 text-stone-700">{c.line}</p>
            </Hit>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LiveRealtime({ title }: { title: string }) {
  const kpis = realtimeKpisOf(title);
  const [sel, setSel] = useState(0);
  const bars = [40, 72, 55, 88, 64, 91, 48, 70].map((h, i) => (i === sel ? h + 8 : h));
  const line = [20, 35, 28, 50, 44, 68, 60, 82];
  const metrics = kpis.length ? kpis : ([["在线", "13,375"], ["会话", "584"], ["转化", "22.8%"], ["峰值", "96"]] as [string, string][]);
  return (
    <div className="h-full overflow-hidden bg-[#f7f8fb] p-4 text-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-semibold">
          <span className="mr-2 text-[#c45c2a]">CC</span>
          {title}
        </p>
        <span className="text-[10px] text-emerald-600">● LIVE</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {metrics.map(([k, v], i) => (
          <button
            key={k}
            type="button"
            onClick={() => setSel(i)}
            className={`rounded-xl border bg-white p-3 text-left ${i === sel ? "border-sky-400 ring-1 ring-sky-200" : "border-slate-200"}`}
          >
            <p className="text-[10px] text-slate-400">{k}</p>
            <p className="text-lg font-semibold">{v}</p>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-400">趋势 · {metrics[sel]?.[0]}</p>
          <svg viewBox="0 0 160 48" className="mt-2 h-16 w-full">
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              points={line.map((y, i) => `${8 + i * 20},${46 - ((y + sel * 4) % 90) * 0.45}`).join(" ")}
            />
          </svg>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-400">分布</p>
          <div className="mt-2 flex h-16 items-end gap-1">
            {bars.map((h, i) => (
              <button key={i} type="button" onClick={() => setSel(i % metrics.length)} className="flex-1 rounded-t bg-sky-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiveWebgl({ title, interactive = true }: { title: string; interactive?: boolean }) {
  const [rot, setRot] = useState(12);
  const Hit = interactive ? "button" : "div";
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.25),transparent_50%)]" />
      <Hit
        type="button"
        onClick={() => interactive && setRot((r) => r + 25)}
        className="relative w-64"
        style={{ transform: `rotateY(${rot}deg) rotateX(8deg)` }}
      >
        <div className="aspect-square rounded-2xl border border-white/20 bg-gradient-to-br from-sky-400/40 to-indigo-700/40 p-6 text-center text-white shadow-2xl">
          <p className="text-xs tracking-[0.3em] text-sky-100">WEBGL</p>
          <p className="mt-2 text-lg font-semibold">{title}</p>
          <p className="mt-3 text-[11px] text-sky-100/80">点击旋转展台</p>
        </div>
      </Hit>
    </div>
  );
}

export function LiveImage({ src, title }: { src?: string; title: string }) {
  if (src?.includes("lamp-levitation") || title.includes("磁悬浮") || title.includes("氛围灯")) {
    return <LiveLamp3D />;
  }
  if (!src) return <p className="p-8 text-sm text-stone-500">{title}</p>;
  return (
    <div className="flex h-full items-center justify-center bg-stone-950 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} className="max-h-full max-w-full object-contain" />
    </div>
  );
}
