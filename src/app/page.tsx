"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clapperboard,
  Download,
  FileText,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  Monitor,
  Presentation,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ════════════════════════════════════════════════════════
 *  首页 · 编辑排版风（对应效果图 home-c5-editorial）
 *  “灵感进来，作品出去” —— 打字机排版导向的营销落地页。
 *  视觉主角是暖米三栏工作台的「浏览器窗口」产品图，
 *  下方 01/02/03 编号式功能纵列，底栏收束到单一 CTA。
 * ════════════════════════════════════════════════════════ */

const NAV_LINKS = [
  { label: "怎么用", href: "#how" },
  { label: "能做什么", href: "#capabilities" },
];

/* 图标轨里的能力图标（产品窗口缩略图用） */
const RAIL_CAPS = [
  { icon: Globe, tint: "text-rose-500" },
  { icon: Clapperboard, tint: "text-violet-500" },
  { icon: Monitor, tint: "text-sky-500" },
  { icon: LayoutDashboard, tint: "text-emerald-500" },
  { icon: Presentation, tint: "text-amber-500" },
];

/* 历史面板行（缩略图用，长度各异模拟真实标题） */
const HISTORY_ROWS = [
  { w: "w-24", active: true, chip: "bg-orange-200", icon: Presentation, tint: "text-orange-600" },
  { w: "w-20", active: false, chip: "bg-sky-200", icon: FileText, tint: "text-sky-600" },
  { w: "w-28", active: false, chip: "bg-emerald-200", icon: Search, tint: "text-emerald-600" },
  { w: "w-24", active: false, chip: "bg-violet-200", icon: ImageIcon, tint: "text-violet-600" },
  { w: "w-20", active: false, chip: "bg-amber-200", icon: MessageIcon, tint: "text-amber-600" },
];

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

