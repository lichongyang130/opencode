"use client";

import { create } from "zustand";
import { MODELS, resolveModel } from "@/lib/gateway/models";
import type { ProviderId } from "@/lib/gateway/types";
import { getOverrides, loadTavilyKey, loadDefaultModel, defaultModelForMode, serverProviderStatus } from "@/lib/settings";
import { toast } from "./toast";
import type { SlideDeck, SlideOutline, ThemeId } from "@/lib/slides/types";
import { buildOutlinePrompt } from "@/lib/slides/prompt";
import { outlineToContext, parseOutline as parseSlideOutline, fillCoverMeta } from "@/lib/slides/outline";
import { looseParseJson } from "@/lib/json-loose";
import type { ResearchDepth, ResearchLanguage, ResearchReport } from "@/lib/research/types";
import { buildImagePrompt, imageStyleById } from "@/lib/image/presets";
import { pushPromptHistory } from "@/lib/image/history";
import { formatDuration, totalDuration, type Storyboard, type StoryboardShot } from "@/lib/video/types";
import { getPersona } from "@/lib/personas";
import { describeNetError, fetchJSON, fetchWithTimeout, FetchError } from "@/lib/fetcher";
import {
  ABORT_TIMEOUT,
  ABORT_USER,
  finalizeStreamText,
  streamSSE,
  type StreamResult,
} from "@/lib/sse";

export type WorkspaceMode = "chat" | "research" | "slides" | "image" | "video" | "docs";

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
  /** 服务端消息时间戳（DB4 向上补拉的 before 游标）；本地新增消息没有 */
  createdAt?: number;
}

export interface UIImage {
  id: string;
  prompt: string;
  model: string;
  url: string;
  createdAt: number;
}

/** IMG 章：绘图生成选项（模型直选/张数/风格/负向/参考图） */
export interface ImageGenOptions {
  size?: string;
  /** IMG1: 直选绘图模型 id；不传则退回旧推断逻辑 */
  model?: string;
  /** IMG2: 一次生成张数（1~4，默认 1） */
  n?: number;
  /** IMG3: 风格 id（与 @/lib/image/presets 的 IMAGE_STYLES 对齐） */
  style?: string;
  /** IMG4: 负向提示词 */
  negative?: string;
  /** IMG5: 参考图（data URI 或公网 URL） */
  reference?: string;
}

export interface UIDoc {
  title: string;
  content: string; // Markdown
  updatedAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  mode: WorkspaceMode;
  model: string;
  /** 动态模型对应的供应商（静态模型无需） */
  modelProvider?: string;
  messages: UIMessage[];
  /** 消息是否已从数据库加载 */
  loaded?: boolean;
  /** 还有更早的历史消息未拉取（DB4，向上补拉用） */
  hasEarlier?: boolean;
  /** 正在补拉更早消息（防滚动抖动重复请求） */
  loadingEarlier?: boolean;
  deck?: SlideDeck;
  deckStatus?: "idle" | "loading" | "done" | "error";
  deckMessage?: string;
  /** PPT1: 大纲先行阶段产物（确认生成后清除；暂态不落库） */
  deckOutline?: SlideOutline;
  images?: UIImage[];
  report?: ResearchReport;
  doc?: UIDoc;
  video?: Storyboard;
  videoStatus?: "idle" | "loading" | "done" | "error";
  videoMessage?: string;
  researchStatus?: "idle" | "loading" | "done" | "error";
  researchMessage?: string;
  /** RS1: 各研究阶段是否已完成（时间线点亮态；暂态不落库，随研究结束清除） */
  researchStages?: Partial<Record<"plan" | "search" | "read" | "write", boolean>>;
  archived?: boolean;
  pinned?: boolean;
  /** 所属文件夹（DB14），null = 未分组 */
  folderId?: string | null;
  /** UX3 手动排序编号（非空 = 用户拖拽过），null = 未手动排序按时间 */
  sortIndex?: number | null;
  /** 服务端最近更新时间（ hydrate 时带回，本地新消息也同步刷新） */
  updatedAt?: number;
  /** 绑定的 AI 角色 id（personas.ts） */
  personaId?: string;
  createdAt: number;
}

const MODE_PROMPTS: Record<WorkspaceMode, string> = {
  chat: "你是一个全能 AI 助手，请用中文简洁专业地回答。",
  research:
    "你是深度研究助手。请对用户的主题进行结构化分析：背景、关键发现、数据支撑、引用来源建议、结论。后续版本将接入联网搜索。",
  slides:
    "你是 PPT 生成助手。请为用户的主题输出幻灯片大纲 JSON：{title, slides:[{title, bullets:[...], imagePrompt}]}，并附简短说明。",
  image: "你是 AI 绘图提示词助手。请根据用户描述输出优化后的英文绘图提示词（prompt），包含主体、风格、构图、光线。",
  video: "你是视频创作助手。请输出分镜脚本：场景、画面描述、旁白、时长建议。",
  docs: "你是专业写作助手。请根据用户需求输出一篇结构完整、可直接使用的中文文档，使用 Markdown：用 # 一级标题做文档标题，## 做小节，用列表罗列要点。只输出文档内容本身，不要输出解释或前言。",
};

export const MODE_LABELS: Record<WorkspaceMode, string> = {
  chat: "AI 对话",
  research: "深度研究",
  slides: "PPT 生成",
  image: "图片设计",
  video: "视频创作",
  docs: "文档写作",
};

let idSeq = 0;
const nextId = () => `${Date.now()}-${idSeq++}`;

/** hydrate 防重入标志（模块级，跨 store 实例共享） */
let hydrating = false;

/**
 * 窄屏（<768px）下产物画布只能以浮层覆盖对话区，
 * 因此默认收起，避免一进页面就把聊天区遮住；用户可从顶栏按钮手动打开。
 */
const isNarrowScreen = () =>
  typeof window !== "undefined" && window.innerWidth < 768;

/** 当前请求的中断控制器（停止生成 / 超时用） */
let activeAbort: AbortController | null = null;
/** 与 activeAbort 配对的整体超时计时器：流程收尾时必须清掉，否则进程会被空转的定时器挂住 */
let activeTimer: ReturnType<typeof setTimeout> | null = null;
function newAbort(timeoutMs = 120_000) {
  activeAbort?.abort(ABORT_USER);
  if (activeTimer) clearTimeout(activeTimer);
  const controller = new AbortController();
  // reason 用来区分「超时」与「用户点停止」，两者的提示文案完全不同
  const timer = setTimeout(() => controller.abort(ABORT_TIMEOUT), timeoutMs);
  const originalAbort = controller.abort.bind(controller);
  controller.abort = (reason?: unknown) => {
    clearTimeout(timer);
    originalAbort(reason ?? ABORT_USER);
  };
  activeAbort = controller;
  activeTimer = timer;
  return controller;
}

/** 流程正常收尾：清掉超时计时器并让出 activeAbort（若期间已被新请求替换则不动） */
function releaseAbort(controller: AbortController) {
  if (activeAbort === controller) {
    if (activeTimer) clearTimeout(activeTimer);
    activeTimer = null;
    activeAbort = null;
  }
}

/** 非流式请求的中断判定：超时也是 abort，但要按错误提示而非「已停止」处理 */
function isUserAbort(err: unknown, signal: AbortSignal): boolean {
  if (signal.reason === ABORT_TIMEOUT) return false;
  if (err instanceof FetchError) return err.kind === "abort";
  return (err as Error)?.name === "AbortError";
}

/**
 * 未知模型 id 的兜底路由（R14）。
 *
 * 模型 id 会从多个不可控来源进来：老会话里存着已下线的模型、中转服务动态拉取的
 * 列表换过名字、导入的备份带着别人配置的模型。这些 id 传到服务端后
 * `resolveModel` 会静默回退成演示模型，于是用户拿到的是内置假回答却毫不知情。
 * 这里在发请求之前就把兜底摊开讲清楚，并把请求体也一起改成 demo，
 * 保证「界面提示」与「实际调用」一致。
 */
function safeModel(id: string, provider?: string | null): { model: string; provider: ProviderId } {
  const { providerId, fallback } = resolveModel(id, (provider as ProviderId | null) ?? null);
  if (fallback) {
    toast(`模型「${id || "未指定"}」已不可用，本次改用演示模型`, "info");
    return { model: "demo", provider: "demo" };
  }
  return { model: id, provider: providerId };
}

/**
 * 生成任务互斥闸门（R12）。
 *
 * 光靠 store 的 sending 位挡不住重复提交：各入口都是
 * `if (get().sending) return` 之后还要 `await newConversation(...)` 才置位，
 * 这个 await 窗口里第二次调用能整个挤进来，于是两条流并发跑，
 * 而后来者的 newAbort() 又会把前一条掐断（表现为回答忽然停在半句）。
 * 模块级同步标志在任何 await 之前就落锁，彻底关掉这个窗口；
 * aiDoc 也共用这把锁，因为它同样会抢占 activeAbort。
 */
let taskLock = false;
function acquireTask(): boolean {
  if (taskLock) return false;
  taskLock = true;
  return true;
}
function releaseTask() {
  taskLock = false;
}


/** 发送时的附加选项（由输入舱的能力开关提供，都会真实影响请求） */
export interface SendOptions {
  /** 深度思考：追加分步推理的系统指令 */
  deep?: boolean;
  /** 附件正文（已读取的文本文件） */
  attachment?: { name: string; content: string };
}

