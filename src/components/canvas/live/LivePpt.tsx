"use client";

import { useCallback, useEffect, useState } from "react";

/** 咨询级 16:9 路演：一页一屏、封面全幅、少字大标题。示意非实测。 */

type Kind = "cover" | "photo" | "cards" | "quote" | "table" | "close";

type Slide = {
  kind: Kind;
  kicker: string;
  title: string;
  sub?: string;
  photo?: string;
  items?: { h: string; b: string }[];
  rows?: string[][];
};

function coverOf(title?: string) {
  if (title?.includes("汇报")) return "/cases/ppt/work-report.jpg";
  if (title?.includes("路演") || title?.includes("融资")) return "/cases/ppt/pitch.jpg";
  if (title?.includes("提案")) return "/cases/ppt/proposal.jpg";
  return "/cases/ppt/cover-hero.jpg";
}

export function LivePpt({ title }: { title?: string }) {
  const hero = coverOf(title);
  const slides: Slide[] = [
    {
      kind: "cover",
      kicker: "PRODUCT BRIEFING  ·  15 MIN",
      title: title || "开帆画布 · 对话即成品",
      sub: "同一会话，交可上会的页。不是再给一段提示词。",
      photo: hero,
    },
    {
      kind: "cards",
      kicker: "01  逻辑地图",
      title: "先看全篇，再进章节",
      items: [
        { h: "情境", b: "1 页 · 快过\n不缺模型，缺能上会的页" },
        { h: "冲突", b: "1 页 · 快过\n对话停在草稿" },
        { h: "答案", b: "3 页 · 强攻\n预览即成品" },
        { h: "路径", b: "2 页 · 强攻\n8 周两件验收" },
      ],
    },
    {
      kind: "photo",
      kicker: "02  情境",
      title: "不缺模型，缺能上会的页",
      sub: "聊天很快。上会仍要隔夜排版。决策者不批提示词。",
      photo: "/cases/ppt/scene-board.jpg",
    },
    {
      kind: "quote",
      kicker: "03  冲突",
      title: "对话停在草稿，周转被粘贴吃掉。",
      sub: "如果只是换一层聊天皮肤，不值得换工具。",
    },
    {
      kind: "cards",
      kicker: "04  疑问",
      title: "15 分钟后面，桌上要有能投屏的页",
      items: [
        { h: "文档", b: "点开是正文纸页" },
        { h: "PPT", b: "点开可翻页，不是单图" },
        { h: "口径", b: "示意与承诺分开写" },
      ],
    },
    {
      kind: "photo",
      kicker: "05  答案",
      title: "对话即成品",
      sub: "文档 · PPT · 研究，同一会话三种栏目。",
      photo: "/cases/ppt/scene-data.jpg",
    },
    {
      kind: "cards",
      kicker: "06  差异",
      title: "栏目预览必须等于交付物",
      items: [
        { h: "左侧", b: "可交互成品" },
        { h: "右侧", b: "介绍与提示词" },
        { h: "禁止", b: "大图 + 一行 prompt" },
      ],
    },
    {
      kind: "table",
      kicker: "07  对照",
      title: "周转从隔夜，压到当次会议",
      rows: [
        ["动作", "旧路径", "本方案"],
        ["周报", "聊天 → 文档 → 排版", "会话内纸页"],
        ["路演", "大纲 → 设计 → 改稿", "可翻页 PPT"],
        ["验收", "看提示词", "看能否投屏"],
      ],
    },
    {
      kind: "cards",
      kicker: "08  质疑",
      title: "和通用聊天的差，在于能不能上会",
      items: [
        { h: "通用聊天", b: "结构清楚，版式另做" },
        { h: "开帆画布", b: "预览即版式" },
        { h: "未知项", b: "写待验证，不装已量产" },
      ],
    },
    {
      kind: "cards",
      kicker: "09  路径",
      title: "8 周试点，只验收两件成品",
      items: [
        { h: "W1–2", b: "周报模板，10 人先跑" },
        { h: "W3–5", b: "路演投一次内部会" },
        { h: "W6–8", b: "看是否少一次隔夜排版" },
      ],
    },
    {
      kind: "cards",
      kicker: "10  风险",
      title: "不全员替换，不把示意写成合同",
      items: [
        { h: "配额", b: "演示模式兜底" },
        { h: "口径", b: "规划 / 待验证同页" },
        { h: "切换", b: "先两件成品" },
      ],
    },
    {
      kind: "close",
      kicker: "NEXT",
      title: "请批准 20 席位、8 周、两件验收物。",
      sub: "概念方案 · 功能为规划设定",
      photo: "/cases/ppt/product-launch.jpg",
    },
  ];

  const [i, setI] = useState(0);
  const n = slides.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const s = slides[i];

  return (
    <div className="flex h-full flex-col bg-[#14120e]">
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="relative aspect-video w-full max-h-full overflow-hidden rounded-[4px] bg-[#0c1220] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)]">
          <SlideFace s={s} index={i} total={n} />
          <button
            type="button"
            aria-label="上一页"
            onClick={() => go(-1)}
            className="absolute inset-y-0 left-0 z-10 w-[18%] cursor-w-resize bg-transparent"
          />
          <button
            type="button"
            aria-label="下一页"
            onClick={() => go(1)}
            className="absolute inset-y-0 right-0 z-10 w-[18%] cursor-e-resize bg-transparent"
          />
        </div>
      </div>
      <div className="flex items-center justify-between px-4 pb-3 text-[11px] text-[#b8a078]">
        <button type="button" onClick={() => go(-1)} className="tracking-[0.16em]">
          ←  PREV
        </button>
        <span className="font-mono tracking-[0.2em]">
          {String(i + 1).padStart(2, "0")}  /  {String(n).padStart(2, "0")}
        </span>
        <button type="button" onClick={() => go(1)} className="tracking-[0.16em]">
          NEXT  →
        </button>
      </div>
    </div>
  );
}

