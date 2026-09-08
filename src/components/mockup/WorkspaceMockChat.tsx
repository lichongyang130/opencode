"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShellSidebar } from "./ShellSidebar";
import { Markdown } from "@/components/workspace/Markdown";
import { ModelSelector } from "@/components/workspace/ModelSelector";
import { ArtifactPanel } from "@/components/workspace/ArtifactPanel";
import { SettingsModal } from "@/components/workspace/SettingsModal";
import { shareAsCase } from "@/components/shell/TopBarMenus";
import { matchSlash, type SlashCommand } from "@/lib/slash";
import { PERSONAS, getPersona } from "@/lib/personas";
import { useChatStore, type UIMessage, type WorkspaceMode } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import {
  ArrowUp,
  Bot,
  BrainCircuit,
  ChevronDown,
  Copy,
  Database,
  FileText,
  Globe,
  Home,
  LayoutGrid,
  LayoutTemplate,
  GitBranch,
  Image as ImageIcon,
  ListTree,
  MessageSquare,
  Paperclip,
  PencilLine,
  Presentation,
  RefreshCw,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wrench,
  Settings,
  X,
} from "lucide-react";

/* ────────────────────────────────────────────────
 *  AI 对话工作台（保持设计稿 1:1 视觉，接真实数据流）
 *  - 左侧最近对话来自真实会话 store
 *  - 消息流来自 /api/chat（SSE 流式）
 * ──────────────────────────────────────────────── */

const SUGGESTION_POOL = [
  "帮我写一篇关于时间管理的文章",
  "分析一下这个文件的内容",
  "生成一个营销活动的创意方案",
  "解释这个概念：区块链技术",
  "帮我写一封得体的请假邮件",
  "把这段中文翻译成地道英文",
  "帮我梳理这次会议的核心结论",
  "写一个小红书风格的产品种草文案",
  "给我一份新人入职第一周计划",
  "用通俗的话讲清楚量子计算",
  "帮我起 10 个品牌名并说明含义",
  "把这份数据整理成可汇报的要点",
];

/** 回复结束后展示的自动追问建议 */
const FOLLOW_UP_CHIPS = [
  "能展开讲讲第二点吗？",
  "给我一个具体的例子",
  "帮我总结成 3 个要点",
];

/** 空态能力卡：点击切到对应工作台 */
const CAPABILITY_CARDS: {
  key: string;
  icon: typeof FileText;
  label: string;
  desc: string;
  mode: WorkspaceMode;
  tint: string;
}[] = [
  { key: "docs", icon: FileText, label: "写文档", desc: "报告、方案、PRD 一键成稿", mode: "docs", tint: "bg-sky-50 text-sky-600" },
  { key: "slides", icon: Presentation, label: "做 PPT", desc: "输入主题直接生成演示文稿", mode: "slides", tint: "bg-orange-50 text-orange-600" },
  { key: "research", icon: Globe, label: "深度研究", desc: "联网检索并输出带来源报告", mode: "research", tint: "bg-emerald-50 text-emerald-600" },
  { key: "image", icon: Sparkles, label: "AI 绘图", desc: "描述想法，生成精美配图", mode: "image", tint: "bg-violet-50 text-violet-600" },
];

function greetingOf(now = new Date()): string {
  const h = now.getHours();
  if (h < 6) return "夜深了，Alex";
  if (h < 12) return "上午好，Alex";
  if (h < 14) return "中午好，Alex";
  if (h < 18) return "下午好，Alex";
  return "晚上好，Alex";
}

function AILogo() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-blue-500 text-white">
      <Sparkles className="h-3 w-3" />
    </span>
  );
}