const DEEP_THINK_PROMPT =
  "【深度思考模式】请先拆解问题与关键假设，逐步论证（必要时列出正反证据），再给出结论、替代方案与不确定性说明；回答要比默认更结构化、更完整。";

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  model: string;
  sending: boolean;
  hydrated: boolean;
  /** 会话列表分页游标（DB3）：null = 没有更多页 */
  convoCursor: string | null;
  /** 是否正在加载下一页（防止滚动监听重复触发） */
  loadingMore: boolean;
  /** 滚动到底自动拉取下一页会话（DB3） */
  loadMoreConversations: () => Promise<void>;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  /** 产物画布是否展开 */
  artifactOpen: boolean;
  /** 用户是否手动收起了画布（收起后不再被「有产物就自动弹出」覆盖） */
  artifactDismissed: boolean;
  setArtifactOpen: (v: boolean) => void;
  stopGeneration: () => void;
  hydrate: () => Promise<void>;
  runTemplate: (t: { mode: WorkspaceMode; prompt: string }) => Promise<void>;
  /** 把提示词填进输入框但不发送（真实案例点击行为）；若模式不符则新开同模式会话 */
  fillTemplate: (t: { mode: WorkspaceMode; prompt: string }) => Promise<void>;
  /** 待填入输入框的内容（nonce 变化触发 ChatPanel 消费） */
  pendingInput: { text: string; nonce: number } | null;
  /** 一键素材包：串行产出整套素材 */
  runPack: (packId: string, topic: string) => Promise<void>;
  setModel: (id: string, provider?: string) => void;
  newConversation: (mode?: WorkspaceMode) => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  /** 向上补拉当前会话更早的消息（DB4），返回新拉到的数量 */
  loadEarlierMessages: (id: string) => Promise<number>;
  deleteConversation: (id: string) => Promise<void>;
  togglePin: (id: string) => void;
  /** UX3：手动拖拽排序。entries 为目标顺序的 [id, sortIndex]，本地即时重排 + 批量落库 */
  reorderConversations: (entries: Array<{ id: string; sortIndex: number }>) => void;
  toggleArchive: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => void;
  batchArchive: (ids: string[], archived: boolean) => Promise<void>;
  batchDelete: (ids: string[]) => Promise<void>;
  setMode: (mode: WorkspaceMode) => void;
  /** 为当前会话设置/取消 AI 角色（null = 默认） */
  setPersona: (id: string | null) => void;
  send: (text: string, opts?: SendOptions) => Promise<void>;
  /** 编辑后重发：移除最后一条用户消息及其后的回复（同步删服务端），原文填回输入框 */
  editLastUserMessage: () => void;
  /** 对话分支：把某条消息及之前的记录复制为一个新会话，返回新会话 id */
  branchFromMessage: (messageId: string) => Promise<string | null>;
  /** 多智能体接棒：角色依次回答/处理同一任务（圆桌讨论与流水线的共用引擎） */
  runAgentSequence: (personaIds: string[], task: string, opts?: { pipeline?: boolean }) => Promise<string | null>;
  /** 重新生成最后一条 AI 回复（就地覆盖，不新增历史版本） */
  regenerate: () => Promise<void>;
  generateSlides: (topic: string, context?: string) => Promise<void>;
  generateImage: (prompt: string, opts?: ImageGenOptions) => Promise<void>;
  generateDocs: (topic: string, seed?: string) => Promise<void>;
  runResearch: (topic: string, opts?: { depth?: ResearchDepth; language?: ResearchLanguage }) => Promise<void>;
  /** V2：生成分镜脚本（topic 即需求描述；targetSec 目标时长可选） */
  generateStoryboard: (topic: string, opts?: { targetSec?: number; style?: string }) => Promise<void>;
  /** V4：编辑单镜（就地合并 patch） */
  patchShot: (shotId: string, patch: Partial<StoryboardShot>) => void;
  /** V4：新增/复制/删除/移动镜头 */
  addShot: () => void;
  duplicateShot: (shotId: string) => void;
  deleteShot: (shotId: string) => void;
  moveShot: (shotId: string, dir: -1 | 1) => void;
  /** V5：为单镜生成参考图（复用 images 通道，产物挂 shot.imageUrl） */
  generateShotImage: (shotId: string) => Promise<void>;
  /** V6：单镜旁白转 TTS */
  generateShotAudio: (shotId: string) => Promise<void>;
  reportToSlides: () => Promise<void>;
  reportToDoc: () => Promise<void>;
  /** RS4: 基于勾选的来源重写报告（不做新检索，直接综述选中来源） */
  rewriteFromSources: (sourceUrls: string[]) => Promise<void>;
  /** RS7: 报告内联追问——选中段落作为上下文继续提问，答案追加到对话 */
  askAboutReport: (question: string, selection?: string) => Promise<void>;
  setDoc: (doc: UIDoc) => void;
  aiDoc: (op: "continue" | "polish" | "shorten" | "expand" | "fix", selection?: string) => Promise<void>;
  docBusy: boolean;
  /** DOC2: 文档落库真实状态（防抖 PATCH 成败），供编辑器显示「保存中/已保存/失败重试」 */
  docSaveState: "idle" | "saving" | "saved" | "error";
  /** DOC2: 保存失败后的显式重试 */
  retryDocSave: () => Promise<void>;
  /** DOC5: 存一份版本快照（30 分钟节流，前端工具栏手动触发时立即存） */
  saveDocVersion: () => Promise<void>;
  /** DOC5: 拉取当前会话的版本列表（新→旧） */
  listDocVersions: () => Promise<Array<{ id: string; title: string; content: string; createdAt: number }>>;
  /** DOC5: 回滚到指定版本（就地覆盖 doc 并持久化） */
  restoreDocVersion: (versionId: string) => Promise<void>;
  /** DOC8: 把一段 Markdown（图片/表格）插入当前光标位置；cursor 未传则追加文末 */
  insertToDoc: (snippet: string, cursor?: number) => void;
  addImages: (images: UIImage[]) => void;
  /** IMG8: 按 id 删除若干张图（画廊单选/批量管理共用） */
  deleteImages: (ids: string[]) => void;
  /** IMG8: 清空当前会话全部图片 */
  clearImages: () => void;
  /** IMG11: 把生成图以 Markdown 追加到最近的文档会话末尾（无则新建文档会话） */
  insertImageToDoc: (url: string, prompt?: string) => Promise<void>;
  /** IMG11: 把生成图设为已有 PPT 最后一张的配图 */
  applyImageToSlide: (url: string) => void;
  setDeckTheme: (theme: ThemeId) => void;
  patchSlide: (slideIndex: number, patch: Record<string, unknown>) => void;
  addSlide: () => void;
  duplicateSlide: (index: number) => void;
  deleteSlide: (index: number) => void;
  /** PPT4: 拖拽排序：把 from 页移到 to 位（to 为插入后索引） */
  moveSlide: (from: number, to: number) => void;
  exportDeck: () => Promise<void>;
  /** PPT1: 大纲先行——只产出可编辑大纲（挂 deckOutline，不生成成稿） */
  generateSlidesOutline: (topic: string, context?: string) => Promise<void>;
  /** PPT1: 大纲确认后生成成稿（outline 存于会话上） */
  confirmOutline: () => Promise<void>;
  /** PPT1: 编辑大纲页（增删改标题/顺序），deckOutline 未加载时静默跳过 */
  patchOutlinePage: (index: number, patch: { title?: string; hint?: string }) => void;
  /** PPT1: 大纲页增删 */
  addOutlinePage: (afterIndex: number) => void;
  deleteOutlinePage: (index: number) => void;
  /** PPT1: 大纲页上下移动（dir -1 上移 / 1 下移） */
  moveOutlinePage: (index: number, dir: -1 | 1) => void;
  /** PPT2: 单页 AI 重写（保留主题与整体上下文，就地替换该页内容） */
  regenerateSlide: (slideIndex: number) => Promise<void>;
  /** PPT3: 为单页生成配图（复用 images 通道，产物挂 slide.imageUrl） */
  generateSlideImage: (slideIndex: number) => Promise<void>;
}

/** 服务端会话行 → 前端 Conversation（hydrate 与 loadMore 共用，字段口径必须一致） */
function mapServerConvo(c: Record<string, unknown>): Conversation {
  return {
    id: c.id as string,
    title: (c.title as string) ?? "新任务",
    mode: (c.mode as WorkspaceMode) ?? "chat",
    model: (c.model as string) ?? "demo",
    modelProvider: (c.modelProvider as string) ?? undefined,
    messages: [],
    loaded: false,
    deck: (c.deck as SlideDeck) ?? undefined,
    deckStatus: (c.deckStatus as Conversation["deckStatus"]) ?? undefined,
    images: (c.images as UIImage[]) ?? [],
    report: (c.report as ResearchReport) ?? undefined,
    researchStatus: c.report ? "done" : undefined,
    doc: (c.doc as UIDoc) ?? undefined,
    video: (c.video as Storyboard) ?? undefined,
    videoStatus: c.video ? "done" : undefined,
    archived: Boolean(c.archived),
    personaId: (c.personaId as string) ?? undefined,
    pinned: Boolean(c.pinned),
    folderId: (c.folderId as string | null) ?? undefined,
    sortIndex: (c.sortIndex as number | null) ?? undefined,
    updatedAt: (c.updatedAt as number) ?? undefined,
    createdAt: (c.createdAt as number) ?? Date.now(),
  };
}

/** PPT2：单页重写结果解析。宽松 JSON 提取单个 slide 对象，不合法返回 null（保留原页） */
function parseSingleSlide(raw: string): Partial<import("@/lib/slides/types").Slide> | null {
  const { value } = looseParseJson(raw);
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  if (typeof s.layout !== "string" || !s.layout) return null;
  const out: Record<string, unknown> = { layout: s.layout };
  for (const field of ["title", "subtitle", "twoColTitle", "imagePrompt", "note", "quote", "quoteBy"]) {
    if (typeof s[field] === "string") out[field] = s[field];
  }
  for (const field of ["bullets", "bulletsRight"]) {
    if (Array.isArray(s[field])) out[field] = (s[field] as unknown[]).map(String);
  }
  if (Array.isArray(s.stats)) {
    out.stats = (s.stats as unknown[])
      .map((x) => x as Record<string, unknown>)
      .filter((x) => x && typeof x.value !== "undefined")
      .map((x) => ({ value: String(x.value), label: String(x.label ?? "") }));
  }
  if (Array.isArray(s.steps)) {
    out.steps = (s.steps as unknown[])
      .map((x) => x as Record<string, unknown>)
      .filter((x) => x && typeof x.item !== "undefined")
      .map((x) => ({ item: String(x.item), detail: typeof x.detail === "string" ? x.detail : undefined }));
  }
  return out as Partial<import("@/lib/slides/types").Slide>;
}

function createConversation(mode: WorkspaceMode, model: string): Conversation {
  return {
    id: nextId(),
    title: MODE_LABELS[mode],
    mode,
    model,
    messages: [],
    loaded: true,
    archived: false,
    pinned: false,
    createdAt: Date.now(),
  };
}

async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  // 统一走 fetchJSON：带 30s 超时 + 错误归类，避免服务端不响应时请求永久挂着
  return fetchJSON<T>(url, init);
}

// 文档与 PPT 各自的落库防抖定时器（旧版共用一个，会互相取消）
let docPersistTimer: ReturnType<typeof setTimeout> | null = null;
let deckPersistTimer: ReturnType<typeof setTimeout> | null = null;
// V4：分镜编辑防抖持久化（与 deckPersistTimer 同一套模式，各自独立计时互不干扰）
let videoPersistTimer: ReturnType<typeof setTimeout> | null = null;

// DOC5：版本快照节流。每会话记上次快照时间，30 分钟窗口内重复保存不重复留版本，
// 避免打字过程每个防抖周期都插一行快照把表撑爆
const DOC_VERSION_INTERVAL_MS = 30 * 60 * 1000;
const docVersionLastAt = new Map<string, number>();

