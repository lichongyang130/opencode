"use client";

import { useEffect, useRef, useState } from "react";
import { useSseStream } from "@/hooks/useSseStream";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  FileText,
  ImageIcon,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Presentation,
  RotateCcw,
  Search,
  Square,
  Video,
  Wand2,
} from "lucide-react";
import { useChatStore, MODE_LABELS, type WorkspaceMode, type UIMessage } from "@/lib/store/chat";
import { Markdown } from "./Markdown";
import { PersonaPicker } from "./PersonaPicker";
import { ModelSelector, PROVIDER_NAME } from "./ModelSelector";
import { MODELS } from "@/lib/gateway/models";
import { estimateTokens } from "@/lib/gateway/credits";
import { IMAGE_MODELS } from "@/lib/gateway/image";
import { IMAGE_STYLES } from "@/lib/image/presets";
import { loadPromptHistory, type ImagePromptRecord } from "@/lib/image/history";
import { toast } from "@/lib/store/toast";
import { getOverrides } from "@/lib/settings";
import { readJSON, writeJSON, removeKey } from "@/lib/safe-storage";
import {
  SLASH_COMMANDS,
  matchSlash,
  TONE_CHIPS,
  LENGTH_CHIPS,
  AUDIENCE_CHIPS,
  type PromptChip,
} from "@/lib/slash";
import { cn } from "@/lib/utils";

const IMAGE_SIZES = [
  { id: "1024x1024", label: "方形 1:1" },
  { id: "1792x1024", label: "横版 16:9" },
  { id: "1024x1792", label: "竖版 9:16" },
];

const IMAGE_COUNTS = [
  { n: 1, label: "1 张" },
  { n: 2, label: "2 张" },
  { n: 4, label: "4 张" },
];

/** 首页功能卡片 */
const HOME_CARDS: {
  icon: typeof Mail;
  title: string;
  desc: string;
  mode: WorkspaceMode;
  prompt: string;
}[] = [
  { icon: Mail, title: "撰写邮件", desc: "起草清晰、有说服力的商务邮件", mode: "chat", prompt: "帮我写一封商务合作邮件" },
  { icon: FileText, title: "生成文档", desc: "商业计划书 / 制度 / 报告一键成稿", mode: "docs", prompt: "写一份 SaaS 产品商业计划书" },
  { icon: Presentation, title: "制作 PPT", desc: "输入主题，生成整套幻灯片", mode: "slides", prompt: "为产品发布会生成一套 10 页 PPT" },
  { icon: ImageIcon, title: "生成图片", desc: "描述画面，AI 立即出图", mode: "image", prompt: "一只戴宇航头盔的柯基在月球上，电影感海报" },
  { icon: Search, title: "深度研究", desc: "市场 / 竞品 / 行业调研报告", mode: "research", prompt: "研究 2025 年 AI 搜索赛道的竞争格局" },
  { icon: Video, title: "视频脚本", desc: "带货 / 分镜 / 口播脚本", mode: "video", prompt: "为新款降噪耳机写一条 15 秒带货短视频脚本" },
];

/** 技能选择（输入框内下拉）：六个创作能力 —— 与竖栏 PRIMARY_MODES 一致 */
const SKILLS: { mode: WorkspaceMode; icon: typeof MessageSquare }[] = [
  { mode: "chat", icon: MessageSquare },
  { mode: "docs", icon: FileText },
  { mode: "slides", icon: Presentation },
  { mode: "image", icon: ImageIcon },
  { mode: "research", icon: Search },
  { mode: "video", icon: Video },
];
const SKILL_META: Record<WorkspaceMode, { icon: typeof MessageSquare; desc: string }> = {
  chat: { icon: MessageSquare, desc: "自由对话，AI 自动判断格式" },
  docs: { icon: FileText, desc: "计划书 / 报告 / 制度" },
  slides: { icon: Presentation, desc: "主题 → 整套幻灯片" },
  image: { icon: ImageIcon, desc: "一句话生成 / 编辑图片" },
  research: { icon: Search, desc: "联网查证 · 带引用报告" },
  video: { icon: Video, desc: "分镜 / 口播 / 带货脚本" },
};

/* ═══════════════════════════════════════════
 *  消息气泡
 * ═══════════════════════════════════════════ */

