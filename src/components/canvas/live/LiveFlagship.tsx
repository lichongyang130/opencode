"use client";

import type { ReactNode } from "react";
import { FLAGSHIP_PACKS, type FlagshipPack } from "@/lib/flagshipPacks";

export function LiveFlagshipByTitle({ title }: { title: string }) {
  const pack = FLAGSHIP_PACKS.find((p) => p.match.some((m) => title.includes(m)));
  if (!pack) return null;
  return <LiveFlagship pack={pack} />;
}

export function LiveFlagship({ pack }: { pack: FlagshipPack }) {
  return (
    <div className="h-full overflow-y-auto bg-[#d9d2c5] px-3 py-6 text-stone-800 sm:px-10">
      <article className="mx-auto max-w-[1100px] bg-[#fffcf7] px-6 py-8 shadow-[0_18px_60px_-20px_rgba(28,25,23,0.45)] sm:px-12 sm:py-12">
        <p className="text-[11px] font-medium tracking-[0.28em] text-teal-800">{pack.kicker}</p>
        <p className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] leading-6 text-stone-600">{pack.disclaimer}</p>

        <section className="mt-8">
          <h1 className="text-[28px] font-semibold tracking-tight text-stone-900 sm:text-[34px]">{pack.name}</h1>
          <p className="mt-2 text-[16px] text-stone-600">{pack.claim}</p>
          <Shot src={pack.hero.src} cap={pack.hero.cap} />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(pack.gallery ?? []).slice(0, 4).map((g) => (
              <figure key={g.src + g.cap} className="overflow-hidden border border-stone-200 bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={g.cap} className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-2 py-1 text-[10px] text-stone-500">{g.cap}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-stone-400">{pack.nav}</p>
        </section>

        <Section n="首页" title="三项核心价值">
          <Cards items={pack.values} />
        </Section>

        <Section n="场景" title="使用预览">
          <Cards items={pack.scenes} />
        </Section>

        {pack.sections.map((s) => (
          <Section key={s.n} n={s.n} title={s.title}>
            <p className="mt-3 text-[14px] font-medium leading-7 text-teal-800">{s.thesis}</p>
            {s.shot && <Shot src={s.shot.src} cap={s.shot.cap} />}
            <p className="mt-4 text-[13.5px] leading-7 text-stone-600">{s.body}</p>
            {s.cards && <Cards items={s.cards} />}
            {s.rows && (
              <table className="mt-5 w-full border-collapse text-[12px] text-stone-600">
                <tbody>
                  {s.rows.map(([k, v]) => (
                    <tr key={k} className="border-b border-stone-200">
                      <td className="py-2 pr-3 font-medium text-stone-800">{k}</td>
                      <td className="py-2">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {s.note && <p className="mt-3 text-[11px] leading-6 text-stone-500">条件 / 脚注：{s.note}</p>}
            {s.vis && <p className="mt-2 text-[11px] leading-6 text-stone-500">视觉：{s.vis}</p>}
          </Section>
        ))}

        <div className="mt-10 flex flex-wrap gap-3 text-[13px]">
          {pack.ctas.map((c) => (
            <span key={c} className="rounded-full border border-stone-300 px-4 py-2 text-stone-700">
              {c}
            </span>
          ))}
        </div>
        <p className="mt-6 text-[12px] text-stone-500">{pack.contact}</p>
      </article>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-stone-200 pt-8">
      <p className="font-mono text-[11px] tracking-[0.28em] text-teal-800">{n}</p>
      <h2 className="mt-2 text-[22px] font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

function Cards({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {items.map(([h, b]) => (
        <div key={h} className="border border-stone-200 bg-white p-3">
          <p className="text-[11px] tracking-wide text-teal-800">{h}</p>
          <p className="mt-1.5 text-[12px] leading-6 text-stone-600">{b}</p>
        </div>
      ))}
    </div>
  );
}

function Shot({ src, cap }: { src: string; cap: string }) {
  return (
    <figure className="mt-6 overflow-hidden rounded-sm border border-stone-200 bg-stone-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={cap} className="aspect-video w-full object-cover" />
      <figcaption className="px-3 py-2 text-[11px] text-stone-500">{cap}</figcaption>
    </figure>
  );
}
