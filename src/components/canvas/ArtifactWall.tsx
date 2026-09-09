"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Box,
  BookOpen,
  Clapperboard,
  FileText,
  Globe,
  Image as ImageIcon,
  LayoutTemplate,
  MessageSquare,
  Music,
  PenTool,
  Play,
  Plus,
  Presentation,
  Search,
  Video,
} from "lucide-react";
import { useChatStore, type Conversation } from "@/lib/store/chat";
import {
  CANVAS_CATEGORIES,
  GALLERY_PICKS,
  type CanvasCategory,
  type CanvasCase,
} from "@/lib/canvasCases";
import { cn } from "@/lib/utils";

/** 画布产物条目：来自各会话的 AI 产物（doc/deck/report/images/video） */
export interface ArtifactItem {
  key: string; // 会话id::产物类型（唯一）
  convoId: string;
  convoTitle: string;
  kind: ArtifactKind;
  title: string;
  updatedAt: number;
  /** 预览主图 / 首图（PPT/图片/视频）；文档/报告为 null 用样式占位 */
  thumb?: string;
  /** 概要一行（文档/报告摘要或图片/PPT描述） */
  blurb?: string;
}

export type ArtifactKind = "文档" | "PPT" | "图片" | "深度研究" | "视频分镜";

/** 从会话聚合产物（排除纯聊天无产物的会话与草稿/大纲暂态） */
function collectArtifacts(convos: Conversation[]): ArtifactItem[] {
  const out: ArtifactItem[] = [];
  for (const c of convos) {
    const base = {
      convoId: c.id,
      convoTitle: c.title || "未命名会话",
      updatedAt: c.updatedAt ?? c.createdAt ?? Date.now(),
    };
    if (c.doc?.title) {
      out.push({
        ...base,
        key: `${c.id}::doc`,
        kind: "文档",
        title: c.doc.title,
        updatedAt: c.doc.updatedAt ?? base.updatedAt,
        blurb: (c.doc.content ?? "").slice(0, 90).replace(/#+\s?/g, "").trim(),
      });
    }
    if (c.deck && (c.deck.slides?.length || c.deck.title)) {
      out.push({
        ...base,
        key: `${c.id}::deck`,
        kind: "PPT",
        title: c.deck.title || c.title || "演示文稿",
        thumb: c.deck.slides?.find((s) => s.imageUrl)?.imageUrl,
        blurb: c.deck.slides?.length ? `共 ${c.deck.slides.length} 页幻灯片` : undefined,
      });
    }
    for (const img of c.images ?? []) {
      out.push({
        ...base,
        key: `${c.id}::img::${img.id}`,
        kind: "图片",
        title: img.prompt.slice(0, 24) || "生成的图片",
        thumb: img.url,
        blurb: img.prompt,
      });
    }
    if (c.report?.topic) {
      out.push({
        ...base,
        key: `${c.id}::report`,
        kind: "深度研究",
        title: c.report.topic,
        updatedAt: c.report.createdAt ?? base.updatedAt,
        blurb:
          c.report.summary?.slice(0, 90) ||
          c.report.sections?.[0]?.body?.slice(0, 90).replace(/#+\s?/g, "").trim() ||
          `${c.report.sections?.length ?? 0} 节 · ${c.report.sources?.length ?? 0} 条来源`,
      });
    }
    if (c.video && (c.video.shots?.length || c.video.title)) {
      out.push({
        ...base,
        key: `${c.id}::video`,
        kind: "视频分镜",
        title: c.video.title || c.title || "视频分镜",
        thumb: c.video.shots?.find((s) => s.imageUrl)?.imageUrl,
        blurb: c.video.shots?.length
          ? `${c.video.shots.length} 个镜头 · 目标 ${Math.round((c.video.targetSec ?? 0) / 60)} 分钟`
          : c.video.style || undefined,
      });
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

const KIND_STYLE: Record<ArtifactKind, { badge: string }> = {
  文档: { badge: "bg-sky-50 text-sky-600" },
  PPT: { badge: "bg-violet-50 text-violet-600" },
  图片: { badge: "bg-amber-50 text-amber-600" },
  深度研究: { badge: "bg-emerald-50 text-emerald-600" },
  视频分镜: { badge: "bg-rose-50 text-rose-600" },
};

/** 栏目视觉：示例卡封面渐变 + 图标（与产物墙暖色体系搭配的柔和色带） */
const CATEGORY_COVER: Record<string, { grad: string; icon: typeof FileText }> = {
  docs: { grad: "from-sky-200/90 via-sky-100 to-white", icon: FileText },
  ppt: { grad: "from-violet-200/90 via-violet-100 to-white", icon: Presentation },
  prototype: { grad: "from-cyan-200/90 via-cyan-100 to-white", icon: PenTool },
  slides: { grad: "from-indigo-200/90 via-indigo-100 to-white", icon: Presentation },
  image: { grad: "from-amber-200/90 via-amber-100 to-white", icon: ImageIcon },
  hyperframes: { grad: "from-fuchsia-200/90 via-fuchsia-100 to-white", icon: Clapperboard },
  website: { grad: "from-emerald-200/90 via-emerald-100 to-white", icon: Globe },
  video: { grad: "from-rose-200/90 via-rose-100 to-white", icon: Video },
  audio: { grad: "from-orange-200/90 via-orange-100 to-white", icon: Music },
  realtime: { grad: "from-teal-200/90 via-teal-100 to-white", icon: Activity },
  webgl: { grad: "from-blue-200/90 via-blue-100 to-white", icon: Box },
  research: { grad: "from-lime-200/90 via-lime-100 to-white", icon: BookOpen },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

function Cover({ item }: { item: ArtifactItem }) {
  if (item.kind === "图片" || item.kind === "PPT" || item.kind === "视频分镜") {
    if (item.thumb) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={item.thumb} alt={item.title} className="h-full w-full object-cover" />;
    }
  }
  // 文档/报告/无图产物：纸质占位
  return (
    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-stone-50 to-stone-100 p-3">
      <span className="block h-2 w-10 rounded-full bg-stone-300/70" />
      <span className="block space-y-1.5">
        <span className="block h-1.5 w-full rounded bg-stone-300/50" />
        <span className="block h-1.5 w-4/5 rounded bg-stone-300/40" />
        <span className="block h-1.5 w-3/5 rounded bg-stone-300/30" />
      </span>
      <span className="block text-[10px] font-medium text-stone-400">{item.kind}</span>
    </div>
  );
}

/** 示例作品卡：栏目案例 = 一键创作入口（点击按栏目模式开新会话并预填提示词） */
function CaseCard({
  category,
  card,
  onStart,
}: {
  category: CanvasCategory;
  card: CanvasCase;
  onStart: (category: CanvasCategory, card: CanvasCase) => void;
}) {
  const cover =
    CATEGORY_COVER[category.key] ?? { grad: "from-stone-200/90 via-stone-100 to-white", icon: LayoutTemplate };
  const CoverIcon = cover.icon;
  return (
    <button
      onClick={() => onStart(category, card)}
      className="group overflow-hidden rounded-2xl border border-stone-200/90 bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_14px_30px_-18px_rgba(76,29,149,0.35)]"
    >
      <span
        className={cn(
          "relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden bg-gradient-to-br",
          cover.grad
        )}
      >
        <CoverIcon className="h-8 w-8 text-stone-500/50 transition group-hover:scale-110" strokeWidth={1.6} />
        <span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
          {category.label}
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-stone-900/70 px-1.5 py-0.5 text-[9px] font-medium text-white">
          示例
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-stone-900/0 opacity-0 transition group-hover:bg-stone-900/15 group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-stone-700">
            <Plus className="h-3 w-3" />
            以此创作
          </span>
        </span>
      </span>
      <span className="block px-3 pb-3 pt-2">
        <span className="block truncate text-[13px] font-semibold text-stone-800">{card.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-stone-400">{card.desc}</span>
      </span>
    </button>
  );
}

export function ArtifactWall() {
  const router = useRouter();
  const conversations = useChatStore((s) => s.conversations);
  const [filterKey, setFilterKey] = useState("all");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ArtifactItem | null>(null);
  /** 相对时间依赖 Date.now()：挂载后再显示，避免 SSR/水合文本不一致 */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ago = (ts: number) => (mounted ? timeAgo(ts) : "");

  const activeCategory = CANVAS_CATEGORIES.find((c) => c.key === filterKey);

  const items = useMemo(() => collectArtifacts(conversations), [conversations]);
  /** 当前栏目对应的真实产物（幻灯片栏目与 PPT 同看演示文稿产物） */
  const kindItems = useMemo(() => {
    if (!activeCategory?.kind) return [] as ArtifactItem[];
    return items.filter((i) => i.kind === activeCategory.kind);
  }, [items, activeCategory]);
  const visible = useMemo(() => {
    let list = filterKey === "all" ? items : kindItems;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => (i.title + i.convoTitle).toLowerCase().includes(q));
    return list;
  }, [items, kindItems, filterKey, query]);

  /** 示例卡 → 按栏目模式新建会话并预填提示词；新形态栏目走 AI 对话先出方案 */
  const startCase = async (category: CanvasCategory, card: CanvasCase) => {
    await useChatStore.getState().fillTemplate({
      mode: category.mode ?? "chat",
      prompt: card.prompt,
    });
    router.push("/chat");
  };

  const openConvo = (convoId: string) => router.push(`/chat?c=${convoId}`);

  const hasArtifacts = items.length > 0;
  /** 栏目为空（无真实产物）时展示案例；有产物展示产物墙 */
  const showCases = filterKey !== "all" && kindItems.length === 0;
  const showGallery = filterKey === "all" && !hasArtifacts;

  const renderWall = (list: ArtifactItem[]) => (
    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((item) => {
        const st = KIND_STYLE[item.kind];
        return (
          <button
            key={item.key}
            onClick={() => setPreview(item)}
            className="group overflow-hidden rounded-2xl border border-stone-200/90 bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_14px_30px_-18px_rgba(76,29,149,0.35)]"
          >
            <span className="relative block aspect-[16/10] w-full overflow-hidden bg-stone-100">
              <Cover item={item} />
              <span
                className={cn(
                  "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  st.badge
                )}
              >
                {item.kind}
              </span>
              <span className="absolute inset-0 flex items-center justify-center bg-stone-900/0 text-white opacity-0 transition group-hover:bg-stone-900/20 group-hover:opacity-100">
                <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-stone-700">
                  继续编辑
                </span>
              </span>
            </span>
            <span className="block px-3 pb-3 pt-2">
              <span className="block truncate text-[13px] font-semibold text-stone-800">{item.title}</span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-stone-400">{item.convoTitle}</span>
                <span className="shrink-0 text-[11px] text-stone-400">{ago(item.updatedAt)}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderCases = (
    entries: { category: CanvasCategory; card: CanvasCase }[],
    title: string,
    subtitle: string
  ) => (
    <section className="mt-5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500">{title}</h2>
        <span className="truncate text-xs text-stone-400">{subtitle}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map(({ category, card }) => (
          <CaseCard key={category.key + ":" + card.title} category={category} card={card} onStart={startCase} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      {/* 页头：大标题 + 新建按钮 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">我的画布</h1>
          <p className="mt-1 text-sm text-stone-500">
            所有 AI 生成的产物都在这里 · 打开可继续编辑
          </p>
        </div>
        <button
          onClick={() => router.push("/chat")}
          className="flex h-10 items-center gap-2 rounded-full bg-violet-600 px-4 text-sm font-medium text-white shadow-sm shadow-violet-200 transition hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          新建创作
        </button>
      </div>

      {/* 分类 tab：全部栏目平级（无 soon）+ 搜索 */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {["all", ...CANVAS_CATEGORIES.map((c) => c.key)].map((key) => {
            const label =
              key === "all" ? "全部" : (CANVAS_CATEGORIES.find((c) => c.key === key)?.label ?? key);
            const isActive = filterKey === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setFilterKey(key);
                  setPreview(null);
                }}
                aria-pressed={isActive}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
                  isActive ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <label className="flex h-9 w-64 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-stone-400 transition focus-within:border-violet-300">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索产物…"
            className="w-full bg-transparent text-[13px] text-stone-700 outline-none placeholder:text-stone-400"
          />
        </label>
      </div>

      {/* 全部有产物 / 栏目有产物 → 产物墙 */}
      {((filterKey === "all" && visible.length > 0) || (showCases === false && visible.length > 0)) &&
        renderWall(visible)}

      {/* 全部为空：空态引导 */}
      {showGallery && (
        <div className="mt-16 flex flex-col items-center rounded-3xl border border-dashed border-stone-200 bg-white/60 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
            <LayoutTemplate className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-stone-800">你的画布还是空的</h2>
          <p className="mt-1 max-w-sm text-sm text-stone-500">
            去 AI 对话里生成一份文档、PPT、图片、视频分镜或深度研究报告，它会自动出现在这里
          </p>
          <button
            onClick={() => router.push("/chat")}
            className="mt-5 flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            <MessageSquare className="h-4 w-4" />
            去生成第一个产物
          </button>
        </div>
      )}

      {/* 全部为空：跨栏目案例速览（点卡片即开始创作） */}
      {showGallery &&
        renderCases(
          GALLERY_PICKS,
          "各栏目案例速览",
          "示例灵感 · 点击卡片在 AI 对话里开始创作，产物会自动回到画布"
        )}

      {/* 选中栏目无真实产物：该栏目案例 */}
      {showCases &&
        renderCases(
          activeCategory?.cases.map((card) => ({ category: activeCategory, card })) ?? [],
          `「${activeCategory?.label}」案例`,
          "栏目示例 · 点击卡片在 AI 对话里开始创作"
        )}

      {/* 产物预览抽屉：目前回跳会话编辑；图片产物支持在新窗打开原图 */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-6"
          onClick={() => setPreview(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-stone-800">{preview.title}</p>
                <p className="text-xs text-stone-400">
                  {preview.convoTitle} · {preview.kind} · {ago(preview.updatedAt)}
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                aria-label="关闭预览"
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-5">
              {preview.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.thumb} alt={preview.title} className="mx-auto max-h-72 rounded-xl object-contain" />
              ) : (
                <p className="whitespace-pre-wrap rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                  {preview.blurb || "该产物暂无预览文本，打开原会话查看。"}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-5 py-3">
              {preview.kind === "图片" && preview.thumb && (
                <a
                  href={preview.thumb}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                >
                  <ImageIcon className="h-3.5 w-3.5" /> 查看原图
                </a>
              )}
              <button
                onClick={() => {
                  setPreview(null);
                  openConvo(preview.convoId);
                }}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
              >
                {preview.kind === "视频分镜" ? <Play className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                在会话中打开
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