export const useChatStore = create<ChatState>((set, get) => {
  /** 本地更新当前会话 */
  const patchConvo = (id: string, p: Partial<Conversation>) =>
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, ...p } : c)),
    }));

  /**
   * 就地更新某会话的消息列表：会话已被删除时静默跳过。
   * 取代 `find(...)!.messages.map(...)` —— 流式生成过程中用户删掉会话
   * 不会再因非空断言落空而崩溃；同时在 set 内部读取最新 state，避免快照竞态。
   */
  const patchMessages = (id: string, updater: (messages: UIMessage[]) => UIMessage[]) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, messages: updater(c.messages) } : c
      ),
    }));

  /** 读取某会话（可能已被删除） */
  const findConvo = (id: string) => get().conversations.find((c) => c.id === id);

  /**
   * 读取某条消息的当前内容。
   * 流式过程中会话或消息都可能被删除，取不到时返回空串而不是抛错，
   * 这样「中断后保留已生成内容」的收尾逻辑在任何时序下都成立。
   */
  const messageContent = (convoId: string, messageId: string) =>
    findConvo(convoId)?.messages.find((m) => m.id === messageId)?.content ?? "";

  /** 建连阶段就失败时的统一提示（此时流里一个字都没有） */
  const netFallback = (err: unknown, fallback: string) =>
    `⚠️ ${describeNetError(err) || fallback}`;

  /** 持久化会话字段 */
  const persistConvo = (id: string, body: Record<string, unknown>) =>
    void api(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify(body) }).catch(
      () => {}
    );

  const persistMessage = (conversationId: string, m: UIMessage) =>
    void api("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        id: m.id,
        conversationId,
        role: m.role,
        content: m.content,
        error: Boolean(m.error),
      }),
    }).catch(() => {});

  return {
    conversations: [],
    activeId: null,
    model: "demo",
    sending: false,
    hydrated: false,
    convoCursor: null,
    loadingMore: false,
    settingsOpen: false,
    artifactOpen: !isNarrowScreen(),
    artifactDismissed: isNarrowScreen(),
    docBusy: false,
    docSaveState: "idle",
    pendingInput: null,

    setSettingsOpen: (v) => set({ settingsOpen: v }),
    // 手动收起画布时打上 dismissed 标记，避免「有产物自动弹出」把用户的收起操作顶掉；
    // 重新展开（点顶栏画布按钮）或新一轮生成开始时清除该标记。
    setArtifactOpen: (v) => set({ artifactOpen: v, artifactDismissed: !v }),

    stopGeneration: () => {
      activeAbort?.abort();
      activeAbort = null;
      set({ sending: false });
      toast("已停止生成", "info");
    },

    /** 编辑后重发：移除最后一条用户消息及其后的回复，原文填回输入框 */
    editLastUserMessage: () => {
      const { activeId, conversations, pendingInput } = get();
      const convo = conversations.find((c) => c.id === activeId);
      if (!convo || convo.messages.length === 0) return;
      const msgs = convo.messages;
      // 直接倒序找真实下标：旧版用 reverse().findIndex() 再换算，
      // 少减了 1，结果把 AI 回复当成原文填回输入框、用户消息反而没被撤回。
      let cut = -1;
      for (let i = msgs.length - 1; i >= 0; i -= 1) {
        if (msgs[i].role === "user") {
          cut = i;
          break;
        }
      }
      if (cut < 0) return;
      const removed = msgs.slice(cut);
      const text = msgs[cut].content;
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === activeId ? { ...c, messages: msgs.slice(0, cut) } : c,
        ),
        pendingInput: { text, nonce: (pendingInput?.nonce ?? 0) + 1 },
      }));
      for (const m of removed) {
        void api(`/api/messages?id=${encodeURIComponent(m.id)}`, { method: "DELETE" }).catch(() => {});
      }
    },

    /** 对话分支：复制该消息及之前的全部记录为新会话（服务端同步创建） */
    branchFromMessage: async (messageId) => {
      const { activeId, conversations } = get();
      const convo = conversations.find((c) => c.id === activeId);
      if (!convo) return null;
      const idx = convo.messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return null;
      const copy = convo.messages.slice(0, idx + 1);
      const newId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const branch: Conversation = {
        ...createConversation(convo.mode, convo.model),
        id: newId,
        title: `${convo.title} · 分支`,
        messages: copy,
        loaded: true,
        personaId: convo.personaId,
        // 画布产物一并带到分支
        deck: convo.deck,
        images: convo.images,
        report: convo.report,
        doc: convo.doc,
        pinned: false,
      };
      set((s) => ({
        conversations: [branch, ...s.conversations],
        activeId: newId,
        model: branch.model,
      }));
      await api("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ id: newId, title: branch.title, mode: branch.mode, model: branch.model }),
      }).catch(() => {});
      // 服务端消息 id 唯一约束：给分支副本生成新 id
      for (const m of copy) {
        await api("/api/messages", {
          method: "POST",
          body: JSON.stringify({
            id: `${m.id}-b${Math.random().toString(36).slice(2, 6)}`,
            conversationId: newId,
            role: m.role,
            content: m.content,
            error: Boolean(m.error),
          }),
        }).catch(() => {});
      }
      return newId;
    },

    /** 多智能体接棒引擎：每个角色依次收到任务（流水线模式附上前一步结果），
     *  回复就地加上【角色名】标签（同步服务端），完成后会话停留在最后一位角色的视角 */
    runAgentSequence: async (personaIds, task, opts) => {
      const ids = personaIds.filter((p) => p && p !== "none");
      if (ids.length === 0) return null;
      const newId = await get().newConversation("chat");
      await get().selectConversation(newId);
      let prevOutput = "";
      for (let i = 0; i < ids.length; i += 1) {
        const pid = ids[i];
        const name = getPersona(pid)?.name ?? `角色${i + 1}`;
        get().setPersona(pid);
        const prompt =
          opts?.pipeline && prevOutput
            ? `${task}\n\n以下是上一步（${getPersona(ids[i - 1])?.name ?? "上一位"}）的产出，请在此基础上完成你负责的部分：\n\n${prevOutput.slice(0, 3000)}`
            : task;
        await get().send(prompt);
        // 给刚生成的回复加角色名标签，并同步服务端
        const convo = get().conversations.find((c) => c.id === newId);
        const last = convo?.messages[convo.messages.length - 1];
        if (last && last.role === "assistant") {
          const labeled = `【${name}】\n\n${last.content}`;
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === newId
                ? { ...c, messages: c.messages.map((m) => (m.id === last.id ? { ...m, content: labeled } : m)) }
                : c,
            ),
          }));
          void api("/api/messages", {
            method: "PATCH",
            body: JSON.stringify({ id: last.id, content: labeled }),
          }).catch(() => {});
          prevOutput = last.content;
        }
      }
      return newId;
    },

    runTemplate: async (t) => {
      const id = await get().newConversation(t.mode);
      await get().selectConversation(id);
      // newConversation / selectConversation 都已同步写入 activeId，
      // 直接串行调用即可；旧版靠 setTimeout(60) 等渲染，慢设备上会错序
      if (t.mode === "image") await get().generateImage(t.prompt, { size: "1024x1024" });
      else await get().send(t.prompt);
    },

    fillTemplate: async (t) => {
      const { activeId, conversations } = get();
      const active = conversations.find((c) => c.id === activeId);
      // 模式不符时新开一个同模式会话，保证提示词落在正确的工作台
      if (!active || active.mode !== t.mode) {
        const id = await get().newConversation(t.mode);
        await get().selectConversation(id);
      }
      set((s) => ({
        pendingInput: { text: t.prompt, nonce: (s.pendingInput?.nonce ?? 0) + 1 },
      }));
    },

    runPack: async (packId, topic) => {
      const { ASSET_PACKS } = await import("@/lib/packs");
      const pack = ASSET_PACKS.find((p) => p.id === packId);
      const t = topic.trim();
      if (!pack || !t) return;
      toast(`素材包「${pack.label}」开始生成，共 ${pack.steps.length} 个任务`, "info");
      for (let i = 0; i < pack.steps.length; i++) {
        const step = pack.steps[i];
        const id = await get().newConversation(step.mode);
        await get().selectConversation(id);
        // 设置标题
        patchConvo(id, { title: `【${pack.label}】${step.title}` });
        persistConvo(id, { title: `【${pack.label}】${step.title}` });
        toast(`素材包进度 ${i + 1}/${pack.steps.length}：${step.title}`, "info");
        // 等新会话激活后发送（send 会按模式路由到 slides/research/docs 专用流程）
        await new Promise((r) => setTimeout(r, 120));
        if (step.mode === "image") {
          await get().generateImage(step.prompt(t), { size: "1024x1024" });
        } else {
          await get().send(step.prompt(t));
        }
      }
      toast(`素材包「${pack.label}」全部完成 ✅ 可在左栏查看各任务`, "success");
    },

    hydrate: async () => {
      // 同步置位防重入标志：hydrated 要等 await 之后才 set，
      // 期间若有第二个组件（Workspace / SettingsCenter）也调 hydrate 会并发跑两遍完整水合
      if (get().hydrated || hydrating) return;
      hydrating = true;
      try {
        // DB3: 首屏只拉一页，后续滚动到底再补拉；archived=all 保持
        // 「归档计数」的既有语义（列表内仍按 archived 分开渲染）。
        const data = await api<{
          conversations: Array<Record<string, unknown>>;
          nextCursor?: string | null;
        }>("/api/conversations?archived=all&limit=30");
        let convos: Conversation[] = data.conversations.map(mapServerConvo);

        if (convos.length === 0) {
          // 尊重设置中心里的「默认模型偏好」
          const prefModel = loadDefaultModel();
          const convo = createConversation("chat", prefModel || get().model);
          await api("/api/conversations", {
            method: "POST",
            body: JSON.stringify({ id: convo.id, title: convo.title, mode: convo.mode, model: convo.model }),
          });
          convos = [convo];
        }

        const firstActive = convos.find((c) => !c.archived) ?? convos[0];
        const prefModel = loadDefaultModel();
        set({
          conversations: convos,
          activeId: firstActive.id,
          // 会话没有明确选过模型时，落到用户设置的默认模型
          model: firstActive.model && firstActive.model !== "demo" ? firstActive.model : prefModel || "demo",
          hydrated: true,
          convoCursor: data.nextCursor ?? null,
        });
        // 加载首个会话的消息
        await get().selectConversation(firstActive.id);
      } catch {
        // 数据库不可用时退化为纯内存模式
        const convo = createConversation("chat", "demo");
        set({ conversations: [convo], activeId: convo.id, hydrated: true, convoCursor: null });
      } finally {
        hydrating = false;
      }
    },

    loadMoreConversations: async () => {
      const { convoCursor, loadingMore, conversations } = get();
      // 没有下一页 / 上一请求还在飞 / 首屏还没水合完，都不该再发请求
      if (!convoCursor || loadingMore || conversations.length === 0) return;
      set({ loadingMore: true });
      try {
        const data = await api<{
          conversations: Array<Record<string, unknown>>;
          nextCursor?: string | null;
        }>(`/api/conversations?archived=all&limit=30&cursor=${encodeURIComponent(convoCursor)}`);
        const more = data.conversations.map(mapServerConvo);
        // 去重合并：会话可能在上页与新页之间被更新而串位
        const seen = new Set(conversations.map((c) => c.id));
        set({
          conversations: [...conversations, ...more.filter((c) => !seen.has(c.id))],
          convoCursor: data.nextCursor ?? null,
        });
      } catch {
        // 网络失败静默：保持现有列表与游标，用户再滚一次会重试
      } finally {
        set({ loadingMore: false });
      }
    },

    setModel: (id, provider) => {
      const { providerId } = resolveModel(id, (provider as ProviderId | null) ?? null);
      set({ model: id });
      const { activeId } = get();
      if (activeId) {
        patchConvo(activeId, { model: id, modelProvider: provider ?? providerId });
        persistConvo(activeId, { model: id, modelProvider: provider ?? providerId });
      }
    },

    newConversation: async (mode = "chat") => {
      // 优先使用设置里为该工作台配置的默认模型
      const modeDefault = defaultModelForMode(mode);
      const convo = createConversation(mode, modeDefault || get().model);
      set((s) => ({
        conversations: [convo, ...s.conversations],
        activeId: convo.id,
        model: convo.model,
        artifactDismissed: false,
      }));
      await api("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ id: convo.id, title: convo.title, mode, model: convo.model }),
      }).catch(() => {});
      return convo.id;
    },

    selectConversation: async (id) => {
      set({ activeId: id, artifactDismissed: false });
      const convo = get().conversations.find((c) => c.id === id);
      if (!convo) return;
      set({ model: convo.model });
      if (convo.loaded) return;
      try {
        // DB4: 超长会话首次只拉最近 50 条，更早的等用户向上滚动再补
        const data = await api<{
          messages: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
            error: boolean;
            createdAt: number;
          }>;
          hasMore?: boolean;
        }>(`/api/conversations/${id}?limit=50`);
        patchConvo(id, {
          loaded: true,
          hasEarlier: Boolean(data.hasMore),
          messages: data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            error: m.error,
            createdAt: m.createdAt,
          })),
        });
      } catch {
        patchConvo(id, { loaded: true });
      }
    },

    /** 向上补拉更早的消息（DB4）：prepend 到当前会话，返回新拉到的数量 */
    loadEarlierMessages: async (id) => {
      const convo = get().conversations.find((c) => c.id === id);
      // 没有更早历史 / 正在补拉时直接返回，防止滚动监听抖动重复请求
      if (!convo || !convo.hasEarlier || convo.loadingEarlier) return 0;
      const first = convo.messages[0];
      // 首条是本地新增（无 createdAt）说明历史已全在眼前，无需再拉
      if (!first?.createdAt) return 0;
      patchConvo(id, { loadingEarlier: true });
      try {
        // before 取当前最早一条的时间戳，拉严格更早的一页
        const data = await api<{
          messages: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
            error: boolean;
            createdAt: number;
          }>;
          hasMore?: boolean;
        }>(`/api/conversations/${id}?limit=50&before=${first.createdAt}`);
        const fetched = data.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          error: m.error,
          createdAt: m.createdAt,
        }));
        patchConvo(id, {
          loadingEarlier: false,
          hasEarlier: Boolean(data.hasMore),
          // 服务端返回 DESC+reverse 后已是时间正序，直接拼在前面
          messages: [...fetched, ...(findConvo(id)?.messages ?? [])],
        });
        return fetched.length;
      } catch {
        patchConvo(id, { loadingEarlier: false });
        return 0;
      }
    },

    deleteConversation: async (id) => {
      const remaining = get().conversations.filter((c) => c.id !== id);
      const fallback = remaining.find((c) => !c.archived) ?? remaining[0];
      const activeGone = get().activeId === id;
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
        activeId: activeGone ? fallback?.id ?? null : s.activeId,
      }));
      if (activeGone && fallback) {
        set({ model: fallback.model });
        void get().selectConversation(fallback.id);
      }
      await api(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    },

    togglePin: (id) => {
      const convo = get().conversations.find((c) => c.id === id);
      if (!convo) return;
      const pinned = !convo.pinned;
      patchConvo(id, { pinned });
      // 置顶排到最前：重排序
      set((s) => {
        const list = s.conversations
          .map((c) => (c.id === id ? { ...c, pinned } : c))
          .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false));
        return { conversations: list };
      });
      persistConvo(id, { pinned });
    },

    reorderConversations: (entries) => {
      if (!entries.length) return;
      const idx = new Map(entries.map((e) => [e.id, e.sortIndex]));
      // 本地即时重排：置顶仍在最前，已编号行按 sortIndex 升序，其余按更新时间。
      // 拖拽发生在可视列表上，乐观更新避免等接口回来才跳位。
      set((s) => ({
        conversations: [...s.conversations]
          .map((c) => (idx.has(c.id) ? { ...c, sortIndex: idx.get(c.id)! } : c))
          .sort(
            (a, b) =>
              Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
              (a.sortIndex ?? Infinity) - (b.sortIndex ?? Infinity) ||
              (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)
          ),
      }));
      // 批量落库走专用 reorder 通道：只写 sortIndex，不刷新 updatedAt
      void api("/api/conversations/batch", {
        method: "POST",
        body: JSON.stringify({ action: "reorder", entries }),
      }).catch(() => toast("排序保存失败", "error"));
    },

    toggleArchive: async (id) => {
      const convo = get().conversations.find((c) => c.id === id);
      if (!convo) return;
      const archived = !convo.archived;
      patchConvo(id, { archived });
      persistConvo(id, { archived });
      // 归档当前会话后切到下一个活跃会话
      if (archived && get().activeId === id) {
        const next = get().conversations.find((c) => c.id !== id && !c.archived);
        if (next) {
          set({ activeId: next.id, model: next.model });
          await get().selectConversation(next.id);
        } else {
          const newId = await get().newConversation("chat");
          set({ activeId: newId });
        }
      }
    },

    renameConversation: (id, title) => {
      const t = title.trim();
      if (!t) return;
      patchConvo(id, { title: t });
      persistConvo(id, { title: t });
    },

    batchArchive: async (ids, archived) => {
      set((s) => ({
        conversations: s.conversations.map((c) =>
          ids.includes(c.id) ? { ...c, archived } : c
        ),
      }));
      await api("/api/conversations/batch", {
        method: "POST",
        body: JSON.stringify({ action: archived ? "archive" : "unarchive", ids }),
      })
        .then(() => toast(archived ? `已归档 ${ids.length} 个任务` : `已恢复 ${ids.length} 个任务`, "success"))
        .catch(() => toast("操作失败", "error"));
    },

    batchDelete: async (ids) => {
      const remaining = get().conversations.filter((c) => !ids.includes(c.id));
      const activeGone = get().activeId && ids.includes(get().activeId!);
      const fallback = remaining.find((c) => !c.archived) ?? remaining[0];
      set({
        conversations: remaining,
        activeId: activeGone ? fallback?.id ?? null : get().activeId,
      });
      if (activeGone && fallback) {
        set({ model: fallback.model });
        void get().selectConversation(fallback.id);
      }
      await api("/api/conversations/batch", {
        method: "POST",
        body: JSON.stringify({ action: "delete", ids }),
      })
        .then(() => toast(`已删除 ${ids.length} 个任务`, "success"))
        .catch(() => toast("删除失败", "error"));
    },

    setMode: (mode) => {
      const { activeId } = get();
      if (!activeId) return;
      patchConvo(activeId, { mode });
      persistConvo(activeId, { mode });
    },

    setPersona: (id) => {
      const { activeId } = get();
      if (!activeId) return;
      patchConvo(activeId, { personaId: id || undefined });
      persistConvo(activeId, { personaId: id || null });
    },

    addImages: (images) => {
      const { activeId, conversations } = get();
      if (!activeId) return;
      const convo = conversations.find((c) => c.id === activeId);
      const next = [...(convo?.images ?? []), ...images];
      patchConvo(activeId, { images: next });
      persistConvo(activeId, { images: next });
    },

    generateImage: async (prompt, opts) => {
      const p = prompt.trim();
      if (!p || get().sending) return;
      // 同步落锁必须在任何 await 之前，否则 newConversation 期间会漏进第二次调用
      if (!acquireTask()) return;

      // IMG3: 风格词前置拼进提示词（不传风格时原样透传，保持旧行为不变）
      const style = imageStyleById(opts?.style);
      const finalPrompt = buildImagePrompt(p, style);
      const size = opts?.size ?? "1024x1024";
      // IMG2: 张数钳制到 1~4；非法值按 1 处理
      const n = Math.max(1, Math.min(4, opts?.n ?? 1));

      let convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo) {
        const id = await get().newConversation("image");
        convo = findConvo(id);
        if (!convo) {
          releaseTask();
          return;
        }
      }
      const current = convo;
      if (current.mode !== "image") {
        patchConvo(current.id, { mode: "image" });
        persistConvo(current.id, { mode: "image" });
      }

      const userMsg: UIMessage = { id: nextId(), role: "user", content: `绘图：${p}` };
      const assistantMsg: UIMessage = {
        id: nextId(),
        role: "assistant",
        content: n > 1 ? `正在生成 ${n} 张图像…` : "正在生成图像…",
        streaming: true,
      };
      const title = current.messages.length === 0 ? p.slice(0, 24) : current.title;
      patchConvo(current.id, {
        title,
        messages: [...current.messages, userMsg, assistantMsg],
      });
      if (title !== current.title) persistConvo(current.id, { title });
      set({ sending: true, artifactDismissed: false });

      const ov = getOverrides();
      // IMG1: 优先直选绘图模型（与对话模型解耦）；未传才退回旧推断逻辑兜底
      const serverStatus = await serverProviderStatus();
      const hasDashscope = Boolean(ov.dashscope?.apiKey) || serverStatus.dashscope === true;
      const hasOpenai = Boolean(ov.openai?.apiKey) || serverStatus.openai === true;
      let imageModel = opts?.model ?? "demo-image";
      if (!opts?.model) {
        if (hasDashscope && current.model.startsWith("qwen")) imageModel = "wan2.7-t2i-flash";
        else if (hasOpenai) imageModel = "dall-e-3";
        else if (hasDashscope) imageModel = "wan2.7-t2i-flash";
      }

      const controller = newAbort();
      try {
        // 绘图是非流式接口，但生成常要 30s 以上，给足 120s 再由 controller 兜底
        const res = await fetchWithTimeout("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: imageModel,
            prompt: finalPrompt,
            size,
            n,
            negative: opts?.negative,
            reference: opts?.reference,
            overrides: ov,
          }),
          signal: controller.signal,
          timeoutMs: 120_000,
        });
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          model?: string;
          images?: Array<{ url: string; model: string }>;
          error?: string;
        };
        if (!res.ok || (!data.url && !data.images?.length)) {
          throw new Error(data.error ?? `图像生成失败（HTTP ${res.status}）`);
        }

        // IMG2: 多张返回 images 数组，单张返回 url，统一归成 UIImage 批量入库
        const items = data.images?.length
          ? data.images
          : [{ url: data.url as string, model: data.model ?? imageModel }];
        const imgs: UIImage[] = items.map((it) => ({
          id: nextId(),
          prompt: p,
          model: it.model ?? imageModel,
          url: it.url,
          createdAt: Date.now(),
        }));
        get().addImages(imgs);

        // IMG6: 记录完整参数供「用此参数再生成」，与产物生命周期解耦
        pushPromptHistory({
          prompt: p,
          model: imageModel,
          size,
          style: opts?.style,
          negative: opts?.negative,
        });

        const note =
          imgs.length > 1
            ? `✅ 已生成 ${imgs.length} 张图像（${imageModel}）。可在右侧画布挑选、下载。`
            : `✅ 图像已生成（${imageModel}）。可在右侧画布查看、下载。`;
        patchMessages(current.id, (messages) =>
          messages.map((m) => (m.id === assistantMsg.id ? { ...m, content: note, streaming: false } : m))
        );
        persistMessage(current.id, userMsg);
        persistMessage(current.id, { ...assistantMsg, content: note });
      } catch (err) {
        // 用户主动停止不算错误，不该标红气泡
        const aborted = isUserAbort(err, controller.signal);
        const content = aborted ? "已停止生成。" : netFallback(err, "图像生成失败");
        patchMessages(current.id, (messages) =>
          messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content, streaming: false, error: !aborted } : m
          )
        );
        persistMessage(current.id, userMsg);
        persistMessage(current.id, { ...assistantMsg, content, error: !aborted });
      } finally {
        releaseAbort(controller);
        releaseTask();
        set({ sending: false });
      }
    },

    deleteImages: (ids) => {
      const { activeId, conversations } = get();
      if (!activeId) return;
      const convo = conversations.find((c) => c.id === activeId);
      if (!convo) return;
      const wanted = new Set(ids);
      const next = (convo.images ?? []).filter((i) => !wanted.has(i.id));
      patchConvo(activeId, { images: next });
      persistConvo(activeId, { images: next });
    },

    clearImages: () => {
      const { activeId, conversations } = get();
      if (!activeId) return;
      if (!conversations.find((c) => c.id === activeId)) return;
      patchConvo(activeId, { images: [] });
      persistConvo(activeId, { images: [] });
    },

    /** IMG11: 生成图 → 文档。追加到最近文档会话末尾；没有 docs 会话则新建一个 */
    insertImageToDoc: async (url, prompt) => {
      const alt = (prompt || "AI 生成图").replace(/\n/g, " ");
      const markdown = `\n\n![${alt}](${url})\n`;
      const docsConvo = get().conversations.find((c) => c.mode === "docs" && c.doc);
      if (docsConvo?.doc) {
        const doc = { ...docsConvo.doc, content: `${docsConvo.doc.content}${markdown}`, updatedAt: Date.now() };
        patchConvo(docsConvo.id, { doc });
        persistConvo(docsConvo.id, { doc });
        await get().selectConversation(docsConvo.id);
        toast("图片已插入文档末尾", "success");
        return;
      }
      const id = await get().newConversation("docs");
      const convo = findConvo(id);
      if (!convo) return;
      const doc: UIDoc = { title: prompt?.slice(0, 30) || "图片素材", content: markdown.trim(), updatedAt: Date.now() };
      patchConvo(id, { doc });
      persistConvo(id, { doc });
      await get().selectConversation(id);
      toast("已新建文档并插入图片", "success");
    },

    /** IMG11: 生成图 → PPT 配图位。写入已有 slides 会话最后一张的 imageUrl */
    applyImageToSlide: (url) => {
      const convo = get().conversations.find((c) => c.mode === "slides" && c.deck);
      const deck = convo?.deck;
      if (!deck || deck.slides.length === 0) {
        toast("请先生成 PPT，再插入配图", "info");
        return;
      }
      const idx = deck.slides.length - 1;
      const slides = deck.slides.map((s, i) => (i === idx ? { ...s, imageUrl: url } : s));
      const next = { ...deck, slides };
      patchConvo(convo!.id, { deck: next });
      persistConvo(convo!.id, { deck: next });
      toast(`已设为第 ${idx + 1} 页配图`, "success");
    },

    send: async (text, opts) => {
      const trimmed = text.trim();
      if (!trimmed || get().sending) return;
      if (!acquireTask()) return;

      const { activeId } = get();
      const convoNow = get().conversations.find((c) => c.id === activeId);
      // 未知模型先兜底成 demo 并提示，避免服务端静默换成演示模型（R14）
      const { model, provider: modelProvider } = safeModel(
        convoNow?.model ?? get().model,
        convoNow?.modelProvider
      );
      let convo = convoNow;
      if (!convo) {
        const id = await get().newConversation("chat");
        convo = findConvo(id);
        if (!convo) {
          releaseTask();
          return;
        }
      }
      const current = convo;

      /*
       * 模式转发前必须先解锁：被转发的 action 会自己重新抢锁，
       * 否则永远抢不到，PPT / 研究 / 文档三种模式会彻底发不出请求。
       */
      if (current.mode === "slides" || current.mode === "research" || current.mode === "docs" || current.mode === "video") {
        releaseTask();
        if (current.mode === "slides") await get().generateSlides(trimmed);
        else if (current.mode === "research") await get().runResearch(trimmed);
        else if (current.mode === "video") await get().generateStoryboard(trimmed);
        else await get().generateDocs(trimmed);
        return;
      }


      const userMsg: UIMessage = { id: nextId(), role: "user", content: trimmed };
      const assistantMsg: UIMessage = {
        id: nextId(),
        role: "assistant",
        content: "",
        streaming: true,
      };

      const title = current.messages.length === 0 ? trimmed.slice(0, 24) : current.title;
      patchConvo(current.id, {
        title,
        messages: [...current.messages, userMsg, assistantMsg],
      });
      if (title !== current.title) persistConvo(current.id, { title });
      set({ sending: true, artifactDismissed: false });

      // AI 角色 system prompt（叠加在模式提示词之后）
      let personaSystem = "";
      if (current.personaId) {
        const persona = getPersona(current.personaId);
        if (persona?.system) personaSystem = persona.system;
      }
      // 能力开关 / 附件作为附加系统指令（不污染用户气泡里显示的原文）
      const extras: string[] = [];
      if (opts?.deep) extras.push(DEEP_THINK_PROMPT);
      if (opts?.attachment?.content) {
        const body = opts.attachment.content.slice(0, 12000);
        extras.push(
          `【附件：${opts.attachment.name}】以下是用户上传的文件内容，请基于它回答问题：\n${body}`,
        );
      }
      const systemContent = [MODE_PROMPTS[current.mode], personaSystem, ...extras]
        .filter(Boolean)
        .join("\n\n");

      const apiMessages = [
        { role: "system" as const, content: systemContent },
        ...current.messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: trimmed },
      ];

      const controller = newAbort();
      let errored: string | null = null;
      let result: StreamResult;
      try {
        result = await streamSSE<
          | { type: "delta"; delta: string }
          | { type: "usage"; credits: number }
          | { type: "error"; message: string }
        >("/api/chat", {
          body: {
            model,
            messages: apiMessages,
            overrides: getOverrides(),
            provider: modelProvider,
          },
          signal: controller.signal,
          onEvent: (evt) => {
            if (evt.type === "delta") {
              patchMessages(current.id, (messages) =>
                messages.map((mm) =>
                  mm.id === assistantMsg.id ? { ...mm, content: mm.content + evt.delta } : mm
                )
              );
            } else if (evt.type === "error") {
              errored = evt.message;
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
      } catch (err) {
        // 走到这里说明连响应头都没拿到，气泡里必然是空的，直接写错误文案
        const content = netFallback(err, "网络错误，请重试");
        patchMessages(current.id, (messages) =>
          messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, streaming: false, error: true, content } : m
          )
        );
        persistMessage(current.id, userMsg);
        persistMessage(current.id, { ...assistantMsg, content, error: true });
        releaseAbort(controller);
        releaseTask();
        set({ sending: false });
        return;
      }

      const { content: finalContent, error: hasError } = finalizeStreamText(
        messageContent(current.id, assistantMsg.id),
        result,
        errored
      );
      patchMessages(current.id, (messages) =>
        messages.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, streaming: false, error: hasError, content: finalContent }
            : m
        )
      );
      persistMessage(current.id, userMsg);
      persistMessage(current.id, { ...assistantMsg, content: finalContent, error: hasError });
      releaseAbort(controller);
      releaseTask();
      set({ sending: false });
    },

    regenerate: async () => {
      const { activeId, sending } = get();
      if (sending) return;
      if (!acquireTask()) return;
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo) {
        releaseTask();
        return;
      }
      const msgs = convo.messages;
      const last = msgs[msgs.length - 1];
      // 只在最后一条是 AI 回复时可重新生成
      if (!last || last.role !== "assistant") {
        toast("最后一条不是 AI 回复，无法重新生成", "info");
        releaseTask();
        return;
      }
      const { model, provider: modelProvider } = safeModel(
        convo.model ?? get().model,
        convo.modelProvider
      );

      // 就地重置这条回复，再基于它之前的上下文重新流式生成
      patchConvo(convo.id, {
        messages: msgs.map((m) =>
          m.id === last.id ? { ...m, content: "", streaming: true, error: false } : m,
        ),
      });
      set({ sending: true });

      let personaSystem = "";
      if (convo.personaId) {
        const persona = getPersona(convo.personaId);
        if (persona?.system) personaSystem = persona.system;
      }
      const systemContent = [MODE_PROMPTS[convo.mode], personaSystem].filter(Boolean).join("\n\n");
      const apiMessages = [
        { role: "system" as const, content: systemContent },
        ...msgs.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
      ];

      const controller = newAbort();
      let finalContent = "";
      let hasError = false;
      let errored: string | null = null;
      try {
        const result = await streamSSE<
          { type: "delta"; delta: string } | { type: "error"; message: string }
        >("/api/chat", {
          body: {
            model,
            messages: apiMessages,
            overrides: getOverrides(),
            provider: modelProvider,
          },
          signal: controller.signal,
          onEvent: (evt) => {
            if (evt.type === "delta") {
              patchMessages(convo.id, (messages) =>
                messages.map((mm) =>
                  mm.id === last.id ? { ...mm, content: mm.content + evt.delta } : mm
                )
              );
            } else if (evt.type === "error") {
              errored = evt.message;
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
        const finalized = finalizeStreamText(
          messageContent(convo.id, last.id),
          result,
          errored
        );
        finalContent = finalized.content;
        hasError = finalized.error;
      } catch (err) {
        finalContent = netFallback(err, "网络错误，请重试");
        hasError = true;
      } finally {
        patchMessages(convo.id, (messages) =>
          messages.map((m) =>
            m.id === last.id
              ? { ...m, streaming: false, error: hasError, content: finalContent }
              : m,
          )
        );
        // 同一条消息就地更新，避免数据库里堆叠旧版本
        void api("/api/messages", {
          method: "PATCH",
          body: JSON.stringify({ id: last.id, content: finalContent, error: hasError }),
        }).catch(() => undefined);
        releaseAbort(controller);
        releaseTask();
        set({ sending: false });
      }
    },

    generateSlides: async (topic, context) => {
      const trimmed = topic.trim();
      if (!trimmed || get().sending) return;
      if (!acquireTask()) return;

      let convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo) {
        const id = await get().newConversation("slides");
        convo = findConvo(id);
        if (!convo) {
          releaseTask();
          return;
        }
      }
      const current = convo;
      if (current.mode !== "slides") {
        patchConvo(current.id, { mode: "slides" });
        persistConvo(current.id, { mode: "slides" });
      }

      const userMsg: UIMessage = { id: nextId(), role: "user", content: `生成 PPT：${trimmed}` };
      const assistantMsg: UIMessage = { id: nextId(), role: "assistant", content: "", streaming: true };

      const title = current.messages.length === 0 ? trimmed.slice(0, 24) : current.title;
      patchConvo(current.id, {
        title,
        deckStatus: "loading",
        deckMessage: "正在规划幻灯片结构…",
        messages: [...current.messages, userMsg, assistantMsg],
      });
      persistConvo(current.id, { title, deckStatus: "loading" });
      set({ sending: true, artifactDismissed: false });

      const updateAssistant = (content: string, extra?: Partial<UIMessage>) => {
        patchMessages(current.id, (messages) =>
          messages.map((m) => (m.id === assistantMsg.id ? { ...m, content, ...extra } : m))
        );
      };

      const slidesController = newAbort(180_000);
      const slidesModel = safeModel(current.model, current.modelProvider);
      let deck: SlideDeck | null = null;
      let error: string | null = null;
      let result: StreamResult | null = null;
      try {
        result = await streamSSE<
          | { type: "status"; message: string }
          | { type: "done"; result: SlideDeck }
          | { type: "error"; message: string }
        >("/api/slides", {
          body: {
            topic: trimmed,
            model: slidesModel.model,
            provider: slidesModel.provider,
            overrides: getOverrides(),
            context: context ? context.slice(0, 6000) : undefined,
          },
          signal: slidesController.signal,
          onEvent: (evt) => {
            if (evt.type === "status") {
              patchConvo(current.id, { deckMessage: evt.message });
              updateAssistant(evt.message + "…");
            } else if (evt.type === "done") {
              deck = evt.result;
            } else if (evt.type === "error") {
              error = evt.message;
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
      } catch (err) {
        error = describeNetError(err) || "幻灯片生成失败";
      }

      // deck 是唯一的成功标志：只要拿到了就算成功，哪怕流末尾断开
      if (deck) {
        // PPT9：封面副标题与日期自动填充（幂等，已含当日不重复加）
        const ready = fillCoverMeta(deck as SlideDeck);
        const note = `✅ PPT《${ready.title}》已生成，共 ${ready.slides.length} 页。可在右侧画布切换主题、编辑文字，或导出 PPTX。`;
        patchConvo(current.id, { deck: ready, deckStatus: "done", deckMessage: undefined });
        updateAssistant(note, { streaming: false });
        persistConvo(current.id, { deck: ready, deckStatus: "done" });
        persistMessage(current.id, userMsg);
        persistMessage(current.id, { ...assistantMsg, content: note });
      } else {
        // 中断（用户停止 / 超时 / 断流）与服务端报错的文案完全不同，交给 finalizeStreamText 判定
        const { content, error: hasError } = result
          ? finalizeStreamText("", result, error)
          : { content: `⚠️ ${error ?? "幻灯片生成失败"}`, error: true };
        patchConvo(current.id, {
          deckStatus: hasError ? "error" : "idle",
          deckMessage: undefined,
        });
        updateAssistant(content, { streaming: false, error: hasError });
        if (hasError) persistConvo(current.id, { deckStatus: "error" });
        persistMessage(current.id, userMsg);
        persistMessage(current.id, { ...assistantMsg, content, error: hasError });
      }
      releaseAbort(slidesController);
      releaseTask();
      set({ sending: false });
    },

    runResearch: async (topic, researchOpts) => {
      const trimmed = topic.trim();
      // RS5/RS8: 深度与语言（未传走服务端默认，与旧行为一致）
      const researchDepth = researchOpts?.depth;
      const researchLanguage = researchOpts?.language;
      if (!trimmed || get().sending) return;
      if (!acquireTask()) return;

      let convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo) {
        const id = await get().newConversation("research");
        convo = findConvo(id);
        if (!convo) {
          releaseTask();
          return;
        }
      }
      const current = convo;
      if (current.mode !== "research") {
        patchConvo(current.id, { mode: "research" });
        persistConvo(current.id, { mode: "research" });
      }

      const userMsg: UIMessage = { id: nextId(), role: "user", content: `研究：${trimmed}` };
      const assistantMsg: UIMessage = {
        id: nextId(),
        role: "assistant",
        content: "正在规划研究…",
        streaming: true,
      };
      const title = current.messages.length === 0 ? trimmed.slice(0, 24) : current.title;
      patchConvo(current.id, {
        title,
        researchStatus: "loading",
        researchMessage: "正在规划研究…",
        messages: [...current.messages, userMsg, assistantMsg],
      });
      if (title !== current.title) persistConvo(current.id, { title });
      set({ sending: true, artifactDismissed: false });

      const updateAssistant = (content: string, extra?: Partial<UIMessage>) => {
        patchMessages(current.id, (messages) =>
          messages.map((m) => (m.id === assistantMsg.id ? { ...m, content, ...extra } : m))
        );
      };

      const researchController = newAbort(180_000);
      const researchModel = safeModel(current.model, current.modelProvider);
      let report: ResearchReport | null = null;
      let error: string | null = null;
      let result: StreamResult | null = null;
      // RS1: 阶段时间线。stage → 已完成步数，前端按序点亮
      const stageDone: Record<string, boolean> = {};
      try {
        result = await streamSSE<
          | { type: "status"; message: string; stage?: "plan" | "search" | "read" | "write" }
          | { type: "done"; result: ResearchReport }
          | { type: "error"; message: string }
        >("/api/research", {
          body: {
            topic: trimmed,
            model: researchModel.model,
            provider: researchModel.provider,
            overrides: getOverrides(),
            tavilyKey: loadTavilyKey(),
            // RS5/RS8: 深度与语言透传（旧值 undefined 走服务端默认，行为不变）
            depth: researchDepth,
            language: researchLanguage,
          },
          signal: researchController.signal,
          onEvent: (evt) => {
            if (evt.type === "status") {
              if (evt.stage) stageDone[evt.stage] = true;
              patchConvo(current.id, { researchMessage: evt.message, researchStages: { ...stageDone } });
              updateAssistant(evt.message + "…");
            } else if (evt.type === "done") {
              report = evt.result;
            } else if (evt.type === "error") {
              error = evt.message;
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
      } catch (err) {
        error = describeNetError(err) || "研究失败";
      }

      if (report) {
        const ready = report as ResearchReport;
        const badge = ready.partial ? "（部分完成：综述中断，已保留检索来源）" : "";
        const note = `✅ 研究报告《${ready.topic}》已完成${badge}，共 ${ready.sections.length} 个小节、引用 ${ready.sources.length} 个来源。可在右侧画布阅读全文并「一键转 PPT」。`;
        patchConvo(current.id, {
          report: ready,
          researchStatus: "done",
          researchMessage: undefined,
          researchStages: undefined,
        });
        updateAssistant(note, { streaming: false });
        // researchStatus 不是数据库字段（水合时由 report 是否存在推导），不再发送死字段
        // RS6: partial 半成品同样落库——来源与原文是真实成果，刷新不丢
        persistConvo(current.id, { report: ready });
        persistMessage(current.id, userMsg);
        persistMessage(current.id, { ...assistantMsg, content: note });
      } else {
        const { content, error: hasError } = result
          ? finalizeStreamText("", result, error)
          : { content: `⚠️ ${error ?? "研究失败"}`, error: true };
        patchConvo(current.id, {
          researchStatus: hasError ? "error" : "idle",
          researchMessage: undefined,
          researchStages: undefined,
        });
        updateAssistant(content, { streaming: false, error: hasError });
        persistMessage(current.id, userMsg);
        persistMessage(current.id, { ...assistantMsg, content, error: hasError });
      }
      releaseAbort(researchController);
      releaseTask();
      set({ sending: false });
    },

    /** V2：生成分镜脚本。与 generateSlides 同构：status → done(Storyboard) | error */
    generateStoryboard: async (topic, opts) => {
      const trimmed = topic.trim();
      if (!trimmed || get().sending) return;
      if (!acquireTask()) return;

      let convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo) {
        const id = await get().newConversation("video");
        convo = findConvo(id);
        if (!convo) {
          releaseTask();
          return;
        }
      }
      const current = convo;
      if (current.mode !== "video") {
        patchConvo(current.id, { mode: "video" });
        persistConvo(current.id, { mode: "video" });
      }

      const userMsg: UIMessage = { id: nextId(), role: "user", content: `生成分镜：${trimmed}` };
      const assistantMsg: UIMessage = { id: nextId(), role: "assistant", content: "", streaming: true };

      const title = current.messages.length === 0 ? trimmed.slice(0, 24) : current.title;
      patchConvo(current.id, {
        title,
        videoStatus: "loading",
        videoMessage: "正在规划叙事结构…",
        messages: [...current.messages, userMsg, assistantMsg],
      });
      persistConvo(current.id, { title, videoStatus: "loading" });
      set({ sending: true, artifactDismissed: false });

      const updateAssistant = (content: string, extra?: Partial<UIMessage>) => {
        patchMessages(current.id, (messages) =>
          messages.map((m) => (m.id === assistantMsg.id ? { ...m, content, ...extra } : m))
        );
      };

      const videoController = newAbort(180_000);
      const videoModel = safeModel(current.model, current.modelProvider);
      let sb: Storyboard | null = null;
      let error: string | null = null;
      let result: StreamResult | null = null;
      try {
        result = await streamSSE<
          | { type: "status"; message: string }
          | { type: "done"; result: Storyboard }
          | { type: "error"; message: string }
        >("/api/video/storyboard", {
          body: {
            topic: trimmed,
            model: videoModel.model,
            provider: videoModel.provider,
            overrides: getOverrides(),
            targetSec: opts?.targetSec,
            style: opts?.style,
          },
          signal: videoController.signal,
          onEvent: (evt) => {
            if (evt.type === "status") {
              patchConvo(current.id, { videoMessage: evt.message });
              updateAssistant(evt.message + "…");
            } else if (evt.type === "done") {
              sb = evt.result;
            } else if (evt.type === "error") {
              error = evt.message;
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
      } catch (err) {
        error = describeNetError(err) || "分镜生成失败";
      }

      if (sb) {
        const ready = sb as Storyboard;
        const note = `✅ 分镜《${ready.title}》已生成，共 ${ready.shots.length} 镜、总时长 ${formatDuration(totalDuration(ready))}。可在右侧画布编辑镜头、生成画面、导出脚本。`;
        patchConvo(current.id, { video: ready, videoStatus: "done", videoMessage: undefined });
        updateAssistant(note, { streaming: false });
        persistConvo(current.id, { video: ready, videoStatus: "done" });
        persistMessage(current.id, userMsg);
        persistMessage(current.id, { ...assistantMsg, content: note });
      } else {
        const { content, error: hasError } = result
          ? finalizeStreamText("", result, error)
          : { content: `⚠️ ${error ?? "分镜生成失败"}`, error: true };
        patchConvo(current.id, {
          videoStatus: hasError ? "error" : "idle",
          videoMessage: undefined,
        });
        updateAssistant(content, { streaming: false, error: hasError });
        if (hasError) persistConvo(current.id, { videoStatus: "error" });
        persistMessage(current.id, userMsg);
        persistMessage(current.id, { ...assistantMsg, content, error: hasError });
      }
      releaseAbort(videoController);
      releaseTask();
      set({ sending: false });
    },

    /** 研究报告一键转 PPT：在新的 slides 任务中基于报告内容生成 */
    reportToSlides: async () => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo?.report || get().sending) return;
      const report = convo.report;
      const context = [
        report.summary,
        ...report.sections.map((s) => `${s.heading}\n${s.body}`),
        `关键结论：${report.takeaways.join("；")}`,
      ].join("\n\n");

      const id = await get().newConversation("slides");
      await get().selectConversation(id);
      await get().generateSlides(report.topic, context);
    },

    setDoc: (doc) => {
      const { activeId } = get();
      if (!activeId) return;
      const next = { ...doc, updatedAt: Date.now() };
      patchConvo(activeId, { doc: next });
      if (docPersistTimer) clearTimeout(docPersistTimer);
      set({ docSaveState: "saving" });
      docPersistTimer = setTimeout(async () => {
        try {
          await api(`/api/conversations/${activeId}`, {
            method: "PATCH",
            body: JSON.stringify({ doc: next }),
          });
          set({ docSaveState: "saved" });
          // DOC5: 保存时顺带节流留版本快照（30 分钟窗口），编辑历史自动沉淀，
          // 用户无需手动存版本也能回滚到半小时前的形态
          const last = docVersionLastAt.get(activeId) ?? 0;
          const now = Date.now();
          if (now - last >= DOC_VERSION_INTERVAL_MS) {
            docVersionLastAt.set(activeId, now);
            void get().saveDocVersion();
          }
        } catch {
          // DOC2: 失败标红并保留最新内容在内存里，等重试或下次编辑覆盖
          set({ docSaveState: "error" });
        }
      }, 600);
    },

    /** DOC2: 保存失败后的显式重试：把当前 doc 再打一次 PATCH */
    retryDocSave: async () => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!activeId || !convo?.doc) return;
      set({ docSaveState: "saving" });
      try {
        await api(`/api/conversations/${activeId}`, {
          method: "PATCH",
          body: JSON.stringify({ doc: convo.doc }),
        });
        set({ docSaveState: "saved" });
      } catch {
        set({ docSaveState: "error" });
      }
    },

    reportToDoc: async () => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo?.report) return;
      const r = convo.report;
      const md = [
        `# ${r.topic}`,
        "",
        `> ${r.summary}`,
        "",
        ...r.sections.flatMap((s) => [`## ${s.heading}`, "", s.body, ""]),
        `## 关键结论`,
        "",
        ...r.takeaways.map((t) => `- ${t}`),
        "",
        `## 参考来源`,
        "",
        ...r.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`),
      ].join("\n");
      patchConvo(convo.id, { mode: "docs", doc: { title: r.topic, content: md, updatedAt: Date.now() } });
      persistConvo(convo.id, { mode: "docs", doc: { title: r.topic, content: md, updatedAt: Date.now() } });
      toast("已转为可编辑文档", "success");
    },

    /** RS4: 基于勾选的来源重写报告。不做新检索——直接把勾选来源喂给服务端综述段 */
    rewriteFromSources: async (sourceUrls) => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo?.report || get().sending) return;
      // 勾选与当前报告来源取交集：url 集合匹配（勾选态来自报告渲染，与来源同源）
      const wanted = new Set(sourceUrls);
      const picked = convo.report.sources.filter((s) => wanted.has(s.url));
      if (picked.length === 0) {
        toast("请先勾选至少一个来源", "info");
        return;
      }
      if (!acquireTask()) return;

      const assistantMsg: UIMessage = {
        id: nextId(),
        role: "assistant",
        content: `正在基于勾选的 ${picked.length} 个来源重写报告…`,
        streaming: true,
      };
      patchConvo(convo.id, {
        researchStatus: "loading",
        researchMessage: "正在基于勾选来源重写…",
        messages: [...convo.messages, assistantMsg],
      });
      set({ sending: true, artifactDismissed: false });

      const updateAssistant = (content: string, extra?: Partial<UIMessage>) => {
        patchMessages(convo.id, (messages) =>
          messages.map((m) => (m.id === assistantMsg.id ? { ...m, content, ...extra } : m))
        );
      };

      const controller = newAbort(180_000);
      const researchModel = safeModel(convo.model, convo.modelProvider);
      let report: ResearchReport | null = null;
      let error: string | null = null;
      let result: StreamResult | null = null;
      try {
        result = await streamSSE<
          { type: "status"; message: string } | { type: "done"; result: ResearchReport } | { type: "error"; message: string }
        >("/api/research", {
          method: "PUT",
          body: {
            topic: convo.report.topic,
            model: researchModel.model,
            overrides: getOverrides(),
            sources: picked,
          },
          signal: controller.signal,
          onEvent: (evt) => {
            if (evt.type === "status") {
              patchConvo(convo.id, { researchMessage: evt.message });
              updateAssistant(evt.message + "…");
            } else if (evt.type === "done") {
              report = evt.result;
            } else if (evt.type === "error") {
              error = evt.message;
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
      } catch (err) {
        error = describeNetError(err) || "重写失败";
      }

      if (report) {
        const ready = report as ResearchReport;
        const note = `✅ 已基于 ${picked.length} 个勾选来源重写《${ready.topic}》，共 ${ready.sections.length} 个小节。`;
        patchConvo(convo.id, { report: ready, researchStatus: "done", researchMessage: undefined });
        updateAssistant(note, { streaming: false });
        persistConvo(convo.id, { report: ready });
        persistMessage(convo.id, { ...assistantMsg, content: note });
      } else {
        const { content, error: hasError } = result
          ? finalizeStreamText("", result, error)
          : { content: `⚠️ ${error ?? "重写失败"}`, error: true };
        patchConvo(convo.id, { researchStatus: hasError ? "error" : "done", researchMessage: undefined });
        updateAssistant(content, { streaming: false, error: hasError });
        persistMessage(convo.id, { ...assistantMsg, content, error: hasError });
      }
      releaseAbort(controller);
      releaseTask();
      set({ sending: false });
    },

    /** RS7: 报告内联追问。选中段落 + 报告全文作上下文，答案追加到对话流 */
    askAboutReport: async (question, selection) => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      const q = question.trim();
      if (!convo?.report || !q || get().sending) return;
      if (!acquireTask()) return;

      const r = convo.report;
      const reportText = [
        `# ${r.topic}`,
        r.summary,
        ...r.sections.flatMap((s) => [`## ${s.heading}`, s.body]),
        `关键结论：${r.takeaways.join("；")}`,
      ].join("\n\n");
      const context = selection?.trim()
        ? `用户正在阅读报告中的这段内容：\n\n${selection.trim()}\n\n`
        : "";
      const userMsg: UIMessage = { id: nextId(), role: "user", content: `关于报告：${q}` };
      const assistantMsg: UIMessage = { id: nextId(), role: "assistant", content: "", streaming: true };
      patchConvo(convo.id, { messages: [...convo.messages, userMsg, assistantMsg] });
      set({ sending: true, artifactDismissed: false });

      const updateAssistant = (content: string, extra?: Partial<UIMessage>) => {
        patchMessages(convo.id, (messages) =>
          messages.map((m) => (m.id === assistantMsg.id ? { ...m, content, ...extra } : m))
        );
      };

      const controller = newAbort(180_000);
      const askModel = safeModel(convo.model, convo.modelProvider);
      let acc = "";
      let errored: string | null = null;
      let result: StreamResult | null = null;
      try {
        result = await streamSSE<{ type: string; delta?: string; message?: string }>("/api/chat", {
          body: {
            model: askModel.model,
            provider: askModel.provider,
            overrides: getOverrides(),
            messages: [
              { role: "system" as const, content: MODE_PROMPTS.research },
              {
                role: "user" as const,
                content: `${context}以下是研究报告全文：\n\n${reportText}\n\n请基于报告内容回答：${q}`,
              },
            ],
          },
          signal: controller.signal,
          onEvent: (evt) => {
            if (evt.type === "delta" && evt.delta) {
              acc += evt.delta;
              updateAssistant(acc);
            } else if (evt.type === "error") {
              errored = evt.message ?? "追问失败";
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
      } catch (err) {
        errored = describeNetError(err) || "追问失败";
      }

      const { content, error: hasError } = result
        ? finalizeStreamText(acc, result, errored)
        : { content: acc || `⚠️ ${errored ?? "追问失败"}`, error: Boolean(errored) };
      updateAssistant(content, { streaming: false, error: hasError });
      persistMessage(convo.id, userMsg);
      persistMessage(convo.id, { ...assistantMsg, content, error: hasError });
      releaseAbort(controller);
      releaseTask();
      set({ sending: false });
    },

    generateDocs: async (topic, seed) => {
      const p = (topic ?? "").trim();
      if ((!p && !seed) || get().sending) return;
      if (!acquireTask()) return;
      const { activeId } = get();
      const convoNow = get().conversations.find((c) => c.id === activeId);
      const { model, provider: modelProvider } = safeModel(
        convoNow?.model ?? get().model,
        convoNow?.modelProvider
      );
      let convo = convoNow;
      if (!convo) {
        const id = await get().newConversation("docs");
        convo = findConvo(id);
        if (!convo) {
          releaseTask();
          return;
        }
      }
      const current = convo;
      if (current.mode !== "docs") {
        patchConvo(current.id, { mode: "docs" });
        persistConvo(current.id, { mode: "docs" });
      }
      const title = (p || "文档").slice(0, 30);
      // 文档模式下也维护聊天历史，与其它模式行为一致：
      // 用户提问与 AI 生成内容都写入 messages 并持久化，刷新后提问可回溯。
      const userMsg: UIMessage = { id: nextId(), role: "user", content: p || title };
      const assistantMsg: UIMessage = { id: nextId(), role: "assistant", content: "", streaming: true };
      patchConvo(current.id, { title, messages: [...current.messages, userMsg, assistantMsg] });
      persistConvo(current.id, { title });
      set({ docBusy: true, sending: true, artifactDismissed: false });

      const updateAssistant = (content: string, extra?: Partial<UIMessage>) => {
        patchMessages(current.id, (messages) =>
          messages.map((m) => (m.id === assistantMsg.id ? { ...m, content, ...extra } : m))
        );
      };

      const ov = getOverrides();
      // 密钥可能只配在服务端 .env（localStorage 看不到），需问服务端真实配置状态，
      // 否则「env 配了密钥但文档仍出示例占位文」。
      const providerId = modelProvider;
      const serverStatus = await serverProviderStatus();
      const configured =
        providerId !== "demo" &&
        (Boolean(ov[providerId]?.apiKey) || Boolean(serverStatus[providerId]));
      if (!configured || model === "demo") {
        const sample = seed
          ? seed
          : `# ${title}\n\n> 这里是 AI 生成的示例文档（演示模型）。配置真实模型后会由 AI 撰写完整内容。\n\n## 一、背景\n\n围绕「${p}」的背景说明……\n\n## 二、核心内容\n\n- 要点一：……\n- 要点二：……\n- 要点三：……\n\n## 三、结论与建议\n\n……\n`;
        let acc = "";
        for (const ch of sample) {
          acc += ch;
          patchConvo(current.id, { doc: { title, content: acc, updatedAt: Date.now() } });
          if (acc.length % 6 === 0) await new Promise((r) => setTimeout(r, 8));
        }
        persistConvo(current.id, { doc: { title, content: sample, updatedAt: Date.now() } });
        const sampleMsg: UIMessage = { ...assistantMsg, content: sample, streaming: false };
        patchMessages(current.id, (messages) =>
          messages.map((m) => (m.id === assistantMsg.id ? sampleMsg : m))
        );
        persistMessage(current.id, userMsg);
        persistMessage(current.id, sampleMsg);
        releaseTask();
        set({ docBusy: false, sending: false });
        return;
      }

      const messages = [
        { role: "system" as const, content: MODE_PROMPTS.docs },
        ...(seed ? [{ role: "assistant" as const, content: seed }] : []),
        { role: "user" as const, content: p || "请撰写文档" },
      ];
      let acc = "";
      const controller = newAbort(180_000);
      let errored: string | null = null;
      let result: StreamResult | null = null;
      let netError: string | null = null;
      try {
        const render = () =>
          patchConvo(current.id, { doc: { title, content: acc, updatedAt: Date.now() } });
        result = await streamSSE<{ type: string; delta?: string; message?: string }>("/api/chat", {
          body: { model, messages, overrides: ov, provider: modelProvider },
          signal: controller.signal,
          onEvent: (evt) => {
            if (evt.type === "delta" && evt.delta) {
              acc += evt.delta;
              if (acc.length % 12 === 0) render();
            } else if (evt.type === "error") {
              errored = evt.message ?? "文档生成失败";
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
      } catch (err) {
        netError = describeNetError(err) || "文档生成失败";
      }

      // 已经写出内容就按成功收尾（中断/断流的提示由 finalizeStreamText 附在末尾），
      // 避免用户等了半篇文档最后只看到一行报错。
      const { content: finalText, error: hasError } = result
        ? finalizeStreamText(acc.trim(), result, errored)
        : { content: `⚠️ ${netError ?? "文档生成失败"}`, error: true };

      if (!hasError) {
        const finalDoc = { title, content: finalText, updatedAt: Date.now() };
        patchConvo(current.id, { doc: finalDoc });
        persistConvo(current.id, { doc: finalDoc });
      } else if (errored || netError) {
        toast(errored ?? netError ?? "文档生成失败", "error");
      }
      const doneMsg: UIMessage = {
        ...assistantMsg,
        content: finalText,
        streaming: false,
        error: hasError,
      };
      patchMessages(current.id, (msgs) =>
        msgs.map((m) => (m.id === assistantMsg.id ? doneMsg : m))
      );
      persistMessage(current.id, userMsg);
      persistMessage(current.id, doneMsg);
      releaseAbort(controller);
      releaseTask();
      set({ docBusy: false, sending: false });
    },

    aiDoc: async (op, selection) => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo?.doc || get().docBusy) return;
      const target = (selection ?? convo.doc.content).trim();
      if (!target) return;
      // aiDoc 会抢占 activeAbort，与生成类任务共用一把锁才不会互相掐断
      if (!acquireTask()) return;
      const ov = getOverrides();
      const { model, provider: providerId } = safeModel(
        convo.model ?? get().model,
        convo.modelProvider
      );
      if (!ov[providerId]?.apiKey && model === "demo") {
        toast("配置真实模型后可使用 AI 续写/润色", "info");
        releaseTask();
        return;
      }
      const OP_PROMPT: Record<string, string> = {
        continue: "请在下面文档的基础上继续往下写，延续风格，直接输出续写的 Markdown 内容，不要重复已有内容、不要解释：\n\n",
        polish: "请润色下面的 Markdown 文档，使语言更专业流畅、结构更清晰，保持原意，只输出完整修改后的 Markdown：\n\n",
        shorten: "请精简下面的 Markdown 文档，去除冗余、保留要点，只输出精简后的完整 Markdown：\n\n",
        expand: "请扩写下面的 Markdown 文档，补充细节、例子与论证，使内容更充实，只输出扩写后的完整 Markdown：\n\n",
        fix: "请检查并修正下面 Markdown 文档中的错别字、语病与格式问题，只输出修正后的完整 Markdown：\n\n",
      };
      set({ docBusy: true });
      const messages = [
        { role: "system" as const, content: MODE_PROMPTS.docs },
        { role: "user" as const, content: OP_PROMPT[op] + target },
      ];
      let acc = "";
      const controller = newAbort(180_000);
      const base = convo.doc.content;
      // DOC3: 选区改写时只替换选中片段，不动全文其余部分。
      // 选区在原文中可能有重复文本，indexOf 取首次出现即可满足「就地替换」体验。
      const selStart = selection ? base.indexOf(selection) : -1;
      const selEnd = selStart >= 0 && selection ? selStart + selection.length : -1;
      /** 流式与落库共用的内容拼装：全文操作直接取 acc；选区操作把 acc 嵌回原文空位 */
      const compose = (text: string): string => {
        if (selStart < 0 || op === "continue") return op === "continue" ? base + "\n\n" + text : text;
        return base.slice(0, selStart) + text + base.slice(selEnd);
      };
      let errored: string | null = null;
      let result: StreamResult | null = null;
      let netError: string | null = null;
      try {
        result = await streamSSE<{ type: string; delta?: string; message?: string }>("/api/chat", {
          body: { model, messages, overrides: ov, provider: providerId },
          signal: controller.signal,
          onEvent: (evt) => {
            if (evt.type === "delta" && evt.delta) {
              acc += evt.delta;
              const content = compose(acc);
              patchConvo(convo.id, { doc: { ...convo.doc!, content, updatedAt: Date.now() } });
            } else if (evt.type === "error") {
              errored = evt.message ?? "AI 处理失败";
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
      } catch (err) {
        netError = describeNetError(err) || "AI 处理失败";
      }

      const failed = errored ?? netError;
      if (failed) {
        // 改写类操作失败必须回滚到原文，否则文档会停在被截断的半成品上
        patchConvo(convo.id, { doc: { ...convo.doc, content: base, updatedAt: Date.now() } });
        toast(failed, "error");
      } else if (acc.trim()) {
        const finalContent = compose(acc.trim());
        const finalDoc = { ...convo.doc, content: finalContent, updatedAt: Date.now() };
        patchConvo(convo.id, { doc: finalDoc });
        persistConvo(convo.id, { doc: finalDoc });
        toast(result?.reason === "done" ? "已完成" : "已保留中断前的内容", "success");
      } else {
        patchConvo(convo.id, { doc: { ...convo.doc, content: base, updatedAt: Date.now() } });
        toast(result?.reason === "user-abort" ? "已停止" : "模型没有返回内容", "info");
      }
      releaseAbort(controller);
      releaseTask();
      set({ docBusy: false });
    },

    saveDocVersion: async () => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo?.doc) return;
      try {
        await api(`/api/conversations/${convo.id}/doc-versions`, {
          method: "POST",
          body: JSON.stringify({ doc: { title: convo.doc.title, content: convo.doc.content } }),
        });
      } catch {
        // 版本快照失败不阻断编辑（静默跳过），主内容仍走 conversations PATCH 落库
      }
    },

    listDocVersions: async () => {
      const { activeId } = get();
      if (!activeId) return [];
      try {
        const data = await api<{ versions?: Array<{ id: string; title: string; content: string; createdAt: number }> }>(
          `/api/conversations/${activeId}/doc-versions`
        );
        return data.versions ?? [];
      } catch {
        return [];
      }
    },

    restoreDocVersion: async (versionId) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!activeId || !convo) return;
      const versions = await get().listDocVersions();
      const v = versions.find((x) => x.id === versionId);
      if (!v) return;
      // 回滚前先把当前内容留一份快照（后悔药），再覆盖
      await get().saveDocVersion();
      const restored = { title: v.title, content: v.content, updatedAt: Date.now() };
      patchConvo(activeId, { doc: restored });
      persistConvo(activeId, { doc: restored });
      toast("已回滚到所选版本", "success");
    },

    insertToDoc: (snippet, cursor) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.doc) return;
      const content = convo.doc.content;
      // 光标越界钳制到 [0, content.length]；未传光标追加文末
      const at = cursor === undefined ? content.length : Math.max(0, Math.min(cursor, content.length));
      const before = content.slice(0, at);
      const after = content.slice(at);
      // 前后衔接：确保插入物与上下文之间有换行分隔（Markdown 语法块不能粘连）
      const glue = before && !before.endsWith("\n") ? "\n" : "";
      const next = before + glue + snippet + (after && !after.startsWith("\n") ? "\n" : "") + after;
      const nextDoc = { ...convo.doc, content: next, updatedAt: Date.now() };
      patchConvo(activeId!, { doc: nextDoc });
      if (docPersistTimer) clearTimeout(docPersistTimer);
      docPersistTimer = setTimeout(() => persistConvo(activeId!, { doc: nextDoc }), 600);
    },

    setDeckTheme: (theme) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deck) return;
      const deck = { ...convo.deck, theme };
      patchConvo(activeId!, { deck });
      persistConvo(activeId!, { deck });
    },

    patchSlide: (slideIndex, p) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deck) return;
      const slides = convo.deck.slides.map((sl, i) => (i === slideIndex ? { ...sl, ...p } : sl));
      const deck = { ...convo.deck, slides };
      patchConvo(activeId!, { deck });
      if (deckPersistTimer) clearTimeout(deckPersistTimer);
      deckPersistTimer = setTimeout(() => persistConvo(activeId!, { deck }), 600);
    },

    addSlide: () => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deck) return;
      const slides = [
        ...convo.deck.slides.slice(0, -1),
        { layout: "content" as const, title: "新页面", bullets: ["要点一", "要点二"] },
        convo.deck.slides[convo.deck.slides.length - 1],
      ];
      const deck = { ...convo.deck, slides };
      patchConvo(activeId!, { deck });
      persistConvo(activeId!, { deck });
      toast("已添加一页", "success");
    },

    duplicateSlide: (index) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deck) return;
      const copy = JSON.parse(JSON.stringify(convo.deck.slides[index]));
      const slides = [...convo.deck.slides];
      slides.splice(index + 1, 0, copy);
      const deck = { ...convo.deck, slides };
      patchConvo(activeId!, { deck });
      persistConvo(activeId!, { deck });
      toast("已复制该页", "success");
    },

    deleteSlide: (index) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deck || convo.deck.slides.length <= 1) {
        toast("至少保留一页", "error");
        return;
      }
      const slides = convo.deck.slides.filter((_, i) => i !== index);
      const deck = { ...convo.deck, slides };
      patchConvo(activeId!, { deck });
      persistConvo(activeId!, { deck });
      toast("已删除该页", "info");
    },

    /** PPT4：拖拽排序。splice 移动后立即落库（批量操作不防抖） */
    moveSlide: (from, to) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deck) return;
      const slides = [...convo.deck.slides];
      if (from < 0 || from >= slides.length || to < 0 || to > slides.length || from === to) return;
      const [moved] = slides.splice(from, 1);
      slides.splice(to > from ? to - 1 : to, 0, moved);
      const deck = { ...convo.deck, slides };
      patchConvo(activeId!, { deck });
      persistConvo(activeId!, { deck });
    },

    /** PPT1：大纲先行。产出可编辑大纲挂 deckOutline，用户确认后再走 confirmOutline 生成成稿 */
    generateSlidesOutline: async (topic, context) => {
      const trimmed = topic.trim();
      if (!trimmed || get().sending) return;
      if (!acquireTask()) return;
      let convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo) {
        const id = await get().newConversation("slides");
        convo = findConvo(id);
        if (!convo) {
          releaseTask();
          return;
        }
      }
      const current = convo;
      if (current.mode !== "slides") {
        patchConvo(current.id, { mode: "slides" });
        persistConvo(current.id, { mode: "slides" });
      }
      const title = current.messages.length === 0 ? trimmed.slice(0, 24) : current.title;
      patchConvo(current.id, {
        title,
        deckStatus: "loading",
        deckMessage: "正在规划大纲…",
      });
      persistConvo(current.id, { title });
      set({ sending: true, artifactDismissed: false });

      const { system, user } = buildOutlinePrompt(trimmed, context);
      const controller = newAbort(180_000);
      const { model, provider: providerId } = safeModel(current.model, current.modelProvider);
      const ov = getOverrides();
      const serverStatus = await serverProviderStatus();
      let raw = "";
      let errored: string | null = null;
      let result: StreamResult | null = null;
      try {
        result = await streamSSE<{ type: string; delta?: string; message?: string }>("/api/chat", {
          body: {
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            overrides: ov,
            provider: providerId,
          },
          signal: controller.signal,
          onEvent: (evt) => {
            if (evt.type === "delta" && evt.delta) {
              raw += evt.delta;
              patchConvo(current.id, { deckMessage: `正在规划大纲… ${raw.length} 字` });
            } else if (evt.type === "error") {
              errored = evt.message ?? "大纲生成失败";
            }
          },
          onRetry: (attempt) => toast(`连接失败，正在重试（第 ${attempt} 次）`, "info"),
        });
      } catch (err) {
        errored = describeNetError(err) || "大纲生成失败";
      }
      releaseAbort(controller);

      if (errored) {
        patchConvo(current.id, { deckStatus: "error", deckMessage: undefined });
        toast(errored, "error");
      } else {
        const outline = parseSlideOutline(raw);
        if (outline) {
          patchConvo(current.id, { deckStatus: "idle", deckMessage: undefined, deckOutline: outline });
          toast("大纲已生成，确认后生成成稿", "success");
        } else {
          // 大纲解析失败按生成失败处理（保持 deckStatus 一致语义）
          patchConvo(current.id, { deckStatus: "error", deckMessage: undefined });
          toast(result?.reason === "user-abort" ? "已停止" : "大纲解析失败，请重试", "info");
        }
      }
      releaseTask();
      set({ sending: false });
    },

    /** PPT1：大纲确认 → 成稿。把大纲转成上下文复用 generateSlides 全链路 */
    confirmOutline: async () => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo?.deckOutline || get().sending) return;
      const outline = convo.deckOutline;
      // 先清掉大纲暂态，避免成稿失败后界面还挂着旧大纲
      patchConvo(convo.id, { deckOutline: undefined });
      await get().generateSlides(outline.title, outlineToContext(outline));
    },

    patchOutlinePage: (index, p) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deckOutline) return;
      const pages = convo.deckOutline.pages.map((pg, i) => (i === index ? { ...pg, ...p } : pg));
      patchConvo(activeId!, { deckOutline: { ...convo.deckOutline, pages } });
    },

    addOutlinePage: (afterIndex) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deckOutline) return;
      const pages = [...convo.deckOutline.pages];
      pages.splice(afterIndex + 1, 0, { layout: "content", title: "新页面", hint: "" });
      patchConvo(activeId!, { deckOutline: { ...convo.deckOutline, pages } });
    },

    moveOutlinePage: (index, dir) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deckOutline) return;
      const target = index + dir;
      if (target < 0 || target >= convo.deckOutline.pages.length) return;
      const pages = [...convo.deckOutline.pages];
      [pages[index], pages[target]] = [pages[target], pages[index]];
      patchConvo(activeId!, { deckOutline: { ...convo.deckOutline, pages } });
    },

    deleteOutlinePage: (index) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.deckOutline || convo.deckOutline.pages.length <= 2) return;
      const pages = convo.deckOutline.pages.filter((_, i) => i !== index);
      patchConvo(activeId!, { deckOutline: { ...convo.deckOutline, pages } });
    },

    /** PPT2：单页 AI 重写。只替换目标页内容，其余页保持不动 */
    regenerateSlide: async (slideIndex) => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo?.deck || get().sending) return;
      const deck = convo.deck;
      const slide = deck.slides[slideIndex];
      if (!slide) return;
      if (!acquireTask()) return;
      const { model, provider: providerId } = safeModel(convo.model, convo.modelProvider);
      const ov = getOverrides();
      const serverStatus = await serverProviderStatus();
      const configured =
        providerId !== "demo" &&
        (Boolean(ov[providerId]?.apiKey) || Boolean(serverStatus[providerId]));
      if (!configured || model === "demo") {
        toast("配置真实模型后可重写单页", "info");
        releaseTask();
        return;
      }
      set({ sending: true });
      patchConvo(convo.id, { deckMessage: `正在重写第 ${slideIndex + 1} 页…` });
      const others = deck.slides
        .map((s, i) => `${i + 1}. [${s.layout}] ${s.title ?? ""}`)
        .filter((_, i) => i !== slideIndex)
        .join("\n");
      const promptUser = `我要重写演示文稿《${deck.title}》中的第 ${slideIndex + 1} 页。

该页当前内容：
${JSON.stringify(slide, null, 2)}

其余页面结构（保持整体连贯，不要改动其它页）：
${others}

请只输出这一页重写后的 JSON 对象（结构与当前相同的 Slide 格式，如 {"layout":"...","title":"..."}），不要输出解释、不要代码块。`;
      const controller = newAbort(180_000);
      let raw = "";
      let errored: string | null = null;
      let result: StreamResult | null = null;
      try {
        result = await streamSSE<{ type: string; delta?: string; message?: string }>("/api/chat", {
          body: {
            model,
            messages: [{ role: "user" as const, content: promptUser }],
            overrides: ov,
            provider: providerId,
          },
          signal: controller.signal,
          onEvent: (evt) => {
            if (evt.type === "delta" && evt.delta) raw += evt.delta;
            else if (evt.type === "error") errored = evt.message ?? "单页重写失败";
          },
        });
      } catch (err) {
        errored = describeNetError(err) || "单页重写失败";
      }
      releaseAbort(controller);
      if (!errored && raw.trim()) {
        const parsed = parseSingleSlide(raw);
        if (parsed) {
          const slides = deck.slides.map((s, i) => (i === slideIndex ? { ...s, ...parsed } : s));
          const next = fillCoverMeta({ ...deck, slides });
          patchConvo(convo.id, { deck: next, deckMessage: undefined });
          persistConvo(convo.id, { deck: next });
          toast(`第 ${slideIndex + 1} 页已重写`, "success");
        } else {
          patchConvo(convo.id, { deckMessage: undefined });
          toast("重写结果解析失败，已保留原页", "info");
        }
      } else if (errored) {
        patchConvo(convo.id, { deckMessage: undefined });
        toast(errored, "error");
      } else {
        patchConvo(convo.id, { deckMessage: undefined });
        toast(result?.reason === "user-abort" ? "已停止" : "模型没有返回内容", "info");
      }
      releaseTask();
      set({ sending: false });
    },

    /** PPT3：为单页生成配图。复用 /api/images 通道（生图模型选择与 generateShotImage 同规则） */
    generateSlideImage: async (slideIndex) => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo?.deck) return;
      const slide = convo.deck.slides[slideIndex];
      const prompt = slide?.imagePrompt?.trim();
      if (!prompt) {
        toast("该页没有配图提示词，先在页面上补充 imagePrompt", "info");
        return;
      }
      const ov = getOverrides();
      const serverStatus = await serverProviderStatus();
      const hasDashscope = Boolean(ov.dashscope?.apiKey) || serverStatus.dashscope === true;
      const hasOpenai = Boolean(ov.openai?.apiKey) || serverStatus.openai === true;
      let imageModel = "demo-image";
      if (hasDashscope && (convo.model ?? "").startsWith("qwen")) imageModel = "wan2.7-t2i-flash";
      else if (hasOpenai) imageModel = "dall-e-3";
      else if (hasDashscope) imageModel = "wan2.7-t2i-flash";

      patchConvo(convo.id, {
        deckMessage: `正在为第 ${slideIndex + 1} 页生成配图…`,
      });
      try {
        const res = await fetchWithTimeout("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: imageModel, prompt, size: "1024x1024", overrides: ov }),
          timeoutMs: 120_000,
        });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error ?? "配图生成失败");
        const now = get().conversations.find((c) => c.id === convo.id);
        if (!now?.deck) return; // 会话可能在生成中途被删（既有约定：静默跳过）
        const slides = now.deck.slides.map((s, i) => (i === slideIndex ? { ...s, imageUrl: data.url } : s));
        const next = { ...now.deck, slides };
        patchConvo(convo.id, { deck: next, deckMessage: undefined });
        persistConvo(convo.id, { deck: next });
        toast("配图已生成", "success");
      } catch (err) {
        patchConvo(convo.id, { deckMessage: undefined });
        toast(err instanceof Error ? err.message : "配图生成失败", "error");
      }
    },

    /** V4：单镜就地编辑。与 patchSlide 同一套防抖持久化（连续输入不抖库） */
    patchShot: (shotId, p) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.video) return;
      const shots = convo.video.shots.map((s) => (s.id === shotId ? { ...s, ...p } : s));
      const video = { ...convo.video, shots };
      patchConvo(activeId!, { video });
      if (videoPersistTimer) clearTimeout(videoPersistTimer);
      videoPersistTimer = setTimeout(() => persistConvo(activeId!, { video }), 600);
    },

    /** V4：镜头增删移动。批量操作立即落库（不防抖） */
    addShot: () => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.video) return;
      const shot: StoryboardShot = {
        id: nextId(),
        scene: "新场景",
        visual: "描述这镜的画面",
        durationSec: 3,
        transition: "cut",
      };
      const video = { ...convo.video, shots: [...convo.video.shots, shot] };
      patchConvo(activeId!, { video });
      persistConvo(activeId!, { video });
      toast("已添加镜头", "success");
    },

    duplicateShot: (shotId) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.video) return;
      const idx = convo.video.shots.findIndex((s) => s.id === shotId);
      if (idx < 0) return;
      // 深拷贝 + 换 id：直接复用对象会让两镜共享引用，改一个动两个
      const copy = JSON.parse(JSON.stringify(convo.video.shots[idx])) as StoryboardShot;
      copy.id = nextId();
      const shots = [...convo.video.shots];
      shots.splice(idx + 1, 0, copy);
      const video = { ...convo.video, shots };
      patchConvo(activeId!, { video });
      persistConvo(activeId!, { video });
      toast("已复制该镜", "success");
    },

    deleteShot: (shotId) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.video) return;
      if (convo.video.shots.length <= 1) {
        toast("至少保留一个镜头", "error");
        return;
      }
      const video = { ...convo.video, shots: convo.video.shots.filter((s) => s.id !== shotId) };
      patchConvo(activeId!, { video });
      persistConvo(activeId!, { video });
      toast("已删除该镜", "info");
    },

    /** V4：上下移动镜头（拖拽的键盘/按钮等价物；HTML5 DnD 在组件层做同款 reorder） */
    moveShot: (shotId, dir) => {
      const { activeId } = get();
      const convo = get().conversations.find((c) => c.id === activeId);
      if (!convo?.video) return;
      const idx = convo.video.shots.findIndex((s) => s.id === shotId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= convo.video.shots.length) return;
      const shots = [...convo.video.shots];
      [shots[idx], shots[target]] = [shots[target], shots[idx]];
      const video = { ...convo.video, shots };
      patchConvo(activeId!, { video });
      persistConvo(activeId!, { video });
    },

    /** V5：单镜生成参考图，复用 /api/images 通道（生图模型选择与 generateImage 同一套规则） */
    generateShotImage: async (shotId) => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      const shot = convo?.video?.shots.find((s) => s.id === shotId);
      if (!shot || !convo) return;
      const prompt = shot.imagePrompt?.trim() || shot.visual;
      const { patchShot } = get();
      patchShot(shotId, { imageUrl: "" }); // 清空旧图占位 loading
      try {
        // 与 generateImage 相同的模型选择：优先按当前对话模型选同家生图，再按可用密钥兜底
        const ov = getOverrides();
        const serverStatus = await serverProviderStatus();
        const hasDashscope = Boolean(ov.dashscope?.apiKey) || serverStatus.dashscope === true;
        const hasOpenai = Boolean(ov.openai?.apiKey) || serverStatus.openai === true;
        let imageModel = "demo-image";
        if (hasDashscope && convo.model.startsWith("qwen")) imageModel = "wan2.7-t2i-flash";
        else if (hasOpenai) imageModel = "dall-e-3";
        else if (hasDashscope) imageModel = "wan2.7-t2i-flash";

        const res = await fetchWithTimeout("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: imageModel,
            prompt: `${prompt}, ${convo.video?.style ?? ""}`.trim(),
            size: "1792x1024",
            overrides: ov,
          }),
          timeoutMs: 120_000,
        });
        if (!res.ok) throw new Error(`生成失败 ${res.status}`);
        const data = (await res.json()) as { url?: string };
        if (!data.url) throw new Error("未返回图片");
        patchShot(shotId, { imageUrl: data.url });
        toast("分镜画面已生成", "success");
      } catch (err) {
        patchShot(shotId, { imageUrl: undefined });
        toast(err instanceof Error ? err.message : "画面生成失败", "error");
      }
    },

    /** V6：单镜旁白转 TTS；音频挂 shot.audioUrl（仅会话内使用，不落库） */
    generateShotAudio: async (shotId) => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      const shot = convo?.video?.shots.find((s) => s.id === shotId);
      if (!shot) return;
      if (!shot.narration?.trim()) {
        toast("该镜头没有旁白", "info");
        return;
      }
      const { patchShot } = get();
      try {
        const res = await fetch("/api/video/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: shot.narration, overrides: getOverrides() }),
        });
        const data = (await res.json()) as { audioUrl?: string; error?: string };
        if (!res.ok || !data.audioUrl) throw new Error(data.error ?? `请求失败 ${res.status}`);
        patchShot(shotId, { audioUrl: data.audioUrl });
        toast("旁白音频已生成", "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "TTS 失败", "error");
      }
    },

    exportDeck: async () => {
      const convo = get().conversations.find((c) => c.id === get().activeId);
      if (!convo?.deck) return;
      let res: Response;
      try {
        // 大 deck 的 PPTX 生成可能要十几秒，给足 120s 再由 fetch 超时兜底（PPT14）
        res = await fetchWithTimeout("/api/slides/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deck: convo.deck }),
          timeoutMs: 120_000,
        });
      } catch (err) {
        // PPT14：网络层失败单独提示（区别于 HTTP 错误），用户可重试点导出
        toast(describeNetError(err) || "导出超时，请重试", "error");
        throw err;
      }
      if (!res.ok) {
        toast(`导出失败（HTTP ${res.status}），请重试`, "error");
        throw new Error("导出失败");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const safeName = (convo.deck.title || "slides").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      toast("PPTX 已导出", "success");
    },
  };
});

export { MODELS };