function UserBubble({
  msg,
  canEdit,
  onEdit,
  onBranch,
}: {
  msg: UIMessage;
  canEdit?: boolean;
  onEdit?: () => void;
  onBranch?: () => void;
}) {
  const time = new Date(Number(msg.id.split("-")[0]) || Date.now()).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[640px]">
        <p className="mb-1 text-right text-[11px] text-stone-400">{time}</p>
        <div className="rounded-xl rounded-tr-sm bg-[#fdeee3] px-4 py-3 text-[14px] leading-6 text-stone-800">
          {msg.content}
        </div>
        <div className="mt-1 flex justify-end gap-2">
          {canEdit && onEdit && (
            <button
              onClick={onEdit}
              title="编辑这条消息并重新发送"
              className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            >
              <PencilLine className="h-3 w-3" /> 编辑重发
            </button>
          )}
          {onBranch && (
            <button
              onClick={onBranch}
              title="从这条消息分叉出一个新会话"
              className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            >
              <GitBranch className="h-3 w-3" /> 分叉
            </button>
          )}
        </div>
      </div>
      <Image
        src="/avatar.png"
        alt="Alex Chen"
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    </div>
  );
}

/** 从一段内容里取一个像样的标题 */
function titleOf(content: string): string {
  const line = content
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  return (line ?? "AI 生成内容").slice(0, 40) || "AI 生成内容";
}

interface BubbleActions {
  isLast: boolean;
  onShare: () => void;
  canAct: boolean;
  onRegenerate: () => void;
  onContinue: () => void;
  onToDoc: () => void;
  onToSlides: () => void;
  onBranch: () => void;
  onExportImage: () => void;
}