/* ---------- 产品窗口：暖米三栏工作台（纯 CSS 绘制，保证锐利） ---------- */
function ProductWindow() {
  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[0_40px_90px_-20px_rgba(41,37,36,0.35)]">
      {/* 浏览器标题栏 */}
      <div className="flex items-center gap-2 border-b border-stone-100 bg-[#faf7f2] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="mx-auto flex h-5 w-44 items-center justify-center gap-1 rounded-md bg-white text-[9px] text-stone-400">
          opencanvas.app/chat
        </div>
      </div>

      {/* 三栏主体 */}
      <div className="flex h-[300px] text-left">
        {/* 图标轨 */}
        <div className="flex w-10 flex-col items-center gap-2 border-r border-[#e8ddca] bg-[#f5efe4] py-3">
          <div className="mb-1 flex h-5 w-5 items-center justify-center rounded-md bg-orange-500 text-[8px] font-bold text-white">
            O
          </div>
          {RAIL_CAPS.map((c, i) => (
            <c.icon key={i} className={cn("h-3 w-3", c.tint)} />
          ))}
          <div className="my-1 h-px w-4 bg-stone-200" />
        </div>

        {/* 历史面板 */}
        <div className="hidden w-32 flex-col border-r border-[#e8ddca] bg-[#fbf7ef] px-2 py-3 sm:flex">
          <div className="mb-2 text-[9px] font-semibold text-stone-500">对话历史</div>
          <div className="space-y-1.5">
            {HISTORY_ROWS.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-1.5 py-1",
                  r.active ? "bg-orange-50 ring-1 ring-orange-100" : ""
                )}
              >
                <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded", r.chip)}>
                  <r.icon className={cn("h-2 w-2", r.tint)} />
                </span>
                <span className={cn("h-1.5 rounded-full bg-stone-200", r.w)} />
              </div>
            ))}
          </div>
        </div>

        {/* 主对话区 */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#f9f5ec]">
          {/* 顶栏 */}
          <div className="flex items-center justify-between border-b border-[#e8ddca] px-3 py-2">
            <div className="text-[10px] font-semibold text-stone-700">智能助手</div>
            <div className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-full bg-orange-100 p-0.5 text-[6px] text-orange-500">
                <Sparkles className="h-2 w-2" />
              </span>
              <span className="h-3.5 w-3.5 rounded-full bg-stone-100" />
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-hidden px-3 py-3">
            {/* 问候 */}
            <div className="text-[11px] font-semibold text-[#4a2e1d]">欢迎回来，今天想做点什么？</div>
            {/* 用户气泡 */}
            <div className="ml-auto w-40 rounded-lg rounded-tr-sm bg-orange-500 px-2 py-1.5 text-[8.5px] leading-relaxed text-white">
              帮我做一份 AI 写作产品的发布会 PPT
            </div>
            {/* 助手输出区 */}
            <div className="w-52 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[8px] leading-4 text-stone-500">
              <div className="mb-1 flex items-center gap-1 font-medium text-stone-700">
                发布会方案 · 12 页
                <span className="ml-auto rounded bg-orange-50 px-1 text-[6.5px] text-orange-500">生成中</span>
              </div>
              <div className="h-1 w-full rounded bg-stone-100" />
              <div className="mt-1 h-1 w-11/12 rounded bg-stone-100" />
              <div className="mt-1 h-1 w-4/5 rounded bg-stone-100" />
            </div>
            <div className="w-44 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[8px] leading-4 text-stone-500">
              <div className="mb-1 font-medium text-stone-700">卖点：3 分钟从想法到成稿</div>
              <div className="h-1 w-full rounded bg-stone-100" />
              <div className="mt-1 h-1 w-3/4 rounded bg-stone-100" />
            </div>
          </div>
          {/* 输入条 */}
          <div className="border-t border-[#e8ddca] bg-[#fdfaf3] px-3 py-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2 py-1.5">
              <span className="h-1.5 w-16 rounded-full bg-stone-200" />
              <span className="ml-auto flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white">
                <ArrowRight className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 功能步骤（01 / 02 / 03） ---------- */
const STEPS = [
  {
    n: "01",
    title: "输入一句话",
    desc: "不用学工具、不用背指令。把你想做的事用大白话说出来，AI 会自己判断该用对话、文档、PPT 还是研究来完成。",
    art: (
      <div className="flex items-center gap-2 rounded-xl border border-stone-200/80 bg-white px-3 py-2 shadow-sm">
        <span className="text-[11px] text-stone-400">帮我整理一下本周的周报…</span>
        <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white">
          <ArrowRight className="h-3 w-3" strokeWidth={3} />
        </span>
      </div>
    ),
  },
  {
    n: "02",
    title: "AI 自动成稿",
    desc: "文档边想边写、PPT 按页排版、研究带引用出报告。生成过程实时可见，随时叫停、随时改写，产出直接落在右边的创作画布。",
    art: (
      <div className="w-full max-w-[260px] space-y-1.5 rounded-xl border border-stone-200/80 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1 text-[10px] text-stone-400">
          <span className="h-1 w-24 rounded bg-orange-300" />
          <span className="ml-auto rounded bg-orange-50 px-1 text-[9px] text-orange-500">第 5 / 12 页</span>
        </div>
        <div className="h-1 w-11/12 rounded bg-stone-100" />
        <div className="h-1 w-full rounded bg-stone-100" />
        <div className="h-1 w-4/5 rounded bg-stone-100" />
      </div>
    ),
  },
  {
    n: "03",
    title: "一键导出分享",
    desc: "PPT 导出 .pptx、文档导出 Word / Markdown、图片直接下载。生成分享链接，发给谁都能看。",
    art: (
      <div className="flex items-center gap-2 rounded-xl border border-stone-200/80 bg-white px-3 py-2 shadow-sm">
        {["PPTX", "WORD", "LINK"].map((f) => (
          <span
            key={f}
            className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-[9px] font-medium text-stone-500"
          >
            <Download className="h-2.5 w-2.5" />
            {f}
          </span>
        ))}
      </div>
    ),
  },
];

/* ---------- 能做什么（底部轻量模块） ---------- */
const CAPS = [
  { icon: FileText, label: "文档", desc: "周报 / 方案 / 计划书" },
  { icon: Presentation, label: "PPT", desc: "主题 → 整套幻灯片" },
  { icon: Search, label: "深度研究", desc: "联网查证 · 带引用报告" },
  { icon: ImageIcon, label: "图片", desc: "一句话生成 & 编辑" },
  { icon: Clapperboard, label: "视频脚本", desc: "分镜 / 口播 / 带货" },
  { icon: BarChart3, label: "数据分析", desc: "上传数据直接洞察" },
];

/* ---------- 页面 ---------- */
export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const scrollTo = (href: string) => {
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf8f2] text-stone-900 antialiased">
      {/* ═══════ 顶部导航 ═══════ */}
      <header className="sticky top-0 z-50 border-b border-stone-100/80 bg-[#fbf8f2]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-[15px] font-bold text-white shadow-sm">
              O
            </span>
            <span className="text-[15px] font-semibold tracking-tight">OpenCanvas</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="text-[13px] text-stone-500 transition hover:text-stone-900"
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/chat"
              className="hidden rounded-lg px-3 py-2 text-[13px] text-stone-500 transition hover:text-stone-900 sm:inline-flex"
            >
              进入工作台
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-stone-700"
            >
              免费开始
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════ Hero：左标题 + 右倾斜产品窗口 ═══════ */}
      <section className="relative overflow-hidden">
        {/* 氛围光晕 */}
        <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-orange-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-40 top-40 h-[420px] w-[420px] rounded-full bg-rose-100/40 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-16 md:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          {/* 文案侧 */}
          <div
            className={cn(
              "transition-all duration-700",
              mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
            )}
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600">
              <Sparkles className="h-3.5 w-3.5" />
              一站式 AI 创作工作空间
            </p>
            <h1 className="mt-6 text-[44px] font-bold leading-[1.08] tracking-tight md:text-[64px]">
              灵感进来，
              <br />
              <span className="bg-gradient-to-r from-orange-500 via-rose-500 to-violet-500 bg-clip-text text-transparent">
                作品出去。
              </span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-7 text-stone-500 md:text-base">
              给 AI 一句话，文档、PPT、报告、图片、视频一次到位。
              <br className="hidden md:block" />
              不用学工具，不用排格式 —— 说的就是人话，回的是一份能用的成品。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/chat"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-stone-900 px-6 text-[14px] font-medium text-white shadow-lg shadow-stone-900/10 transition hover:bg-stone-700"
              >
                开始第一次创作
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <button
                onClick={() => scrollTo("#how")}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-stone-200 bg-white px-6 text-[14px] font-medium text-stone-700 transition hover:border-stone-300"
              >
                看看怎么用
                <ArrowDown className="h-4 w-4 text-stone-400" />
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-400">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> 内置免费演示模型
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> 无需信用卡
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> 数据自动保存
              </span>
            </div>
          </div>

          {/* 产品窗口侧（轻微倾斜） */}
          <div className="relative [perspective:1600px]">
            {/* 底部渐变“地板” */}
            <div className="absolute -inset-6 -z-10 rounded-[36px] bg-gradient-to-br from-orange-100/70 via-rose-50/60 to-transparent blur-2xl" />
            <div
              className={cn(
                "transition-all duration-700 [transform-style:preserve-3d]",
                mounted
                  ? "translate-y-0 rotate-[2deg] opacity-100"
                  : "translate-y-10 rotate-[4deg] opacity-0",
                "lg:hover:rotate-0 lg:transition-transform"
              )}
            >
              <ProductWindow />
            </div>

            {/* 悬浮玻璃标签 */}
            <div
              className={cn(
                "absolute -left-4 -top-5 flex items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-lg backdrop-blur transition-all delay-200",
                mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-500">
                <Presentation className="h-4 w-4" />
              </span>
              <span className="text-[11px] leading-tight text-stone-700">
                PPT · 12 页
                <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                  <Check className="h-3 w-3" /> 已生成
                </span>
              </span>
            </div>
            <div
              className={cn(
                "absolute -bottom-5 right-2 flex items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-lg backdrop-blur transition-all delay-300",
                mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Wand2 className="h-4 w-4" />
              </span>
              <span className="text-[11px] leading-tight text-stone-700">
                文档已自动保存
                <span className="block text-[10px] text-stone-400">3 分钟前还在改写中…</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 一条细分割线 */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px w-full bg-stone-200/70" />
      </div>

      {/* ═══════ 01/02/03 功能步骤 ═══════ */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <div className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Workflow</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">三步，从想法到成品</h2>
          <p className="mt-3 text-[14px] leading-6 text-stone-500">不折腾的创作流程 —— 你只负责说，剩下的交给它。</p>
        </div>

        <div className="mt-14 space-y-2">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className={cn(
                "grid items-center gap-6 rounded-3xl px-4 py-8 transition sm:px-8 md:grid-cols-[150px_1.2fr_1fr]",
                i % 2 === 1 && "md:[&>*:nth-child(2)]:order-3 md:[&>*:nth-child(3)]:order-2"
              )}
            >
              {/* 巨型编号 */}
              <div className="select-none text-[84px] font-bold leading-none tracking-tight text-stone-200/90 md:text-[110px]">
                {s.n}
              </div>
              {/* 文案 */}
              <div className="md:pr-6">
                <h3 className="text-2xl font-bold tracking-tight text-stone-900 md:text-[26px]">{s.title}</h3>
                <p className="mt-3 max-w-md text-[14px] leading-7 text-stone-500">{s.desc}</p>
              </div>
              {/* 迷你示意 */}
              <div className="flex items-center justify-center md:justify-end">{s.art}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ 能做什么 ═══════ */}
      <section id="capabilities" className="scroll-mt-20 border-y border-stone-100 bg-[#fdfaf5]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Capabilities</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">一个工作台，六种本事</h2>
            </div>
            <Link
              href="/chat"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-orange-600 transition hover:text-orange-700"
            >
              去试试
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
            {CAPS.map((c) => (
              <Link
                key={c.label}
                href="/chat"
                className="group rounded-2xl border border-stone-200/80 bg-white p-5 transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500 transition group-hover:bg-orange-500 group-hover:text-white">
                  <c.icon className="h-5 w-5" />
                </span>
                <div className="mt-3 text-[15px] font-semibold text-stone-800">{c.label}</div>
                <div className="mt-0.5 text-xs text-stone-400">{c.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ 收束 CTA ═══════ */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <p className="text-[15px] text-stone-400">与其攒一堆工具，不如要一个懂你的助手</p>
        <h2 className="mx-auto mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          现在，说出你的<span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">第一句灵感</span>
        </h2>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/chat"
            className="group inline-flex h-[52px] items-center gap-2 rounded-full bg-gradient-to-br from-orange-500 to-red-500 px-8 text-[15px] font-semibold text-white shadow-xl shadow-orange-200 transition hover:brightness-105"
          >
            开始第一次创作
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/mockup"
            className="inline-flex h-[52px] items-center rounded-full border border-stone-200 bg-white px-7 text-[15px] font-medium text-stone-700 transition hover:border-stone-300"
          >
            先看产品演示
          </Link>
        </div>
        <p className="mt-5 text-xs text-stone-400">30 秒上手 · 不配密钥也能完整体验 · 数据保存在本地</p>
      </section>

      {/* ═══════ 页脚 ═══════ */}
      <footer className="border-t border-stone-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-stone-400 sm:flex-row">
          <span className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-red-500 text-[9px] font-bold text-white">
              O
            </span>
            © 2026 OpenCanvas
          </span>
          <div className="flex items-center gap-5">
            <Link href="/chat" className="transition hover:text-stone-600">
              进入工作台
            </Link>
            <Link href="/settings" className="transition hover:text-stone-600">
              设置中心
            </Link>
            <Link href="/tools" className="transition hover:text-stone-600">
              工具箱
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
