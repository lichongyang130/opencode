"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * 按咨询四层框架落地的可翻页 PPT（示意，非客户实测）。
 * 主题：开帆画布「对话即成品」· 产品发布 / 方案提案
 * 结构：SCQA + 金字塔（结论先行）
 */

type Slide = {
  kicker?: string;
  title: string;
  note?: string;
  body: ReactNode;
};

const BRIEF = {
  theme: "开帆画布 · 对话即成品",
  type: "产品发布 / 方案提案",
  scene: "客户面谈 · 董事会预审",
  minutes: 15,
  pages: 12,
  speaker: true,
  audience: "增长与内容团队负责人 8–15 人",
  weight: "最终决策者 + 影响决策者",
  expert: "跨行业、有工具使用基础",
  cares: ["投入产出比", "可行性与风险", "与聊天工具的差异"],
  pushback: "会不会又是一层 ChatGPT 套壳",
  patience: "只要结论和关键数据",
  prior: "有基础了解，未看过成品演示",
  thesis: "同一会话里直接交付可上会的文档与 PPT，而不是再给一段提示词草稿。",
  action: "批准 20 席位、8 周试点，用周报与路演两件成品验收。",
};

function LivePptDeck({ kickerTitle }: { kickerTitle?: string }) {
  const slides: Slide[] = [
    {
      kicker: "PRODUCT BRIEFING · 15′",
      title: BRIEF.theme,
      note: "封面 · 30″",
      body: (
        <div className="mt-10 grid gap-8 sm:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[18px] leading-8 text-stone-300">把研究、文档与幻灯片收进同一会话。听众带走的是成品，不是提示词。</p>
            <p className="mt-8 text-[12px] tracking-[0.2em] text-amber-200/80">SCQA · 金字塔 · 示意数据</p>
            <ul className="mt-6 space-y-2 text-[13px] text-stone-400">
              <li>场景：{BRIEF.scene}</li>
              <li>听众：{BRIEF.audience}</li>
              <li>行动：试点席位，而不是全员替换。</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-[11px] tracking-[0.16em] text-amber-200/70">一句话论点</p>
            <p className="mt-3 text-[15px] leading-7 text-stone-100">{BRIEF.thesis}</p>
          </div>
        </div>
      ),
    },
    {
      kicker: "LAYER 1 · 逻辑地图",
      title: "先看全篇，再进章节",
      note: "地图 · 90″ · 重点强攻：答案与差异",
      body: (
        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {[
            ["S 情境", "1 页 · 快过", "工具很多，成品仍隔夜"],
            ["C 冲突", "1 页 · 快过", "对话停在草稿"],
            ["Q 疑问", "1 页 · 带过", "怎样当场可上会"],
            ["A 答案", "3 页 · 强攻", "会话即栏目成品"],
            ["路径", "2 页 · 强攻", "试点、风险、下一步"],
          ].map(([h, t, d]) => (
            <div key={h} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[12px] font-semibold text-amber-200">{h}</p>
              <p className="mt-1 text-[10px] text-stone-500">{t}</p>
              <p className="mt-2 text-[12px] leading-5 text-stone-300">{d}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      kicker: "S · 情境",
      title: "团队并不缺模型，缺的是能上会的页。",
      note: "情境 · 60″",
      body: (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["聊天很快", "生成一段结构说明只需分钟级。"],
            ["上会很慢", "还要拷进文档、重排 PPT、对口径。"],
            ["决策看成品", "董事会不批「提示词写得很好」。"],
          ].map(([h, b]) => (
            <div key={h} className="rounded-xl border border-white/10 p-4">
              <p className="text-[14px] font-medium text-stone-100">{h}</p>
              <p className="mt-2 text-[13px] leading-6 text-stone-400">{b}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      kicker: "C · 冲突",
      title: "对话停在草稿，周转被粘贴吃掉。",
      note: "冲突 · 60″",
      body: (
        <div className="mt-8 space-y-4 text-[15px] leading-8 text-stone-300">
          <p>同一份周报：对话里已经有要点，文档里还要重排标题，PPT 里再做一版封面。</p>
          <p>抵触点预先承认：如果只是把聊天框换个皮肤，不值得换工具。</p>
          <p className="text-amber-200/90">所以本方案只证明一件事：预览里就是可翻页、可复制的成品。</p>
        </div>
      ),
    },
    {
      kicker: "Q · 疑问",
      title: "怎样让 15 分钟面谈结束时，桌上已经有能投屏的页？",
      note: "疑问 · 40″",
      body: (
        <ul className="mt-8 list-disc space-y-3 pl-5 text-[15px] leading-8 text-stone-300">
          <li>文档点开是正文，不是大图配提示词。</li>
          <li>PPT 点开可翻页，不是静态封面。</li>
          <li>示意与承诺分开写，避免把规划当实测。</li>
        </ul>
      ),
    },
    {
      kicker: "A · 答案",
      title: "对话即成品：同一会话，三种栏目。",
      note: "答案 · 强攻 2′",
      body: (
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["文档", "米色纸页、图文手册、可滚动复制"],
            ["PPT", "深色大屏、可翻页、演讲备注"],
            ["研究", "发现 / 对照 / 建议分栏，不编客户"],
          ].map(([h, b]) => (
            <div key={h} className="rounded-xl border border-amber-200/20 bg-amber-200/5 p-4">
              <p className="text-[13px] tracking-[0.16em] text-amber-200">{h}</p>
              <p className="mt-2 text-[13px] leading-6 text-stone-200">{b}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      kicker: "支柱 1",
      title: "栏目预览必须等于交付物。",
      note: "差异化 · 强攻 90″",
      body: (
        <div className="mt-8 space-y-3 text-[15px] leading-8 text-stone-300">
          <p>点卡片：左侧是可交互成品，右侧才是介绍与提示词。</p>
          <p>禁止「大图 + 下面一行 prompt」充当文档。</p>
          <p className="text-stone-500">示意：旗舰手册 12 卡已按此口径落地，不是实验室跑分。</p>
        </div>
      ),
    },
    {
      kicker: "支柱 2",
      title: "周转从隔夜压到当次会议。",
      note: "投入产出 · 90″",
      body: (
        <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-[13px] text-stone-300">
            <thead className="bg-white/5 text-stone-400">
              <tr>
                {["动作", "旧路径", "本方案"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["周报", "聊天 → 文档 → 排版", "会话内纸页成品"],
                ["路演", "大纲 → 设计 → 改稿", "可翻页 PPT 预览"],
                ["验收", "看提示词质量", "看能否投屏"],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-white/10">
                  {r.map((c) => (
                    <td key={c} className="px-3 py-2.5">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-stone-500">表内为规划对照，不是承诺的工时减少百分比。</p>
        </div>
      ),
    },
    {
      kicker: "支柱 3",
      title: "和通用聊天的差，在于「能不能上会」。",
      note: "质疑预答 · 60″",
      body: (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-[12px] text-stone-500">通用聊天</p>
            <p className="mt-2 text-[14px] leading-7 text-stone-300">结构清楚，版式要另做。听众仍要想象成品长什么样。</p>
          </div>
          <div className="rounded-xl border border-amber-200/30 p-4">
            <p className="text-[12px] text-amber-200/80">开帆画布</p>
            <p className="mt-2 text-[14px] leading-7 text-stone-200">预览即版式。未知规格写待验证，不把规划写成已量产。</p>
          </div>
        </div>
      ),
    },
    {
      kicker: "路径",
      title: "8 周试点，只验收两件成品。",
      note: "可行性 · 90″",
      body: (
        <ol className="mt-8 space-y-3 text-[14px] leading-7 text-stone-300">
          <li>
            <b className="text-stone-100">W1–2</b> 接入周报模板，10 人先跑。
          </li>
          <li>
            <b className="text-stone-100">W3–5</b> 路演 PPT 可翻页，投一次内部会。
          </li>
          <li>
            <b className="text-stone-100">W6–8</b> 对照「能否减少一次隔夜排版」，不写未测 ROI。
          </li>
        </ol>
      ),
    },
    {
      kicker: "风险",
      title: "不试点全员替换；不把示意当合同条款。",
      note: "风险 · 45″",
      body: (
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["模型配额", "演示模式兜底，避免周五见顶"],
            ["口径", "规划 / 待验证 / 示意必须同页出现"],
            ["切换成本", "先两件成品，不迁全库"],
          ].map(([h, b]) => (
            <div key={h} className="rounded-xl border border-white/10 p-4">
              <p className="text-[13px] text-amber-200">{h}</p>
              <p className="mt-2 text-[12px] leading-6 text-stone-400">{b}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      kicker: "NEXT",
      title: "请批准 20 席位、8 周、两件验收物。",
      note: "行动 · 60″",
      body: (
        <div className="mt-10">
          <p className="text-[16px] leading-8 text-stone-200">{BRIEF.action}</p>
          <p className="mt-6 text-[13px] text-stone-500">联系占位：pilot@opencanvas.example · 本页为概念方案，功能为规划设定。</p>
        </div>
      ),
    },
  ];

  const [i, setI] = useState(0);
  const n = slides.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const s = slides[i];

  return (
    <div className="flex h-full flex-col bg-[#0b0c10] text-stone-100">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] text-stone-500">
        <span>PPT · {kickerTitle || BRIEF.theme} · 共 {n} 页</span>
        <span>
          {i + 1} / {n} · 点画面或方向键翻页
        </span>
      </div>
      <button
        type="button"
        onClick={() => go(1)}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#1a1c22] p-4 text-left"
      >
        <div className="aspect-video w-full max-h-full overflow-y-auto rounded-sm bg-[#12141a] px-8 py-7 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]">
          <p className="text-[11px] tracking-[0.28em] text-amber-200/80">{s.kicker}</p>
          <h1 className="mt-3 max-w-3xl text-[24px] font-semibold leading-snug tracking-tight sm:text-[28px]">{s.title}</h1>
          {s.body}
          {s.note && <p className="mt-8 text-[11px] text-stone-600">{s.note}</p>}
        </div>
      </button>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
        <button type="button" onClick={() => go(-1)} className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-stone-300">
          上一页
        </button>
        <div className="flex gap-1">
          {slides.map((_, k) => (
            <button
              key={k}
              type="button"
              aria-label={`第 ${k + 1} 页`}
              onClick={() => setI(k)}
              className={`h-1.5 w-4 rounded-full ${k === i ? "bg-amber-300" : "bg-white/20"}`}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-stone-300">
          下一页
        </button>
      </div>
    </div>
  );
}

export function LivePpt({ title }: { title?: string }) {
  return <LivePptDeck kickerTitle={title} />;
}