function AIBubble({ msg, actions }: { msg: UIMessage; actions?: BubbleActions }) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const time = new Date(Number(msg.id.split("-")[0]) || Date.now()).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const copy = () => {
    navigator.clipboard?.writeText(msg.content).then(() => {
      setCopied(true);
      toast("已复制", "success");
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-start gap-3" id={`msg-${msg.id}`}>
      <AILogo />
      <div className="min-w-0 max-w-[840px] flex-1">
        <div className="rounded-xl rounded-tl-sm border border-[#e9e4d9] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="mb-2 text-xs text-stone-400">AI 助手 {time}</p>
          {msg.error ? (
            <p className="text-[13px] text-red-600">{msg.content}</p>
          ) : (
            <div className="markdown-body text-[14px] leading-7 text-stone-800">
              <Markdown content={msg.content} />
              {msg.streaming && <span className="streaming-cursor" />}
            </div>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 px-1 text-stone-300">
          <button
            onClick={copy}
            title="复制"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
          >
            {copied ? <ThumbsUp className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => {
              setVote(vote === "up" ? null : "up");
              if (vote !== "up") toast("感谢反馈，已记录你的赞", "success");
            }}
            title="有帮助"
            className={
              vote === "up"
                ? "flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-500 transition"
                : "flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
            }
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setVote(vote === "down" ? null : "down");
              if (vote !== "down") toast("已记录，会作为改进参考", "info");
            }}
            title="没帮助"
            className={
              vote === "down"
                ? "flex h-7 w-7 items-center justify-center rounded-lg bg-stone-200 text-stone-600 transition"
                : "flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
            }
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={actions?.onShare ?? (() => toast("分享暂不可用", "info"))}
            title="生成分享链接"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={actions?.onBranch}
            title="从这条消息分叉出新会话"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={actions?.onExportImage}
            title="把这条回复导出为长图"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </button>

          {actions && actions.canAct && (
            <>
              <span className="mx-0.5 h-4 w-px bg-stone-200" />
              {actions.isLast && (
                <>
                  <button
                    onClick={actions.onRegenerate}
                    title="重新生成这条回复"
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={actions.onContinue}
                    title="接着上文继续写"
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={actions.onToDoc}
                title="把这段内容转入 AI 画布 · 文档"
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={actions.onToSlides}
                title="把这段内容转成 PPT"
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100 hover:text-stone-500"
              >
                <Presentation className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceMockChat() {
  const router = useRouter();
  const {
    hydrated,
    hydrate,
    conversations,
    activeId,
    sending,
    send,
    stopGeneration,
    newConversation,
    selectConversation,
    model,
    setModel,
    settingsOpen,
    setSettingsOpen,
    artifactOpen,
    setArtifactOpen,
    setPersona,
    setMode,
    runResearch,
    regenerate,
    setDoc,
    generateSlides,
    runTemplate,
    fillTemplate,
    editLastUserMessage,
    branchFromMessage,
    runAgentSequence,
    pendingInput,
  } = useChatStore();
  const [input, setInput] = useState("");
  /** AI 创作画布显隐（默认收起，完全由顶栏的四个小方块控制） */
  const [canvasOpen, setCanvasOpen] = useState(false);
  /** 输入舱能力：深度思考 / 联网搜索 / 附件 / AI 角色 */
  const [deep, setDeep] = useState(false);
  const [web, setWeb] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
  const [personaOpen, setPersonaOpen] = useState(false);
  /** 圆桌讨论进行中（防止重复点击） */
  const [roundtableBusy, setRoundtableBusy] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const [sugOffset, setSugOffset] = useState(0);
  /** 长回复目录展开状态 */
  const [tocOpen, setTocOpen] = useState(false);
  /** 划词追问浮层 */
  const [selPopup, setSelPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const personaRef = useRef<HTMLDivElement>(null);
  const convo = conversations.find((c) => c.id === activeId);
  const messages = convo?.messages ?? [];
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const lastUserId = [...messages].reverse().find((m) => m.role === "user")?.id;
  const lastAssistant = messages.find((m) => m.id === lastAssistantId);
  /** 最后一条 AI 回复的标题目录（≥3 个标题才显示） */
  const toc = useMemo(() => {
    if (!lastAssistant || lastAssistant.streaming) return [];
    const out: Array<{ level: number; text: string }> = [];
    for (const line of lastAssistant.content.split("\n")) {
      const m = line.match(/^(#{1,4})\s+(.*)$/);
      if (m) out.push({ level: m[1].length, text: m[2].trim() });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只依赖内容与流式标记，避免整条消息对象变化导致重算
  }, [lastAssistant?.content, lastAssistant?.streaming]);

  const scrollToHeading = (msgId: string, index: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    el.querySelectorAll("[data-heading]")[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** 划词后弹出快捷追问 */
  const onTextSelected = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || sel.isCollapsed || text.length < 2 || !scrollRef.current?.contains(sel.anchorNode)) {
      setSelPopup(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelPopup({ x: rect.left + rect.width / 2, y: rect.top - 8, text: text.slice(0, 2000) });
  };

  const quickAsk = (kind: "explain" | "translate" | "polish" | "summarize") => {
    const text = selPopup?.text;
    setSelPopup(null);
    if (!text) return;
    const prompts: Record<string, string> = {
      explain: `请解释下面这段话的含义：\n\n「${text}」`,
      translate: `请把下面这段话翻译（中译英，英文则译回中文）：\n\n「${text}」`,
      polish: `请润色改写下面这段话，使其更通顺专业：\n\n「${text}」`,
      summarize: `请用一句话总结这段话的核心：\n\n「${text}」`,
    };
    void send(prompts[kind]);
  };

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const lastContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !sending) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lastContent, sending]);

  // 消费首页带来的意图（sessionStorage 传递，避免把长文本放进 URL）
  useEffect(() => {
    if (!hydrated) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("oc:homeIntent");
      if (raw) sessionStorage.removeItem("oc:homeIntent");
    } catch {}
    if (!raw) return;
    try {
      const intent = JSON.parse(raw) as {
        type: "send" | "fill" | "mode" | "new" | "convo";
        mode?: WorkspaceMode;
        text?: string;
        id?: string;
        deep?: boolean;
        web?: boolean;
        attachment?: { name: string; content: string };
        ts?: number;
      };
      // 超过 30 秒的意图视为过期
      if (intent.ts && Date.now() - intent.ts > 30_000) return;
      const store = useChatStore.getState();
      const mode = intent.mode ?? "chat";
      switch (intent.type) {
        case "send": {
          const text = intent.text?.trim();
          if (!text) break;
          if (intent.web) {
            void store.runResearch(text);
          } else if (intent.deep || intent.attachment) {
            // 带能力开关 / 附件：先切到对应模式的新会话，再按选项发送
            void store.newConversation(mode).then(async (id) => {
              await store.selectConversation(id);
              await store.send(text, {
                deep: intent.deep,
                attachment: intent.attachment,
              });
            });
          } else {
            void store.runTemplate({ mode, prompt: text });
          }
          break;
        }
        case "fill":
          void store.fillTemplate({ mode, prompt: intent.text ?? "" });
          break;
        case "mode":
          void store.newConversation(mode).then((id) => store.selectConversation(id));
          break;
        case "new":
          void store.newConversation("chat").then((id) => store.selectConversation(id));
          break;
        case "convo":
          if (intent.id) void store.selectConversation(intent.id);
          break;
      }
    } catch {}
  }, [hydrated]);

  // 首页/模板「填进输入框但不发送」：把待填内容放进输入框
  const pendingText = pendingInput?.text;
  useEffect(() => {
    if (!pendingText) return;
    setInput(pendingText);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pendingText.length, pendingText.length);
    });
  }, [pendingText, pendingInput?.nonce]);

  // 画布内部点「关闭」时（store 被置为 false）同步收起
  useEffect(() => {
    if (!artifactOpen) setCanvasOpen(false);
  }, [artifactOpen]);

  const toggleCanvas = () => {
    const next = !canvasOpen;
    setCanvasOpen(next);
    setArtifactOpen(next);
  };

  /** 斜杠命令：输入 "/" 开头时浮出（/lib/slash 已内置 20+ 命令） */
  const slashList = matchSlash(input);
  const slashOpen = Boolean(slashList && slashList.length > 0);

  useEffect(() => {
    setSlashIdx(0);
  }, [input]);

  // 点击别处 / Esc 关闭角色浮层
  useEffect(() => {
    if (!personaOpen) return;
    const onDown = (e: MouseEvent) => {
      if (personaRef.current && !personaRef.current.contains(e.target as Node)) setPersonaOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPersonaOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [personaOpen]);

  const applySlash = (cmd: SlashCommand) => {
    if (cmd.kind === "action" && cmd.mode) {
      const empty = messages.length === 0;
      if (empty) {
        setMode(cmd.mode);
      } else {
        void newConversation(cmd.mode).then((id) => selectConversation(id));
      }
      setInput("");
      toast(`已切换到「${cmd.label}」工作台`, "success");
      return;
    }
    const raw = cmd.insert ?? "";
    const cursor = raw.indexOf("{q}");
    const text = raw.replace(/\{q\}/g, "");
    setInput(text);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      const pos = cursor >= 0 ? cursor : text.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const pickFile = (f: File) => {
    const isText =
      /\.(txt|md|mdx|csv|json|log|yaml|yml|ini|tsv|xml)$/i.test(f.name) ||
      f.type.startsWith("text/");
    if (!isText) {
      toast("目前支持文本文件：txt / md / csv / json / log 等", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setAttachment({ name: f.name, content: content.slice(0, 12000) });
      toast(`已读取附件《${f.name}》，发送时会一并发给模型`, "success");
    };
    reader.readAsText(f);
  };

  const startNew = () => {
    void newConversation("chat").then((id) => selectConversation(id));
  };

  /** 圆桌讨论：3 位角色围绕输入框里的话题依次发言 */
  const startRoundtable = async () => {
    if (roundtableBusy || sending) return;
    const topic = input.trim() || "请围绕「AI 会不会取代设计师」这个话题，从你的专业视角各给出 3 条观点";
    setPersonaOpen(false);
    setRoundtableBusy(true);
    setInput("");
    try {
      await runAgentSequence(["pm", "copywriter", "data-analyst"], topic);
      toast("圆桌讨论结束：3 位角色已依次发言", "success");
    } finally {
      setRoundtableBusy(false);
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) {
      toast("请先输入你的问题或需求", "info");
      return;
    }
    setInput("");
    setSlashIdx(0);
    const opts = { deep, attachment: attachment ?? undefined };
    setAttachment(null);
    // 联网搜索开：走深度研究流程（配了 Tavily 就真联网，没配会用示例来源并明确提示）
    if (web) {
      void runResearch(text);
      return;
    }
    void send(text, opts);
  };

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbf8f4]">
        <Sparkles className="h-6 w-6 animate-pulse text-[#c05f3c]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4] text-stone-800">
      <ShellSidebar active="chat" />

      {/* 主区域 */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#f0eadf] bg-[#fbf8f4] px-6 py-4">
          <div>
            <h1 className="text-[18px] font-semibold text-stone-900">AI 对话</h1>
            <p className="mt-0.5 text-[12.5px] text-stone-400">
              {convo ? `与 AI 助手的智能对话 · ${convo.title}` : "与 AI 助手的智能对话"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/settings")}
              title="设置中心"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white hover:text-stone-700"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={toggleCanvas}
              title={canvasOpen ? "隐藏 AI 画布" : "显示 AI 画布"}
              aria-pressed={canvasOpen}
              className={
                canvasOpen
                  ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[#fdeee1] text-[#c05f3c] transition hover:bg-[#fbe3d2]"
                  : "flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white hover:text-stone-700"
              }
            >
              <LayoutGrid className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={startNew}
              className="ml-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-[#c05f3c] transition hover:bg-[#fdeee1]"
            >
              新建对话
            </button>
          </div>
        </header>

        {/* 对话区 + AI 创作画布 */}
        <div className="relative flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* 对话流 */}
            <div ref={scrollRef} onMouseUp={onTextSelected} className="flex-1 overflow-y-auto px-10 py-6">
              <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-7">
                {toc.length >= 3 && lastAssistantId && (
                  <div className="sticky top-0 z-10 mx-auto w-fit max-w-[560px]">
                    <div className="rounded-xl border border-[#e9e4d9] bg-white/95 shadow-sm backdrop-blur">
                      <button
                        onClick={() => setTocOpen((v) => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-stone-500 transition hover:text-stone-800"
                      >
                        <ListTree className="h-3.5 w-3.5 text-orange-400" />
                        目录（{toc.length} 节）
                      </button>
                      {tocOpen && (
                        <div className="max-h-56 overflow-y-auto border-t border-stone-100 p-1.5">
                          {toc.map((h, i) => (
                            <button
                              key={i}
                              onClick={() => scrollToHeading(lastAssistantId!, i)}
                              className="block w-full truncate rounded-lg px-2 py-1 text-left text-[12.5px] text-stone-600 transition hover:bg-[#fdeee1] hover:text-[#c05f3c]"
                              style={{ paddingLeft: 8 + (h.level - 1) * 14 }}
                            >
                              {h.text}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {messages.length === 0 ? (
                  /* 空态：居中欢迎区 + 能力入口 */
                  <div className="flex flex-col items-center px-6 pt-14 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg shadow-orange-200">
                      <Sparkles className="h-7 w-7" />
                    </span>
                    <h2 className="mt-5 text-[26px] font-semibold leading-tight text-stone-900">
                      {greetingOf()} <span aria-hidden>👋</span>
                    </h2>
                    <p className="mt-2 text-[14px] text-stone-400">
                      今天想创造点什么？选一个能力开始，或直接在下方输入你的需求
                    </p>
                    <div className="mt-7 grid w-full max-w-[680px] grid-cols-4 gap-3">
                      {CAPABILITY_CARDS.map((c) => (
                        <button
                          key={c.key}
                          onClick={() => {
                            void newConversation(c.mode).then((id) => selectConversation(id));
                            toast(`已切换到「${c.label}」工作台，输入需求即可开始`, "info");
                          }}
                          className="group rounded-2xl border border-[#ece6db] bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:border-[#e0b79c] hover:shadow-md"
                        >
                          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.tint}`}>
                            <c.icon className="h-[18px] w-[18px]" />
                          </span>
                          <p className="mt-2.5 text-[13.5px] font-semibold text-stone-800">{c.label}</p>
                          <p className="mt-1 text-[11px] leading-4 text-stone-400">{c.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m) =>
                    m.role === "user" ? (
                      <UserBubble
                        key={m.id}
                        msg={m}
                        canEdit={m.id === lastUserId && !sending && !m.streaming}
                        onEdit={() => {
                          editLastUserMessage();
                          toast("原话已填回输入框，改完直接发送", "info");
                        }}
                        onBranch={() => {
                          void branchFromMessage(m.id).then((id) => {
                            if (id) toast("已分叉为新会话，历史记录完整保留", "success");
                          });
                        }}
                      />
                    ) : (
                      <AIBubble
                        key={m.id}
                        msg={m}
                        actions={{
                          isLast: m.id === lastAssistantId,
                          canAct: !sending && !m.streaming,
                          onShare: () => void shareAsCase(m.content, "message"),
                          onBranch: () => {
                            void branchFromMessage(m.id).then((id) => {
                              if (id) toast("已分叉为新会话，历史记录完整保留", "success");
                            });
                          },
                          onExportImage: () => {
                            void (async () => {
                              const el = document.getElementById(`msg-${m.id}`);
                              if (!el) return;
                              try {
                                toast("正在生成长图…", "info");
                                const { toPng } = await import("html-to-image");
                                const dataUrl = await toPng(el, { backgroundColor: "#ffffff", pixelRatio: 2 });
                                const a = document.createElement("a");
                                a.href = dataUrl;
                                a.download = `回复-${Date.now()}.png`;
                                a.click();
                                toast("长图已导出", "success");
                              } catch {
                                toast("导出失败，请重试", "error");
                              }
                            })();
                          },
                          onRegenerate: () => void regenerate(),
                          onContinue: () =>
                            void send(
                              "请接着上面的内容继续写，保持同样的风格与结构，不要重复已经写过的内容。",
                            ),
                          onToDoc: () => {
                            setDoc({
                              title: titleOf(m.content),
                              content: m.content,
                              updatedAt: Date.now(),
                            });
                            setCanvasOpen(true);
                            setArtifactOpen(true);
                            toast("已转入 AI 画布 · 文档", "success");
                          },
                          onToSlides: () => {
                            void generateSlides(titleOf(m.content).slice(0, 24), m.content);
                            setCanvasOpen(true);
                            setArtifactOpen(true);
                            toast("正在把这段内容转成 PPT…", "info");
                          },
                        }}
                      />
                    ),
                  )
                )}
                {sending && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex items-start gap-3">
                    <AILogo />
                    <div className="rounded-xl rounded-tl-sm border border-[#e9e4d9] bg-white px-4 py-3 text-[14px] text-stone-400 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      正在思考…
                    </div>
                  </div>
                )}
                {/* 自动追问建议：最后一条 AI 回复完成后展示 */}
                {!sending && lastAssistantId && messages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pl-9">
                    <span className="text-[11px] text-stone-400">继续问：</span>
                    {FOLLOW_UP_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => void send(chip)}
                        className="rounded-full border border-[#ece6db] bg-white px-3 py-1.5 text-[12px] text-stone-500 shadow-sm transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 快捷建议 + 输入舱 */}
            <div className="shrink-0 px-10 pb-6">
              <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-4">
                {/* 快捷建议 */}
                <div className="flex flex-wrap items-center gap-2">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const label = SUGGESTION_POOL[(sugOffset + i) % SUGGESTION_POOL.length];
                    return (
                      <button
                        key={label}
                        onClick={() => setInput(label)}
                        className="rounded-full border border-[#ece6db] bg-white px-3.5 py-1.5 text-[12.5px] text-stone-500 shadow-sm transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setSugOffset((o) => (o + 4) % SUGGESTION_POOL.length)}
                    className="ml-1 flex items-center gap-1 rounded-full px-2 py-1.5 text-[12px] text-stone-400 transition hover:text-[#c05f3c]"
                  >
                    换一批 <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 输入舱 */}
                <div className="relative rounded-2xl border border-[#ece6db] bg-white p-4 shadow-[0_2px_14px_rgba(0,0,0,0.04)]">
                  {/* 斜杠命令面板 */}
                  {slashOpen && slashList && (
                    <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-full max-w-[520px] overflow-y-auto rounded-2xl border border-[#ece6db] bg-white p-1.5 shadow-xl">
                      <div className="px-2.5 py-1.5 text-[11px] text-stone-400">
                        命令 · ↑↓ 选择，Enter 执行，Esc 取消
                      </div>
                      {slashList.map((c, i) => (
                        <button
                          key={c.cmd}
                          onMouseEnter={() => setSlashIdx(i)}
                          onClick={() => applySlash(c)}
                          className={
                            i === Math.min(slashIdx, slashList.length - 1)
                              ? "flex w-full items-center gap-2.5 rounded-xl bg-[#fdeee1] px-2.5 py-2 text-left"
                              : "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-stone-50"
                          }
                        >
                          <span className="w-20 shrink-0 font-mono text-[12px] text-[#c05f3c]">
                            /{c.cmd}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium text-stone-700">
                              {c.label}
                            </span>
                            <span className="block truncate text-[11.5px] text-stone-400">
                              {c.desc}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 附件条 */}
                  {attachment && (
                    <div className="mb-2 flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-[12.5px] text-stone-600">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                      <span className="shrink-0 text-[11px] text-stone-400">
                        {attachment.content.length} 字
                      </span>
                      <button
                        onClick={() => setAttachment(null)}
                        title="移除附件"
                        className="shrink-0 text-stone-400 transition hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <textarea
                    ref={taRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (slashOpen && slashList) {
                        const list = slashList;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setSlashIdx((i) => (i + 1) % list.length);
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setSlashIdx((i) => (i - 1 + list.length) % list.length);
                          return;
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          applySlash(list[Math.min(slashIdx, list.length - 1)]);
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setInput("");
                          return;
                        }
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={2}
                    placeholder="输入你的问题或需求，或按 / 唤起命令（撰写 / 翻译 / 润色 / 大纲…）"
                    className="w-full resize-none bg-transparent text-[14px] leading-7 text-stone-800 outline-none placeholder:text-stone-400"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 附件 */}
                      <button
                        onClick={() => fileRef.current?.click()}
                        title="上传文本附件"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ece6db] text-stone-500 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".txt,.md,.csv,.json,.log,.yaml,.yml,.xml,text/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) pickFile(f);
                          e.currentTarget.value = "";
                        }}
                      />

                      {/* 深度思考 */}
                      <button
                        onClick={() => setDeep((v) => !v)}
                        title="让模型先拆解假设、逐步论证再给结论"
                        className={
                          deep
                            ? "flex items-center gap-1.5 rounded-full border border-[#e0b79c] bg-[#fdeee1] px-3.5 py-2 text-[13px] font-medium text-[#c05f3c] transition"
                            : "flex items-center gap-1.5 rounded-full border border-[#ece6db] px-3.5 py-2 text-[13px] text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                        }
                      >
                        <BrainCircuit className="h-4 w-4" /> 深度思考
                      </button>

                      {/* 联网搜索 */}
                      <button
                        onClick={() => {
                          const next = !web;
                          setWeb(next);
                          toast(
                            next
                              ? "已开启联网搜索：本次提问走深度研究流程（未配置 Tavily 时会用示例来源并标注）"
                              : "已关闭联网搜索",
                            "info",
                          );
                        }}
                        title="开启后走深度研究流程，输出带来源的研究报告"
                        className={
                          web
                            ? "flex items-center gap-1.5 rounded-full border border-[#e0b79c] bg-[#fdeee1] px-3.5 py-2 text-[13px] font-medium text-[#c05f3c] transition"
                            : "flex items-center gap-1.5 rounded-full border border-[#ece6db] px-3.5 py-2 text-[13px] text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                        }
                      >
                        <Globe className="h-4 w-4" /> 联网搜索
                      </button>

                      {/* AI 角色 */}
                      <div ref={personaRef} className="relative">
                        <button
                          onClick={() => setPersonaOpen((v) => !v)}
                          title="选择 AI 角色"
                          className={
                            convo?.personaId
                              ? "flex items-center gap-1.5 rounded-full border border-[#e0b79c] bg-[#fdeee1] px-3.5 py-2 text-[13px] font-medium text-[#c05f3c] transition"
                              : "flex items-center gap-1.5 rounded-full border border-[#ece6db] px-3.5 py-2 text-[13px] text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                          }
                        >
                          <Bot className="h-4 w-4" />
                          <span className="max-w-[104px] truncate">
                            {getPersona(convo?.personaId)?.name ?? "默认助手"}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                        {personaOpen && (
                          <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-[280px] overflow-y-auto rounded-2xl border border-[#ece6db] bg-white p-1.5 shadow-xl">
                            <div className="px-2.5 py-1.5 text-[11px] text-stone-400">
                              AI 角色 · 影响后续回复的语气与专业视角
                            </div>
                            <div className="my-1 border-t border-stone-100" />
                            <button
                              onClick={() => void startRoundtable()}
                              disabled={roundtableBusy}
                              className="flex w-full items-start gap-2.5 rounded-xl bg-[#fdf1e3] px-2.5 py-2 text-left transition hover:bg-[#fdeee1] disabled:opacity-50"
                            >
                              <span className="text-[15px] leading-6">🎭</span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-medium text-stone-800">发起圆桌讨论</span>
                                <span className="block truncate text-[11.5px] text-stone-400">
                                  产品经理 · 文案 · 数据分析师 依次发言（用上方输入框给话题）
                                </span>
                              </span>
                            </button>
                            {PERSONAS.map((p) => {
                              const active = (convo?.personaId ?? null) === p.id ||
                                (p.id === "none" && !convo?.personaId);
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setPersona(p.id === "none" ? null : p.id);
                                    setPersonaOpen(false);
                                    toast(
                                      p.id === "none" ? "已恢复默认助手" : `已切换角色：${p.name}`,
                                      "success",
                                    );
                                  }}
                                  className={
                                    active
                                      ? "flex w-full items-start gap-2.5 rounded-xl bg-[#fdeee1] px-2.5 py-2 text-left"
                                      : "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-stone-50"
                                  }
                                >
                                  <span className="text-[15px] leading-6">{p.emoji}</span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-medium text-stone-700">
                                      {p.name}
                                    </span>
                                    <span className="block truncate text-[11.5px] text-stone-400">
                                      {p.desc}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ModelSelector
                        value={model}
                        onChange={(id, provider) => setModel(id, provider)}
                      />
                      <button
                        onClick={() => router.push("/settings")}
                        title="设置中心（模型密钥 / 备份）"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100"
                      >
                        <Settings className="h-[18px] w-[18px]" />
                      </button>
                      {sending ? (
                        <button
                          onClick={stopGeneration}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-700 text-white shadow-md transition hover:bg-stone-800"
                        >
                          <span className="block h-3.5 w-3.5 rounded-sm bg-white" />
                        </button>
                      ) : (
                        <button
                          onClick={sendMessage}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-md shadow-orange-200 transition hover:brightness-105 active:scale-95"
                        >
                          <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI 创作画布：点顶栏四个小方块显示 / 隐藏 */}
          {canvasOpen && <ArtifactPanel />}
        </div>
      </main>
      {/* 划词快捷追问浮层 */}
      {selPopup && (
        <div
          className="fixed z-40 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-xl border border-[#e9e4d9] bg-white p-1 shadow-xl"
          style={{ left: selPopup.x, top: selPopup.y }}
        >
          {([
            { kind: "explain" as const, label: "解释" },
            { kind: "translate" as const, label: "翻译" },
            { kind: "polish" as const, label: "改写" },
            { kind: "summarize" as const, label: "总结" },
          ]).map((it) => (
            <button
              key={it.kind}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => quickAsk(it.kind)}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-stone-600 transition hover:bg-[#fdeee1] hover:text-[#c05f3c]"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toaster />
    </div>
  );
}