function SlideFace({ s, index, total }: { s: Slide; index: number; total: number }) {
  const gold = "text-[#e2c48a]";
  if (s.kind === "cover" || s.kind === "close") {
    return (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.photo} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 px-[6%] pb-[7%] pt-16">
          <p className={`text-[11px] tracking-[0.42em] ${gold}`}>{s.kicker}</p>
          <h1 className="mt-4 max-w-[90%] text-[clamp(28px,4.2vw,52px)] font-semibold leading-[1.12] tracking-tight text-white">
            {s.title}
          </h1>
          {s.sub && <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/75">{s.sub}</p>}
          <p className="mt-8 font-mono text-[10px] tracking-[0.28em] text-white/40">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
        </div>
      </div>
    );
  }

  if (s.kind === "photo") {
    return (
      <div className="absolute inset-0 grid grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between bg-[#0c1220] px-[8%] py-[9%]">
          <div>
            <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
            <h1 className="mt-5 text-[clamp(22px,3.1vw,38px)] font-semibold leading-[1.2] text-white">{s.title}</h1>
            {s.sub && <p className="mt-5 max-w-md text-[15px] leading-7 text-white/65">{s.sub}</p>}
          </div>
          <p className="font-mono text-[10px] tracking-[0.28em] text-white/30">
            {String(index + 1).padStart(2, "0")}
          </p>
        </div>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.photo} alt="" className="h-full w-full object-cover" />
        </div>
      </div>
    );
  }

  if (s.kind === "quote") {
    return (
      <div className="absolute inset-0 bg-[#0c1220]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cases/ppt/bg-navy.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="relative flex h-full flex-col justify-center px-[9%]">
          <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
          <h1 className="mt-6 max-w-3xl text-[clamp(26px,3.6vw,44px)] font-semibold leading-[1.18] text-white">{s.title}</h1>
          {s.sub && <p className="mt-6 max-w-lg text-[16px] leading-8 text-[#e2c48a]/90">{s.sub}</p>}
        </div>
      </div>
    );
  }

  if (s.kind === "table" && s.rows) {
    const [head, ...body] = s.rows;
    return (
      <div className="absolute inset-0 bg-[#0c1220] px-[7%] py-[7%]">
        <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
        <h1 className="mt-3 text-[clamp(22px,2.8vw,34px)] font-semibold text-white">{s.title}</h1>
        <table className="mt-8 w-full border-collapse text-left text-[14px] text-white/80">
          <thead>
            <tr className="border-b border-[#e2c48a]/40">
              {head.map((h) => (
                <th key={h} className="pb-3 font-medium tracking-wide text-[#e2c48a]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r) => (
              <tr key={r[0]} className="border-b border-white/10">
                {r.map((c) => (
                  <td key={c} className="py-3.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[11px] text-white/35">规划对照，不是承诺的工时减少百分比。</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#0c1220] px-[7%] py-[7%]">
      <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
      <h1 className="mt-3 max-w-3xl text-[clamp(22px,2.8vw,34px)] font-semibold leading-[1.2] text-white">{s.title}</h1>
      <div className={`mt-8 grid gap-4 ${s.items && s.items.length > 3 ? "grid-cols-4" : "grid-cols-3"}`}>
        {s.items?.map((it) => (
          <div key={it.h} className="border-t border-[#e2c48a]/50 pt-4">
            <p className="text-[13px] tracking-[0.2em] text-[#e2c48a]">{it.h}</p>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-7 text-white/75">{it.b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
