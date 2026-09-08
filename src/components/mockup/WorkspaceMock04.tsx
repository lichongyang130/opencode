"use client";

import {
  AtSign,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileImage,
  FileText,
  Home,
  LayoutGrid,
  Lightbulb,
  MessageSquare,
  Package,
  Paperclip,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Star,
  Type,
  User as UserIcon,
  Wrench,
  X,
} from "lucide-react";

/* ────────────────────────────────────────────────
 *  1:1 还原 design/ai-chat-concepts/04
 *  「AI Workspace」三栏工作台（含浏览器窗口框）
 * ──────────────────────────────────────────────── */

const CHAT_HISTORY = [
  { title: "营销内容生成", icon: MessageSquare, active: true, tint: "bg-orange-100 text-orange-600", ring: "bg-orange-100 text-orange-600" },
  { title: "UI设计建议", icon: Pencil, active: false, tint: "bg-sky-100 text-sky-600", ring: "" },
  { title: "数据分析报告", icon: BarChart3, active: false, tint: "bg-emerald-100 text-emerald-600", ring: "" },
  { title: "品牌方案制定", icon: Lightbulb, active: false, tint: "bg-amber-100 text-amber-600", ring: "" },
];

const MESSAGES = [
  {
    role: "user",
    label: "14:31",
    caption: null,
    text: "我想生成一篇针对年轻消费者的智能手表营销文案，强调续航和时尚感。",
  },
  {
    role: "ai",
    label: "AI  14:32",
    caption: null,
    text: "收到！针对年轻群体，我们可以突出潮流设计、7天长续航和运动健康监测。您希望文案风格活泼一些吗？",
  },
  {
    role: "user",
    label: "14:33",
    caption: "User: 14:33",
    text: "是的，要活泼有趣，小红书风格。最好包含户外运动和社会场景的描述。",
  },
  {
    role: "ai",
    label: "AI  14:35",
    caption: null,
    text: "好的，明白！正在根据您的要求生成文案中。请稍候…",
  },
];

/* 最左侧图标导航树栏 */
function IconRail() {
  const items = [
    { icon: Home, label: "首页", active: true },
    { icon: MessageSquare, label: "AI 对话", active: false },
    { icon: FileText, label: "文档中心", active: false },
    { icon: Presentation, label: "PPT", active: false },
    { icon: LayoutGrid, label: "模板库", active: false },
    { icon: Package, label: "素材包", active: false },
  ];
  return (
    <aside className="flex w-[56px] shrink-0 flex-col items-center border-r border-[#eadfd0] bg-[#f5efe4] py-3">
      {/* 品牌 */}
      <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-sm font-bold text-white shadow-sm">
        AI
      </span>

      {/* 树栏功能图标 */}
      <div className="flex flex-col items-center gap-1">
        {items.map((it) => (
          <button
            key={it.label}
            title={it.label}
            className={
              it.active
                ? "flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600"
                : "flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            }
          >
            <it.icon className="h-[18px] w-[18px]" />
          </button>
        ))}
      </div>

      <div className="my-3 h-px w-7 bg-stone-200" />

      {/* 设置 */}
      <button
        title="设置"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
      >
        <Settings className="h-[18px] w-[18px]" />
      </button>
    </aside>
  );
}

function AvatarAI() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-500 text-[11px] font-bold text-white shadow-sm">
      AI
    </span>
  );
}

function AvatarUser() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
      <UserIcon className="h-4 w-4" />
    </span>
  );
}

