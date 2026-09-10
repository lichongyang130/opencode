"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

/** 每张咨询卡独立大纲与版式，禁止 12 卡共用一副骨架。示意非实测。 */

type Kind = "cover" | "photo" | "photoL" | "cards" | "quote" | "table" | "time" | "split" | "close";

type Slide = {
  kind: Kind;
  kicker: string;
  title: string;
  sub?: string;
  photo?: string;
  items?: { h: string; b: string }[];
  rows?: string[][];
  steps?: { t: string; d: string }[];
};

const P = {
  hero: "/cases/ppt/cover-hero.jpg",
  launch: "/cases/ppt/product-launch.jpg",
  report: "/cases/ppt/work-report.jpg",
  pitch: "/cases/ppt/pitch.jpg",
  proposal: "/cases/ppt/proposal.jpg",
  board: "/cases/ppt/scene-board.jpg",
  data: "/cases/ppt/scene-data.jpg",
  navy: "/cases/ppt/bg-navy.jpg",
  gold: "/cases/ppt/bg-gold.jpg",
};

function deckFor(title?: string): Slide[] {
  const t = title ?? "";
  if (t.includes("汇报") || t.includes("金字塔")) return reportDeck();
  if (t.includes("路演") || t.includes("融资")) return pitchDeck();
  if (t.includes("提案")) return proposalDeck();
  if (t.includes("培训") || t.includes("PREP")) return prepDeck();
  if (t.includes("年终")) return yearDeck();
  if (t.includes("行业")) return industryDeck();
  if (t.includes("FAB") || t.includes("面谈")) return fabDeck();
  if (t.includes("复盘")) return retroDeck();
  if (t.includes("竞品")) return competeDeck();
  if (t.includes("周会")) return weeklyDeck();
  if (t.includes("董事会") || t.includes("地图")) return boardDeck();
  return scqaDeck(t);
}

function scqaDeck(title: string): Slide[] {
  return [
    { kind: "cover", kicker: "SCQA  ·  15 MIN", title: title || "产品发布 SCQA", sub: "同一会话，交可上会的页。", photo: P.hero },
    { kind: "cards", kicker: "地图", title: "S → C → Q → A", items: [
      { h: "S", b: "不缺模型，缺能上会的页" }, { h: "C", b: "对话停在草稿" },
      { h: "Q", b: "怎样当场可投屏" }, { h: "A", b: "预览即成品" },
    ]},
    { kind: "photo", kicker: "S  情境", title: "聊天很快，上会仍隔夜", sub: "决策者不批提示词。", photo: P.board },
    { kind: "quote", kicker: "C  冲突", title: "周转被粘贴吃掉。", sub: "换一层聊天皮肤，不值得换工具。" },
    { kind: "photoL", kicker: "Q  疑问", title: "15 分钟后，桌上要有页", photo: P.data },
    { kind: "split", kicker: "A  答案", title: "文档 · PPT · 研究", items: [
      { h: "文档", b: "米色纸页可复制" }, { h: "PPT", b: "可翻页投屏" }, { h: "研究", b: "发现/对照/建议" },
    ]},
    { kind: "table", kicker: "对照", title: "旧路径 vs 本方案", rows: [
      ["动作", "旧", "新"], ["周报", "聊天→排版", "会话内纸页"], ["路演", "大纲→设计", "可翻页 PPT"],
    ]},
    { kind: "time", kicker: "路径", title: "8 周试点", steps: [
      { t: "W1–2", d: "周报 10 人" }, { t: "W3–5", d: "路演内部会" }, { t: "W6–8", d: "少一次隔夜排版" },
    ]},
    { kind: "close", kicker: "NEXT", title: "批准 20 席位、8 周、两件验收物。", photo: P.launch },
  ];
}

function reportDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "BOARD PRE-READ", title: "工作汇报 · 结论先行", sub: "进度、风险、下一步。未知数字待核实。", photo: P.report },
    { kind: "quote", kicker: "结论", title: "试点可进入第二阶段。", sub: "不扩全员；先锁两件成品。" },
    { kind: "cards", kicker: "三支柱", title: "只带这三件事上会", items: [
      { h: "进度", b: "周报模板已跑 10 人" }, { h: "风险", b: "配额与口径未封板" }, { h: "下一步", b: "路演投一次内部会" },
    ]},
    { kind: "photo", kicker: "进度", title: "栏目预览已等于交付物", photo: P.board },
    { kind: "table", kicker: "风险", title: "红黄绿灯（示意）", rows: [
      ["项", "状态", "口径"], ["模型配额", "黄", "演示兜底"], ["口径", "绿", "规划/待验证同页"], ["切换成本", "黄", "不迁全库"],
    ]},
    { kind: "time", kicker: "下一步", title: "本季只做两件", steps: [
      { t: "本周", d: "锁定周报口径" }, { t: "四周内", d: "路演投屏" }, { t: "季末", d: "决定是否扩席" },
    ]},
    { kind: "close", kicker: "请批", title: "请批第二阶段，不扩全员。", photo: P.report },
  ];
}

function pitchDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "SEED  ·  STORY ARC", title: "融资路演", sub: "问题 → 方案 → 差异 → 路径。不编 ARR。", photo: P.pitch },
    { kind: "photo", kicker: "世界", title: "对话很多，成品仍隔夜", photo: P.board },
    { kind: "quote", kicker: "冲突", title: "董事会不买提示词。", sub: "他们买能投屏的页。" },
    { kind: "photoL", kicker: "方案", title: "同一会话，三种栏目成品", photo: P.data },
    { kind: "cards", kicker: "为何是现在", title: "上会节奏被粘贴拖死", items: [
      { h: "痛", b: "隔夜排版" }, { h: "解", b: "预览即版式" }, { h: "卡点", b: "口径必须诚实" },
    ]},
    { kind: "split", kicker: "差异", title: "不是又一层套壳", items: [
      { h: "通用聊天", b: "结构清楚，版式另做" }, { h: "开帆", b: "预览即上会" },
    ]},
    { kind: "time", kicker: "路径", title: "进入尽调前只证明两件", steps: [
      { t: "现在", d: "文档纸页" }, { t: "四周", d: "可翻页 PPT" }, { t: "尽调", d: "看投屏不看话术" },
    ]},
    { kind: "close", kicker: "ASK", title: "请进入尽调。", sub: "不编客户名与 ARR。", photo: P.pitch },
  ];
}

function proposalDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "CLIENT PROPOSAL", title: "方案提案 · 问题解决", sub: "效果写规划口径。", photo: P.proposal },
    { kind: "photo", kicker: "现状", title: "工具很多，成品仍隔夜", photo: P.board },
    { kind: "cards", kicker: "问题", title: "三处卡住上会", items: [
      { h: "粘贴", b: "对话→文档→PPT" }, { h: "口径", b: "规划写成实测" }, { h: "验收", b: "看提示词不看页" },
    ]},
    { kind: "photoL", kicker: "方案", title: "会话里直接出栏目", photo: P.launch },
    { kind: "table", kicker: "效果", title: "规划对照，不是承诺", rows: [
      ["项", "现在", "试点后（规划）"], ["周报", "隔夜", "当次会议"], ["路演", "另做设计", "预览翻页"],
    ]},
    { kind: "close", kicker: "下一步", title: "先签 8 周、20 席。", photo: P.proposal },
  ];
}

function prepDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "INTERNAL TRAINING  ·  PREP", title: "培训教学", sub: "每章一句观点，不是目录。", photo: P.gold },
    { kind: "quote", kicker: "P  观点", title: "预览必须等于交付物。", sub: "否则只是聊天皮肤。" },
    { kind: "cards", kicker: "R  理由", title: "为什么必须这样教", items: [
      { h: "听众", b: "只要结论" }, { h: "时间", b: "15 分钟面谈" }, { h: "风险", b: "规划当合同" },
    ]},
    { kind: "photo", kicker: "E  案例", title: "点开 PPT 必须可翻页", photo: P.data },
    { kind: "quote", kicker: "P  重申", title: "先教口径，再教版式。" },
    { kind: "close", kicker: "作业", title: "下周带两件成品来演。", photo: P.gold },
  ];
}

function yearDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "YEAR IN REVIEW", title: "年终总结 · 时间线", sub: "大事记与来年三件事。不编营收。", photo: P.report },
    { kind: "time", kicker: "过去", title: "这一年只记三件", steps: [
      { t: "Q1", d: "栏目预览立项" }, { t: "Q2–3", d: "文档纸页落地" }, { t: "Q4", d: "PPT 可翻页" },
    ]},
    { kind: "photo", kicker: "现在", title: "对话停在草稿的问题还在", photo: P.board },
    { kind: "cards", kicker: "未来", title: "来年只做三件事", items: [
      { h: "一", b: "周报当次交付" }, { h: "二", b: "路演可投屏" }, { h: "三", b: "口径模板化" },
    ]},
    { kind: "close", kicker: "收束", title: "不扩故事，扩成品。", photo: P.hero },
  ];
}

function industryDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "SECTOR BRIEF", title: "行业分析对照", sub: "发现 / 对照 / 建议。数据标示意。", photo: P.data },
    { kind: "cards", kicker: "发现", title: "工具层拥挤，交付层空", items: [
      { h: "聊天", b: "分钟级草稿" }, { h: "设计", b: "仍隔夜" }, { h: "上会", b: "要成品" },
    ]},
    { kind: "table", kicker: "对照", title: "示意格局（来源待补）", rows: [
      ["层", "玩家形态", "缺口"], ["模型", "通用对话", "无版式"], ["套壳", "提示词市场", "无投屏"], ["本方案", "栏目成品", "待试点"],
    ]},
    { kind: "photoL", kicker: "建议", title: "先占「能上会」这一格", photo: P.board },
    { kind: "close", kicker: "判断", title: "可执行：试点，不写未测份额。", photo: P.data },
  ];
}

function fabDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "CLIENT MEETING  ·  FAB", title: "客户面谈 FAB", sub: "利益对齐投入产出，不堆功能。", photo: P.launch },
    { kind: "photo", kicker: "F  特征", title: "同一会话三种栏目", photo: P.board },
    { kind: "cards", kicker: "A  优势", title: "相对通用聊天", items: [
      { h: "版式", b: "预览即页" }, { h: "口径", b: "规划分开写" }, { h: "验收", b: "看能否投屏" },
    ]},
    { kind: "quote", kicker: "B  利益", title: "少一次隔夜排版（规划）。", sub: "不是承诺的工时百分比。" },
    { kind: "close", kicker: "请拍板", title: "先 20 席，不迁全库。", photo: P.launch },
  ];
}

function retroDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "RETRO", title: "项目复盘时间线", sub: "失败与取舍写清楚。", photo: P.navy },
    { kind: "time", kicker: "过去", title: "发生了什么", steps: [
      { t: "立项", d: "按聊天交付" }, { t: "中期", d: "发现不能上会" }, { t: "现在", d: "改栏目成品" },
    ]},
    { kind: "split", kicker: "取舍", title: "我们放弃了什么", items: [
      { h: "放弃", b: "全员替换" }, { h: "坚持", b: "两件验收物" }, { h: "未决", b: "配额上限" },
    ]},
    { kind: "cards", kicker: "下一步", title: "可执行三项", items: [
      { h: "1", b: "锁周报模板" }, { h: "2", b: "路演投一次" }, { h: "3", b: "写风险一页" },
    ]},
    { kind: "close", kicker: "记一笔", title: "下次复盘只看成品，不看话术。", photo: P.navy },
  ];
}

function competeDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "ONE-PAGER", title: "竞品差异一页", sub: "禁止贬低竞品绝对化。", photo: P.data },
    { kind: "table", kicker: "对照", title: "维度并列（示意）", rows: [
      ["维度", "通用聊天", "设计工具", "开帆（规划）"],
      ["草稿", "强", "弱", "中"],
      ["版式", "无", "强", "预览即页"],
      ["上会", "想象", "另导出", "可翻页"],
    ]},
    { kind: "quote", kicker: "结论", title: "我们只打「能不能上会」。", sub: "不写「全面领先」。" },
    { kind: "close", kicker: "用途", title: "这一页可直接贴进预审包。", photo: P.data },
  ];
}

function weeklyDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "WEEKLY  ·  5 PAGES", title: "周会同步极简", sub: "完成 / 风险 / 求助。无装饰页。", photo: P.board },
    { kind: "cards", kicker: "完成", title: "本周合上的", items: [
      { h: "文档", b: "纸页图文混排" }, { h: "PPT", b: "可翻页封面" }, { h: "口径", b: "示意标注" },
    ]},
    { kind: "split", kicker: "风险", title: "两件黄灯", items: [
      { h: "配额", b: "演示模式兜底" }, { h: "图源", b: "生成图须换新底" },
    ]},
    { kind: "quote", kicker: "求助", title: "需要拍板：20 席还是 10 席。" },
    { kind: "close", kicker: "散会", title: "记下负责人，不追加页。", photo: P.board },
  ];
}

function boardDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "BOARD MAP", title: "董事会一页地图", sub: "论点、支撑、时间、强攻/带过。", photo: P.hero },
    { kind: "cards", kicker: "地图", title: "先看全篇", items: [
      { h: "论点", b: "会话即成品" }, { h: "支撑 1", b: "预览=交付  · 强攻" },
      { h: "支撑 2", b: "周转当次  · 强攻" }, { h: "支撑 3", b: "口径诚实  · 带过" },
      { h: "路径", b: "8 周两件  · 强攻" }, { h: "风险", b: "不全员  · 带过" },
    ]},
    { kind: "time", kicker: "时间", title: "15 分钟怎么切", steps: [
      { t: "2′", d: "地图" }, { t: "8′", d: "强攻三页" }, { t: "5′", d: "行动" },
    ]},
    { kind: "quote", kicker: "强攻", title: "只打「预览等于交付物」。" },
    { kind: "close", kicker: "请批", title: "批准地图，再拆章节。", photo: P.hero },
  ];
}