function MessageBubble({
  m,
  isLastUser,
  onEdit,
  onRetry,
  agentLabel,
}: {
  m: UIMessage;
  isLastUser?: boolean;
  onEdit?: () => void;
  /** G74: 出错回复的「重新生成」：撤回该轮并原样重发 */
  onRetry?: () => void;
  /** 助手身份行右侧的小标签（当前模型名），仿 Codex 每条消息的模型头 */
  agentLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(m.content).then(
      () => {
        setCopied(true);
        toast("已复制", "success");
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast("复制失败", "error")
    );
  };
  const isUser = m.role === "user";

  return (
    <div className={cn("group/msg w-full", isUser ? "flex justify-end" : "flex justify-start")}>
      {isUser ? (
        /* ChatGPT 风格：用户消息 = 右侧浅灰圆角块 */
        <div className="max-w-[85%]">
          <div
            className={cn(
              "whitespace-pre-wrap rounded-3xl bg-stone-200/70 px-4 py-2 text-[15px] leading-7 text-stone-800",
              m.error && "border border-red-200 bg-red-50 text-red-700"
            )}
          >
            {m.content}
          </div>
          {!m.streaming && m.content && (
            <div className="mt-1 flex justify-end gap-0.5 opacity-60 transition hover:opacity-100 group-hover/msg:opacity-100">
              {isLastUser && onEdit && (
                <button
                  onClick={onEdit}
                  title="编辑并重新发送"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                >
                  <Pencil className="h-3 w-3" />
                  编辑
                </button>
              )}
              <button
                onClick={copy}
                title="复制"
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ChatGPT / Codex 风格：助手消息 = 黑色小方块头像 + 无边框纯文字 */
        <div className="flex w-full max-w-full gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-violet-600 text-[12px] font-bold text-white shadow-sm dark:bg-violet-500"
          >
            O
          </span>
          <div className="min-w-0 flex-1">
            {/* Codex 风格：助手消息开头一行身份 —— 产品名 + 当前模型小标签 */}
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-stone-900">OpenCanvas</span>
              {agentLabel && (
                <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-normal text-stone-500">
                  {agentLabel}
                </span>
              )}
            </div>
            {m.streaming && !m.content ? (
              <span className="inline-flex animate-pulse items-center gap-1.5 text-sm text-stone-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在思考…
              </span>
            ) : (
              <div className={cn("text-[15px] leading-7", m.error && "rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-red-700")}>
                <div className="markdown-body">
                  <Markdown content={m.content} />
                  {m.streaming && <span className="streaming-cursor" />}
                </div>
              </div>
            )}
            {!m.streaming && m.content && (
              <div className="mt-1.5 flex items-center gap-0.5 opacity-60 transition hover:opacity-100 group-hover/msg:opacity-100">
                <button
                  onClick={copy}
                  title="复制"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "已复制" : "复制"}
                </button>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    title="重新生成（撤回本轮错误并重发）"
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-red-500 transition hover:bg-red-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    重试
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
 *  分体式输入舱组件 (E5)
    </div>
  );
}

/* ═══════════════════════════════════════════
 *  分体式输入舱组件 (E5)
 * ═══════════════════════════════════════════ */

function SplitComposer({
  input,
  setInput,
  inputRef,
  submit,
  sending,
  stopGeneration,
  model,
  setModel,
  mode,
  imgSize,
  setImgSize,
  imgModel,
  setImgModel,
  imgStyle,
  setImgStyle,
  imgCount,
  setImgCount,
  imgNegative,
  setImgNegative,
  imgReference,
  setImgReference,
  showHistory,
  setShowHistory,
  history,
  openHistory,
  pickReference,
  applyHistory,
  fileRef,
  enhancing,
  enhancePrompt,
  slashMatches,
  slashIdx,
  setSlashIdx,
  runSlash,
  applyChip,
  chipOn,
  onRecallUp,
  canRecall,
  conversing,
}: {
  input: string;
  setInput: (v: string | ((prev: string) => string)) => void;
  inputRef: React.Ref<HTMLTextAreaElement>;
  submit: () => void;
  sending: boolean;
  stopGeneration: () => void;
  model: string;
  setModel: (id: string, provider?: string) => void;
  mode: WorkspaceMode;
  imgSize: string;
  setImgSize: (v: string) => void;
  imgModel: string;
  setImgModel: (v: string) => void;
  imgStyle: string;
  setImgStyle: (v: string | ((prev: string) => string)) => void;
  imgCount: number;
  setImgCount: (v: number) => void;
  imgNegative: string;
  setImgNegative: (v: string) => void;
  imgReference: string;
  setImgReference: (v: string) => void;
  showHistory: boolean;
  setShowHistory: (v: boolean | ((prev: boolean) => boolean)) => void;
  history: ImagePromptRecord[];
  openHistory: () => void;
  pickReference: (e: React.ChangeEvent<HTMLInputElement>) => void;
  applyHistory: (h: ImagePromptRecord) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  enhancing: boolean;
  enhancePrompt: () => void;
  slashMatches: ReturnType<typeof matchSlash>;
  slashIdx: number;
  setSlashIdx: (v: number | ((prev: number) => number)) => void;
  runSlash: (cmd: (typeof SLASH_COMMANDS)[number]) => void;
  applyChip: (chip: PromptChip) => void;
  chipOn: (chip: PromptChip) => boolean;
  /** UX10: ↑ 召回上一条已发送内容（无可召回时返回 false，事件放行给光标移动） */
  onRecallUp: () => boolean;
  /** UX10: 当前是否处于召回态（可继续前翻） */
  canRecall: boolean;
  /**
   * C24: 是否处于「已有消息」的对话态。对话态下左侧 38% 能力网格默认折叠成
   * 窄图标栏，把输入空间还给打字；空态（没消息）才展示完整能力区。
   */
  conversing?: boolean;
}) {
  // 简化单框：技能选择收敛为输入框内的一个下拉（点击其它处 / Esc 关闭）
  const [skillOpen, setSkillOpen] = useState(false);
  const skillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!skillOpen) return;
    const onDown = (e: MouseEvent) => {
      if (skillRef.current && !skillRef.current.contains(e.target as Node)) setSkillOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSkillOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [skillOpen]);
  const chooseSkill = (m: WorkspaceMode) => {
    setSkillOpen(false);
    if (m === mode) return;
    useChatStore.getState().setMode(m);
    toast(`已切换到「${MODE_LABELS[m]}」`, "success");
  };

  return (
    <div className="rounded-[26px] border border-stone-200/90 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02),0_12px_32px_-18px_rgba(0,0,0,0.18)] transition-shadow duration-200 focus-within:shadow-[0_2px_4px_rgba(0,0,0,0.02),0_16px_40px_-16px_rgba(0,0,0,0.26)]">
      <div className="relative flex min-w-0 flex-col">
        {/* 图片模式参数（IMG1~6）：模型直选 / 尺寸 / 张数 / 风格 / 负向 / 参考图 / 历史 */}
          {mode === "image" && (
            <div className="space-y-1.5 border-b border-stone-100 px-3 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-stone-400">模型</span>
                {IMAGE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setImgModel(m.id)}
                    title={m.region === "builtin" ? "免费演示模型" : `${m.providerLabel} · ${m.creditsPerImage} 积分/张`}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      imgModel === m.id
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                        : "border-stone-200 text-stone-500 hover:border-brand-300"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
                <button
                  onClick={openHistory}
                  title="提示词历史"
                  className="ml-auto rounded-full border border-stone-200 px-2 py-0.5 text-[10px] text-stone-500 transition hover:border-brand-300 hover:text-brand-600"
                >
                  历史
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-stone-400">尺寸</span>
                {IMAGE_SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setImgSize(s.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      imgSize === s.id
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                        : "border-stone-200 text-stone-500 hover:border-brand-300"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="ml-1 text-[10px] text-stone-400">张数</span>
                {IMAGE_COUNTS.map((c) => (
                  <button
                    key={c.n}
                    onClick={() => setImgCount(c.n)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      imgCount === c.n
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                        : "border-stone-200 text-stone-500 hover:border-brand-300"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-stone-400">风格</span>
                {IMAGE_STYLES.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setImgStyle((v) => (v === st.id ? "" : st.id))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      imgStyle === st.id
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                        : "border-stone-200 text-stone-500 hover:border-brand-300"
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-[10px] text-stone-400">负向</span>
                <input
                  value={imgNegative}
                  onChange={(e) => setImgNegative(e.target.value)}
                  placeholder="不想出现的元素，逗号分隔（仅万相生效）"
                  className="min-w-0 flex-1 rounded border border-stone-200 bg-transparent px-2 py-0.5 text-[11px] outline-none placeholder:text-stone-300 focus:border-brand-300"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  title="上传参考图（图生图，仅万相生效）"
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] transition",
                    imgReference
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-stone-200 text-stone-500 hover:border-brand-300"
                  )}
                >
                  {imgReference ? "参考图 ✓" : "参考图"}
                </button>
                {imgReference && (
                  <button
                    onClick={() => setImgReference("")}
                    title="移除参考图"
                    className="shrink-0 rounded-full px-1 text-[10px] text-stone-400 hover:text-stone-600"
                  >
                    ✕
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={pickReference} className="hidden" />
              </div>
              {/* IMG6: 提示词历史面板 */}
              {showHistory && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-stone-100 bg-stone-50 p-1.5">
                  {history.length === 0 && (
                    <div className="px-2 py-3 text-center text-[11px] text-stone-400">还没有历史记录</div>
                  )}
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => applyHistory(h)}
                      title={`${h.model} · ${h.size}${h.style ? ` · ${h.style}` : ""}`}
                      className="block w-full truncate rounded px-2 py-1 text-left text-[11px] text-stone-600 transition hover:bg-brand-50 hover:text-brand-700"
                    >
                      {h.prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 斜杠命令菜单 */}
          {slashMatches && (
            <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
              <div className="px-2 py-1 text-[11px] text-stone-400">快捷命令（↑↓ 选择，Enter 执行）</div>
              {slashMatches.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-stone-400">没有匹配的命令</div>
              )}
              {slashMatches.map((c, i) => (
                <button
                  key={c.cmd}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    runSlash(c);
                  }}
                  onMouseEnter={() => setSlashIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left",
                    i === slashIdx ? "bg-brand-50" : "hover:bg-stone-50"
                  )}
                >
                  <span className="flex h-6 w-12 shrink-0 items-center justify-center rounded bg-stone-100 font-mono text-[11px] text-stone-500">
                    /{c.cmd}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-stone-700">{c.label}</span>
                    <span className="block truncate text-[11px] text-stone-400">{c.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 文字类模式参数：语气 / 长度 / 受众（点击即追加约束，再点取消）——
          仅文档/PPT/研究/视频显示，chat 保持单框极简 */}
          {mode !== "image" && mode !== "chat" && !slashMatches && (
            <div className="flex flex-wrap items-center gap-1 border-b border-stone-100 px-3 py-1.5">
              <span className="text-[11px] text-stone-500" title="把语气要求拼到输入末尾，再点一次取消">语气</span>
              {TONE_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.suffix}
                  onClick={() => applyChip(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition",
                    chipOn(c)
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-stone-200 text-stone-500 hover:border-brand-300"
                  )}
                >
                  {c.label}
                </button>
              ))}
              <span className="ml-1 text-[11px] text-stone-500" title="控制篇幅，点击拼到输入末尾，再点一次取消">长度</span>
              {LENGTH_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.suffix}
                  onClick={() => applyChip(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition",
                    chipOn(c)
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-stone-200 text-stone-500 hover:border-brand-300"
                  )}
                >
                  {c.label}
                </button>
              ))}
              <span className="ml-1 text-[11px] text-stone-500" title="指定读者对象，点击拼到输入末尾，再点一次取消">受众</span>
              {AUDIENCE_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.suffix}
                  onClick={() => applyChip(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition",
                    chipOn(c)
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-stone-200 text-stone-500 hover:border-brand-300"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* 输入框 */}
          <div className="relative flex flex-1 flex-col">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (slashMatches && slashMatches.length > 0) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => (i + 1) % slashMatches.length); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => (i - 1 + slashMatches.length) % slashMatches.length); return; }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runSlash(slashMatches[Math.min(slashIdx, slashMatches.length - 1)]); return; }
                  if (e.key === "Escape") { e.preventDefault(); setInput(""); return; }
                }
                // UX10: 斜杠菜单未激活时，↑ 在空输入或召回态下逐级召回已发送内容；
                // 召回态（刚召回过、未编辑）下继续前翻，用户手改输入则退出召回态
                if (e.key === "ArrowUp" && onRecallUp && (!input || canRecall)) {
                  const recalled = onRecallUp();
                  if (recalled) e.preventDefault();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              rows={2}
              placeholder={
                mode === "image"
                  ? "描述你想要的画面…"
                  : mode === "chat"
                    ? "想做什么？写下来告诉我…"
                    : `${MODE_LABELS[mode]}：描述你的需求…`
              }
              className="min-h-[92px] w-full resize-none bg-transparent px-4 py-3.5 text-[14px] leading-relaxed outline-none placeholder:text-stone-400"
            />
          </div>

          {/* ──── 底部工具栏：技能选择 ▾ ｜ 润色提示词 · 模型下拉 · 发送，全部收在输入框下方 ──── */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-stone-100 px-2.5 py-2.5">
          {/* 技能选择下拉 */}
          <div ref={skillRef} className="relative">
            <button
              onClick={() => setSkillOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={skillOpen}
              title="技能选择：对话 / 文档 / PPT / 图片 / 研究 / 视频"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-[13px] font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900"
            >
              {(() => {
                const Icon = SKILL_META[mode].icon;
                return <Icon className="h-3.5 w-3.5" />;
              })()}
              {MODE_LABELS[mode]}
              <ChevronDown className={cn("h-3 w-3 text-stone-400 transition-transform", skillOpen && "rotate-180")} />
            </button>
            {skillOpen && (
              <div role="listbox" className="absolute bottom-full left-0 z-40 mb-2 w-48 overflow-hidden rounded-xl border border-[#e5d9c6] bg-white p-1 shadow-xl">
                {SKILLS.map((skill) => {
                  const Icon = SKILL_META[skill.mode].icon;
                  const cur = skill.mode === mode;
                  return (
                    <button
                      key={skill.mode}
                      role="option"
                      aria-selected={cur}
                      onClick={() => chooseSkill(skill.mode)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-brand-50",
                        cur && "bg-brand-50"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", cur ? "text-brand-600" : "text-stone-400")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-xs", cur ? "font-medium text-brand-700" : "text-stone-700")}>
                          {MODE_LABELS[skill.mode]}
                        </span>
                        <span className="block truncate text-[10px] text-stone-400">{SKILL_META[skill.mode].desc}</span>
                      </span>
                      {cur && <Check className="h-3.5 w-3.5 text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="min-w-0 flex-1" />

          {/* 润色提示词 */}
          <button
            onClick={() => void enhancePrompt()}
            disabled={!input.trim() || enhancing}
            title={input.trim() ? "优化提示词" : "输入内容后可优化提示词"}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-[13px] text-stone-500 transition hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-600 disabled:opacity-30"
          >
            {enhancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{enhancing ? "润色中…" : "润色提示词"}</span>
          </button>

          {/* UX12: 实时 token/字数估算（estimateTokens 与计费同口径） */}
          {input.trim() && (
            <span className="truncate text-[10px] text-stone-400" title="估算值，实际以模型分词为准">
              {input.length} 字 · 约 {estimateTokens(input)} tokens
            </span>
          )}

          {/* 模型选择下拉 */}
          <ModelSelector
            value={model}
            onChange={(id, provider) => {
              setModel(id, provider);
              const label = MODELS.find((m) => m.id === id)?.label ?? id;
              // UX8: 补上供应商，让「用的是谁家的模型」一眼可辨
              const pv = provider ? PROVIDER_NAME[provider] : undefined;
              toast(pv ? `已切换到 ${pv} · ${label}` : `已切换到 ${label}`, "success");
            }}
          />

          {sending ? (
            // C35: 停止改红色圆钮，与「发送」在语义上一眼区分
            <button
              onClick={stopGeneration}
              title="停止生成"
              aria-label="停止生成"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm shadow-red-200 transition hover:bg-red-700"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!input.trim()}
              title={input.trim() ? "发送（回车）" : "输入内容后可发送"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm shadow-violet-200 transition hover:bg-violet-700 disabled:bg-stone-100 disabled:text-stone-300 disabled:shadow-none dark:bg-violet-500 dark:hover:bg-violet-400 dark:shadow-none"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>

          {/* 对话态常驻一行快捷键提示（空态的整句提示保留在原处） */}
          {conversing && (
            <p className="px-3 pb-1.5 text-right text-[10px] text-stone-300">
              Shift+回车换行 · ↑ 召回上一条 · / 快捷命令
            </p>
          )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
 *  主 ChatPanel
 * ═══════════════════════════════════════════ */

export function ChatPanel() {
  const { conversations, activeId, send, sending, stopGeneration, model, setModel } = useChatStore();
  const pendingInput = useChatStore((s) => s.pendingInput);
  const convo = conversations.find((c) => c.id === activeId);
  const [input, setInput] = useState("");
  const [imgSize, setImgSize] = useState("1024x1024");
  // IMG1~6: 绘图参数（模型直选 / 风格 / 张数 / 负向词 / 参考图 / 历史）
  const [imgModel, setImgModel] = useState("demo-image");
  const [imgStyle, setImgStyle] = useState("");
  const [imgCount, setImgCount] = useState(1);
  const [imgNegative, setImgNegative] = useState("");
  const [imgReference, setImgReference] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ImagePromptRecord[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showJump, setShowJump] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const sse = useSseStream();
  const [slashIdx, setSlashIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // UX10: ↑ 召回栈。仅在输入为空时按 ArrowUp 逐级往前取已发送内容；
  // 打字过程随时可再按 ↑ 继续（栈指针不因编辑而清零，发送后重置）
  const sentStack = useRef<string[]>([]);
  const recallIdx = useRef(-1);
  // UX10: 召回态（继续按 ↑ 可再往前翻）；用户手动编辑即退出
  const [recallActive, setRecallActive] = useState(false);

  const slashMatches = matchSlash(input);
  useEffect(() => setSlashIdx(0), [input]);

  // UX11: 草稿按会话 id 存 localStorage —— 切会话自动保存/恢复，避开 pendingInput 的一次性意图
  const draftKey = activeId ? `opencanvas.draft.${activeId}` : null;
  useEffect(() => {
    if (!draftKey) return;
    const saved = readJSON<string>(draftKey, "");
    if (saved) {
      setInput(saved);
      inputRef.current?.focus();
      // D50: 恢复草稿时明说一句，避免用户以为内容是自己刚打上去的
      toast("已恢复这个会话上次未发送的草稿", "info");
    }
    // 仅在切换会话（activeId 变化）时恢复；输入过程不重放
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    // 空草稿移除键，避免 localStorage 堆积已发送内容
    if (input.trim()) writeJSON(draftKey, input);
    else removeKey(draftKey);
  }, [input, draftKey]);

  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput.text);
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInput?.nonce]);

  const applyChip = (chip: PromptChip) => {
    setInput((v) => {
      const has = v.includes(chip.suffix);
      if (has) return v.replace(new RegExp(`\\n?${chip.suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), "").trimEnd();
      if (v.startsWith("/")) return v;
      return v.trim() ? v.replace(/\s*$/, "") + "\n" + chip.suffix : chip.suffix;
    });
  };
  const chipOn = (c: PromptChip) => input.includes(c.suffix);

  const runSlash = (cmd: (typeof SLASH_COMMANDS)[number]) => {
    if (cmd.kind === "action" && cmd.mode) {
      useChatStore.getState().setMode(cmd.mode);
      setInput("");
      toast(`已切换到${MODE_LABELS[cmd.mode]}工作台`, "info");
      return;
    }
    const raw = input.replace(/^\/[a-z]*\s*/i, "").trim();
    const text = (cmd.insert ?? "").replace("{q}", raw);
    setInput(text);
    setTimeout(() => {
      const ta = inputRef.current;
      if (!ta) return;
      const pos = text.includes("「") ? text.indexOf("」") : text.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  useEffect(() => {
    if (messages.length === 0) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const messages = convo?.messages ?? [];
  const mode: WorkspaceMode = convo?.mode ?? "chat";
  // 助手身份行小标签：当前模型名（Codex 每条消息头部同款）
  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model;

  const scrollToBottom = (smooth = true) =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });

  // UX13: 用户是否主动上滚离开底部（距底 > 120px）。流式跟随据此让位；
  // scrollToBottom（新消息/回到底部按钮）会清掉该标志恢复跟随。
  const userPinnedTop = useRef(false);
  const markBottom = () => {
    userPinnedTop.current = false;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = () => el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    const onScroll = () => {
      setShowJump(!atBottom());
      userPinnedTop.current = !atBottom();
      // DB4: 接近顶部时补拉更早历史；先记当前 scrollHeight，
      // 拉回后按新增高度补偿 scrollTop，用户视线停留在原消息上
      if (el.scrollTop <= 60) {
        const prevHeight = el.scrollHeight;
        void useChatStore.getState().loadEarlierMessages(activeId ?? "").then((n) => {
          if (n > 0) {
            requestAnimationFrame(() => {
              el.scrollTop += el.scrollHeight - prevHeight;
            });
          }
        });
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => { markBottom(); scrollToBottom(); }, [messages.length]);

  // 发送中跟随最新消息滚动；UX13: 用户已上滚离底时暂停跟随，滚回底部自动恢复
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (sending && !userPinnedTop.current) scrollToBottom(); }, [sending, messages[messages.length - 1]?.content]);

  const submit = () => {
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    // UX10: 发送成功路径统一入栈并重置召回指针（image 走 generateImage 也算一次发送）
    if (sentStack.current[sentStack.current.length - 1] !== text) sentStack.current.push(text);
    if (sentStack.current.length > 20) sentStack.current.shift();
    recallIdx.current = -1;
    if (mode === "image") {
      void useChatStore.getState().generateImage(text, {
        size: imgSize,
        model: imgModel,
        n: imgCount,
        style: imgStyle || undefined,
        negative: imgNegative || undefined,
        reference: imgReference || undefined,
      });
      // 参考图只对当次生成生效，发出去后清掉避免延续到下一张
      setImgReference("");
      return;
    }
    void send(text);
  };

  // UX10: ↑ 逐级召回已发送内容；栈空返回 false 让按键走默认光标行为
  const recallUp = () => {
    const stack = sentStack.current;
    if (!stack.length) return false;
    recallIdx.current = Math.min(recallIdx.current + 1, stack.length - 1);
    setInput(stack[stack.length - 1 - recallIdx.current]);
    setRecallActive(true);
    return true;
  };

  /** G74: 出错回复上的「重试」：撤掉本轮（含错误气泡）再原样重发用户原问 */
  const retryLast = () => {
    const st = useChatStore.getState();
    const convo = st.conversations.find((c) => c.id === st.activeId);
    if (!convo || convo.messages.length === 0) return;
    const text = [...convo.messages].reverse().find((mm) => mm.role === "user")?.content;
    if (!text || !text.trim()) return;
    st.editLastUserMessage();
    // 等 editLastUserMessage 把尾部截掉后，把同一句话重发给模型
    setTimeout(() => {
      const s2 = useChatStore.getState();
      if (s2.activeId && text.trim()) void s2.send(text);
    }, 0);
  };

  /** 输入变更统一入口：手动编辑即退出 UX10 召回态（召回态下 ↑ 可继续前翻） */
  const changeInput = (v: string | ((prev: string) => string)) => {
    setRecallActive(false);
    setInput(v);
  };

  // IMG5: 参考图选择 → data URI（配合通义万相图生图；其它模型服务端会明确报错）
  const pickReference = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("请选择图片文件作为参考图", "error");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast("参考图需小于 12MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImgReference(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  // IMG6: 历史回填——点历史条目恢复当次完整参数
  const applyHistory = (h: ImagePromptRecord) => {
    setInput(h.prompt);
    setImgModel(h.model);
    setImgSize(h.size);
    setImgStyle(h.style ?? "");
    setImgNegative(h.negative ?? "");
    setImgCount(1);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const openHistory = () => {
    setHistory(loadPromptHistory());
    setShowHistory((v) => !v);
  };

  const enhancePrompt = async () => {
    const raw = input.trim();
    if (!raw || enhancing) return;
    setEnhancing(true);
    const ov = getOverrides();
    const hasModel = Object.values(ov).some((p) => p?.apiKey);
    // 模型失败（网络/上游错误）不直接终止：本地模板兜底保证用户总能拿到结构化提示词
    let acc = "";
    if (hasModel && mode !== "image") {
      // AI15：reader 循环已收敛进 useSseStream，这里只保留业务语义
      acc = await sse.start({
        url: "/api/chat",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: convo?.model ?? "demo",
          overrides: ov,
          messages: [
            { role: "system", content: "你是提示词专家。把用户粗糙的需求改写成结构清晰、效果更好的中文提示词，包含：角色设定、具体任务、背景/受众、输出格式与约束。只输出改写后的提示词本身，不要解释、不要前后缀。" },
            { role: "user", content: raw },
          ],
        }),
      }).catch(() => "");
    }
    try {
      if (acc.trim()) { setInput(acc.trim()); toast("提示词已优化", "success"); return; }
      const modeHint: Record<string, string> = {
        image: "请输出一段英文绘图提示词，包含：主体细节、艺术风格、构图景别、光线氛围、画质词，用逗号分隔。",
        slides: "请输出一份幻灯片结构：标题、封面副标题、每页标题与 3-4 个要点。",
        research: "请从背景、现状、关键数据、主要玩家、趋势与结论几个方面展开。",
        docs: "请输出结构完整的文档：标题、导语、分小节（含小标题与要点）、结论。",
        video: "请输出分镜脚本：每个镜头含时长、画面、旁白、字幕。",
        chat: "请分点、有条理地回答，必要时给出步骤和示例。",
      };
      const improved = `# 角色\n你是该领域的资深专家。\n\n# 任务\n${raw}\n\n# 要求\n- 面向：相关从业者 / 普通读者（按需）\n- 语言：中文，专业且易懂\n- 输出：${modeHint[mode] ?? modeHint.chat}\n- 约束：内容准确、结构清晰、可直接使用，避免空话`;
      setInput(improved);
      toast("已生成结构化提示词", "success");
    } catch { toast("优化失败，请重试", "error"); }
    finally { setEnhancing(false); }
  };

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-white text-stone-800">
      <div
        ref={scrollRef}
        className={cn("flex-1 overflow-y-auto px-6", messages.length === 0 ? "bg-white py-12" : "bg-white py-10")}
      >
        <div className="mx-auto w-full max-w-[760px]">
          {messages.length === 0 ? (
            <div className="pt-4 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
                欢迎回来，今天想做点什么？
              </h1>
              <p className="mt-2 text-sm text-stone-500">用 AI 把想法变成现实。</p>

              {/* E5 分体式输入舱 */}
              <div className="mx-auto mt-8 max-w-3xl">
                <SplitComposer
                  input={input}
                  setInput={changeInput as typeof setInput}
                  inputRef={inputRef}
                  submit={submit}
                  sending={sending}
                  stopGeneration={stopGeneration}
                  model={model}
                  setModel={setModel}
                  mode={mode}
                  imgSize={imgSize}
                  setImgSize={setImgSize}
                  imgModel={imgModel}
                  setImgModel={setImgModel}
                  imgStyle={imgStyle}
                  setImgStyle={setImgStyle}
                  imgCount={imgCount}
                  setImgCount={setImgCount}
                  imgNegative={imgNegative}
                  setImgNegative={setImgNegative}
                  imgReference={imgReference}
                  setImgReference={setImgReference}
                  showHistory={showHistory}
                  setShowHistory={setShowHistory}
                  history={history}
                  openHistory={openHistory}
                  pickReference={pickReference}
                  applyHistory={applyHistory}
                  fileRef={fileRef}
                  enhancing={enhancing}
                  enhancePrompt={enhancePrompt}
                  slashMatches={slashMatches}
                  slashIdx={slashIdx}
                  setSlashIdx={setSlashIdx}
                  runSlash={runSlash}
                  applyChip={applyChip}
                  chipOn={chipOn}
                  onRecallUp={recallUp}
                  canRecall={recallActive}
                  conversing={messages.length > 0}
                />
              </div>
              <p className="mt-2 text-xs text-stone-400">回车发送 · Shift+回车换行 · 点上方「技能」可切换 文档 / PPT / 图片</p>

              {/* ChatGPT/Codex 风格空态：4 张建议卡（浅色卡片 + 图标 + 一句说明） */}
              <div className="mx-auto mt-7 grid max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-2">
                {HOME_CARDS.slice(0, 4).map((q) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={q.title}
                      aria-label={q.title}
                      onClick={() => {
                        useChatStore.getState().setMode(q.mode);
                        setInput(q.prompt);
                        setTimeout(() => inputRef.current?.focus(), 0);
                      }}
                      className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-300 hover:bg-stone-50"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-stone-800">{q.title}</span>
                        <span className="mt-0.5 block text-xs text-stone-500">{q.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {mode === "chat" && (
                <div className="flex justify-center">
                  <PersonaPicker
                    onStarter={(t) => { setInput(t); setTimeout(() => inputRef.current?.focus(), 0); }}
                  />
                </div>
              )}
              {/* UX9: 最后一条用户消息带编辑重发入口（非最后条保持只读，避免歧义的历史改写） */}
              {messages.map((m, i) => {
                const nextUser = messages.findIndex((x, j) => j > i && x.role === "user");
                const isLastUser = m.role === "user" && nextUser === -1;
                const isLastMsg = i === messages.length - 1;
                return (
                  <MessageBubble
                    key={m.id}
                    m={m}
                    isLastUser={isLastUser}
                    onEdit={isLastUser ? () => useChatStore.getState().editLastUserMessage() : undefined}
                    onRetry={m.error && isLastMsg ? retryLast : undefined}
                    agentLabel={modelLabel}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* R5：空对话时右下角一行极小的环境说明，不占布局 */}
      {messages.length === 0 && (
        <p
          aria-hidden
          className="pointer-events-none absolute bottom-3 right-5 hidden select-none text-[11px] text-stone-300 lg:block"
        >
          数据保存在本地 · 30 秒上手 · 不配密钥也能完整体验
        </p>
      )}

      {/* 回到底部 */}
      {showJump && messages.length > 0 && (
        <button
          onClick={() => { markBottom(); scrollToBottom(); }}
          className="absolute bottom-[200px] left-1/2 -translate-x-1/2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 shadow-md transition hover:text-brand-600"
        >
          ↓ 回到底部
        </button>
      )}

      {/* 对话中底部的分体式输入舱 */}
      {messages.length > 0 && (
        <div className="px-6 pb-4 pt-1">
          <div className="mx-auto w-full max-w-3xl">
            <SplitComposer
              input={input}
              setInput={changeInput as typeof setInput}
              inputRef={inputRef}
              submit={submit}
              sending={sending}
              stopGeneration={stopGeneration}
              model={model}
              setModel={setModel}
              mode={mode}
              imgSize={imgSize}
              setImgSize={setImgSize}
              imgModel={imgModel}
              setImgModel={setImgModel}
              imgStyle={imgStyle}
              setImgStyle={setImgStyle}
              imgCount={imgCount}
              setImgCount={setImgCount}
              imgNegative={imgNegative}
              setImgNegative={setImgNegative}
              imgReference={imgReference}
              setImgReference={setImgReference}
              showHistory={showHistory}
              setShowHistory={setShowHistory}
              history={history}
              openHistory={openHistory}
              pickReference={pickReference}
              applyHistory={applyHistory}
              fileRef={fileRef}
              enhancing={enhancing}
              enhancePrompt={enhancePrompt}
              slashMatches={slashMatches}
              slashIdx={slashIdx}
              setSlashIdx={setSlashIdx}
              runSlash={runSlash}
              applyChip={applyChip}
              chipOn={chipOn}
              onRecallUp={recallUp}
              canRecall={recallActive}
              conversing={messages.length > 0}
            />
          </div>
        </div>
      )}
    </div>
  );
}