function BrowserChrome() {
  return (
    <div className="shrink-0 bg-[#fbf8f3]">
      {/* Tabs */}
      <div className="flex items-center gap-3 px-4 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex h-8 flex-1 items-center gap-2 rounded-t-lg border border-b-0 border-[#eadfd0] bg-white px-3 text-[12px] text-stone-600">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-orange-400 to-red-500 text-[10px] font-bold text-white">
            AI
          </span>
          智能助手 · 营销内容生成
        </div>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-[#efe7da]">
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-[#efe7da]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* URL bar */}
      <div className="flex items-center gap-2 border-b border-[#eadfd0] bg-[#fbf8f3] px-4 py-2">
        <ChevronLeft className="h-4 w-4 text-stone-400" />
        <ChevronRight className="h-4 w-4 text-stone-300" />
        <RefreshCw className="h-4 w-4 text-stone-300" />
        <div className="mx-2 flex h-8 flex-1 items-center rounded-full bg-[#efe7da] px-4 text-[12px] text-stone-500">
          workspace.ai.com/marketing
        </div>
        <div className="flex items-center gap-1.5 text-stone-400">
          <Star className="h-4 w-4" />
          <RefreshCw className="h-4 w-4" />
          <LayoutGrid className="h-4 w-4" />
          <Wrench className="h-4 w-4" />
          <Share2 className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceMock04() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f2ecdf] text-stone-800">
      <BrowserChrome />

      {/* App content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-2">
        {/* App top bar */}
        <div className="flex shrink-0 items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-sm font-bold text-white shadow-sm">
              AI
            </span>
            <span className="text-[16px] font-bold tracking-tight text-stone-800">AI Workspace</span>
          </div>
          <button className="flex items-center gap-2 rounded-full px-2 py-1 text-[13px] text-stone-700 hover:bg-[#efe7da]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-sky-500 text-[11px] font-semibold text-white">
              李
            </span>
            李明
            <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
          </button>
        </div>

        {/* 最左侧图标树栏 + 主三栏 */}
        <div className="flex min-h-0 flex-1 overflow-hidden pl-2 pr-3 pb-3">
          <IconRail />
          <div className="grid min-h-0 flex-1 grid-cols-[228px_minmax(0,1fr)_480px] gap-3 pl-3">
          {/* ───── 左：对话历史 ───── */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#eadfd0] bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h2 className="text-[15px] font-semibold text-stone-800">对话历史</h2>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100">
                <Search className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
              {CHAT_HISTORY.map((item) => (
                <div
                  key={item.title}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
                    item.active
                      ? "border border-[#f2d8bd] bg-[#fdf1e3] shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
                      : "border border-transparent hover:bg-[#faf5ec]"
                  }`}
                >
                  {item.active && (
                    <span className="-ml-3 h-6 w-1 rounded-r-full bg-orange-500" />
                  )}
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.ring}`}>
                    <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                  </span>
                  <span className="text-[13.5px] font-medium text-stone-700">{item.title}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-[#eee4d4] p-3">
              <button className="flex w-full items-center justify-center rounded-xl border border-[#e3d8c6] bg-white py-2.5 text-[13px] font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600">
                升级方案
              </button>
            </div>
          </section>

          {/* ───── 中：对话流 ───── */}
          <section className="flex min-h-0 flex-col rounded-2xl border border-[#eadfd0] bg-[#f8f2e7] shadow-sm">
            {/* 头部 */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#eee4d4] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <AvatarAI />
                <div>
                  <p className="text-[15px] font-semibold text-stone-800">智能助手 · 营销内容生成</p>
                  <p className="flex items-center gap-1 text-[11px] text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 在线
                  </p>
                </div>
              </div>
              <button className="flex items-center gap-1.5 rounded-xl border border-orange-300 bg-white px-3.5 py-2 text-[13px] font-medium text-orange-600 transition hover:bg-orange-50">
                <Plus className="h-3.5 w-3.5" /> 新建对话
              </button>
            </div>

            {/* 消息 */}
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
              {MESSAGES.map((m, i) => {
                const isUser = m.role === "user";
                return (
                  <div key={i} className="flex flex-col">
                    <div className={`flex items-center gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                      {!isUser && <AvatarAI />}
                      <div className="max-w-[78%]">
                        <div
                          className={`rounded-2xl px-4 py-3 text-[14px] leading-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${
                            isUser ? "rounded-tr-md border border-stone-200 bg-white text-stone-700" : "rounded-tl-md bg-[#fbe9d7] text-stone-700"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                      {isUser && <AvatarUser />}
                    </div>
                    <div
                      className={`mt-1.5 text-[11px] text-stone-400 ${
                        isUser ? "text-right" : "ml-12"
                      }`}
                    >
                      {m.caption ?? m.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 输入舱 */}
            <div className="shrink-0 border-t border-[#eee4d4] p-4">
              <div className="rounded-2xl border border-[#e7dccb] bg-white p-3 shadow-sm">
                <textarea
                  rows={1}
                  readOnly
                  placeholder="输入您的问题或指令..."
                  className="w-full resize-none bg-transparent text-[14px] text-stone-700 outline-none placeholder:text-stone-400"
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-stone-400">
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-stone-100">
                      <Type className="h-4 w-4" />
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-stone-100">
                      <AtSign className="h-4 w-4" />
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-stone-100">
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-stone-600">
                      GPT-4 Vision
                      <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                    </button>
                    <button className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 px-3.5 py-1.5 text-[12.5px] font-medium text-white shadow-sm">
                      发送
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ───── 右：AI 创作画布 ───── */}
          <section className="flex min-h-0 flex-col rounded-2xl border border-[#eadfd0] bg-[#fcf8f0] shadow-sm">
            <div className="shrink-0 px-4 pb-2 pt-4">
              <h2 className="text-[15px] font-semibold text-stone-800">AI创作画布</h2>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-5">
              {/* 文档卡片 */}
              <div className="rounded-2xl border border-[#eadfd0] bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-[12px] text-stone-400">
                  <FileImage className="h-3.5 w-3.5" />
                  智能手表营销文案（v1）
                </p>
                <h3 className="mt-2 text-[16px] font-bold leading-snug text-stone-800">
                  夏日潮酷智能手表营销文案（小红书风）
                </h3>
                <p className="mt-2 text-[13px] font-medium text-stone-600">
                  #潮流必备 #智能手表 ⚡
                </p>
                <p className="mt-3 text-[13px] leading-6 text-stone-600">
                  这个夏天，让生活更有YOUNG！戴上它，不仅更酷更时尚，还能在户外运动和社交场景中展现你的独特品味。
                </p>
                <p className="mt-2 text-[13px] leading-6 text-stone-600">
                  告别电量焦虑！🔥（编辑中…）
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className="text-[12px] text-stone-400">3月15日 14:36</span>
                  <div className="flex items-center gap-1 text-stone-400">
                    <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-stone-100">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-stone-100">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 视觉草图卡片 */}
              <div className="rounded-2xl border border-[#eadfd0] bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-[14px] font-medium text-stone-700">
                  <FileImage className="h-4 w-4 text-stone-500" />
                  生成的视觉草图
                </p>
                <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/mock-visual.png" alt="智能手表视觉草图" className="h-40 w-full object-cover" />
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full w-[45%] rounded-full bg-gradient-to-r from-orange-400 to-red-500" />
                </div>
                <p className="mt-2 text-right text-[12px] text-stone-400">45%</p>
                <p className="text-[12px] text-stone-400">正在生成视觉参考…</p>
              </div>
            </div>
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}