export function LivePpt({ title }: { title?: string }) {
  const slides = useMemo(() => deckFor(title), [title]);
  const [i, setI] = useState(0);
  const n = slides.length;
  useEffect(() => setI(0), [title]);
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

  const s = slides[i] ?? slides[0];

  return (
    <div className="flex h-full flex-col bg-[#14120e]">
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="relative aspect-video w-full max-h-full overflow-hidden rounded-[4px] bg-[#0c1220] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)]">
          <SlideFace s={s} index={i} total={n} />
          <button type="button" aria-label="上一页" onClick={() => go(-1)} className="absolute inset-y-0 left-0 z-10 w-[18%] bg-transparent" />
          <button type="button" aria-label="下一页" onClick={() => go(1)} className="absolute inset-y-0 right-0 z-10 w-[18%] bg-transparent" />
        </div>
      </div>
      <div className="flex items-center justify-between px-4 pb-3 text-[11px] text-[#b8a078]">
        <button type="button" onClick={() => go(-1)} className="tracking-[0.16em]">←  PREV</button>
        <span className="max-w-[50%] truncate font-mono tracking-[0.12em]">
          {title ?? "PPT"}  ·  {String(i + 1).padStart(2, "0")}/{String(n).padStart(2, "0")}
        </span>
        <button type="button" onClick={() => go(1)} className="tracking-[0.16em]">NEXT  →</button>
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 px-[6%] pb-[7%]">
          <p className={`text-[11px] tracking-[0.42em] ${gold}`}>{s.kicker}</p>
          <h1 className="mt-4 max-w-[90%] text-[clamp(26px,4vw,50px)] font-semibold leading-[1.12] text-white">{s.title}</h1>
          {s.sub && <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/75">{s.sub}</p>}
          <p className="mt-8 font-mono text-[10px] tracking-[0.28em] text-white/40">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
        </div>
      </div>
    );
  }

  if (s.kind === "photo" || s.kind === "photoL") {
    const img = (
      <div className="relative min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.photo} alt="" className="h-full w-full object-cover" />
      </div>
    );
    const copy = (
      <div className="flex flex-col justify-between bg-[#0c1220] px-[8%] py-[9%]">
        <div>
          <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
          <h1 className="mt-5 text-[clamp(22px,3vw,36px)] font-semibold leading-[1.2] text-white">{s.title}</h1>
          {s.sub && <p className="mt-5 max-w-md text-[15px] leading-7 text-white/65">{s.sub}</p>}
        </div>
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/30">{String(index + 1).padStart(2, "0")}</p>
      </div>
    );
    return (
      <div className="absolute inset-0 grid grid-cols-2">
        {s.kind === "photoL" ? <>{img}{copy}</> : <>{copy}{img}</>}
      </div>
    );
  }

  if (s.kind === "quote") {
    return (
      <div className="absolute inset-0 bg-[#0c1220]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={P.gold} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
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
      <Plate>
        <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
        <h1 className="mt-3 text-[clamp(22px,2.8vw,34px)] font-semibold text-white">{s.title}</h1>
        <table className="mt-8 w-full border-collapse text-left text-[14px] text-white/80">
          <thead>
            <tr className="border-b border-[#e2c48a]/40">
              {head.map((h) => (
                <th key={h} className="pb-3 font-medium text-[#e2c48a]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r) => (
              <tr key={r.join()} className="border-b border-white/10">
                {r.map((c) => (
                  <td key={c} className="py-3.5">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Plate>
    );
  }

  if (s.kind === "time" && s.steps) {
    return (
      <Plate>
        <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
        <h1 className="mt-3 text-[clamp(22px,2.8vw,34px)] font-semibold text-white">{s.title}</h1>
        <div className="mt-10 flex gap-6">
          {s.steps.map((st, i) => (
            <div key={st.t} className="flex-1 border-t-2 border-[#e2c48a] pt-5">
              <p className="font-mono text-[12px] text-[#e2c48a]">{String(i + 1).padStart(2, "0")}  {st.t}</p>
              <p className="mt-3 text-[16px] leading-7 text-white/80">{st.d}</p>
            </div>
          ))}
        </div>
      </Plate>
    );
  }

  const cols = s.items && s.items.length > 4 ? "grid-cols-3" : s.items && s.items.length > 3 ? "grid-cols-4" : s.items && s.items.length === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <Plate>
      <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
      <h1 className="mt-3 max-w-3xl text-[clamp(22px,2.8vw,34px)] font-semibold leading-[1.2] text-white">{s.title}</h1>
      <div className={`mt-8 grid gap-5 ${cols}`}>
        {s.items?.map((it) => (
          <div key={it.h} className="border-t border-[#e2c48a]/50 pt-4">
            <p className="text-[13px] tracking-[0.2em] text-[#e2c48a]">{it.h}</p>
            <p className="mt-3 text-[14px] leading-7 text-white/75">{it.b}</p>
          </div>
        ))}
      </div>
    </Plate>
  );
}

function Plate({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-[#0c1220] px-[7%] py-[7%]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={P.navy} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="relative">{children}</div>
    </div>
  );
}
