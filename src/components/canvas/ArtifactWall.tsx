"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  MessageSquare,
  Play,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useChatStore, type Conversation } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
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

/**
 * 分类与首页技能体系（ChatPanel HOME_SKILLS）保持一致：
 * 已具备的技能按产物类型过滤；planned 技能（原型/HyperFrames/网站复刻/
 * 音频/实时产物/WebGL）暂无产物，点击提示「建设中 · 即将支持」。
 * 注：PPT 与 幻灯片 两种技能产出的都是演示文稿（deck），归同一产物类型。
 */
interface FilterDef {
  key: string;
  label: string;
  /** 对应产物类型；缺省=全部/建设中 */
  kind?: ArtifactKind;
  /** 建设中技能（soon）：不假装有产物，仅提示即将支持 */
  planned?: boolean;
}

const FILTERS: FilterDef[] = [
  { key: "all", label: "全部" },
  { key: "docs", label: "文档", kind: "文档" },
  { key: "ppt", label: "PPT", kind: "PPT" },
  { key: "prototype", label: "原型", planned: true },
  { key: "slides", label: "幻灯片", kind: "PPT" },
  { key: "image", label: "图片", kind: "图片" },
  { key: "hyperframes", label: "HyperFrames", planned: true },
  { key: "website", label: "网站复刻", planned: true },
  { key: "video", label: "视频", kind: "视频分镜" },
  { key: "audio", label: "音频", planned: true },
  { key: "realtime", label: "实时产物", planned: true },
  { key: "webgl", label: "WebGL", planned: true },
  { key: "research", label: "深度研究", kind: "深度研究" },
];

const KIND_STYLE: Record<ArtifactKind, { badge: string }> = {
  文档: { badge: "bg-sky-50 text-sky-600" },
  PPT: { badge: "bg-violet-50 text-violet-600" },
  图片: { badge: "bg-amber-50 text-amber-600" },
  深度研究: { badge: "bg-emerald-50 text-emerald-600" },
  视频分镜: { badge: "bg-rose-50 text-rose-600" },
};

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

  const activeFilter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  const items = useMemo(() => collectArtifacts(conversations), [conversations]);
  const visible = useMemo(() => {
    let list = items;
    if (activeFilter.kind) list = list.filter((i) => i.kind === activeFilter.kind);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => (i.title + i.convoTitle).toLowerCase().includes(q));
    return list;
  }, [items, activeFilter, query]);

  const pickFilter = (f: FilterDef) => {
    if (f.planned) {
      toast(`「${f.label}」正在建设中，即将支持 —— 先试试文档 / PPT / 图片 / 视频 / 深度研究`, "info");
    }
    setFilterKey(f.key);
    setPreview(null);
  };

  const openConvo = (convoId: string) => router.push(`/chat?c=${convoId}`);

  const hasArtifacts = items.length > 0;

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

      {/* 分类 tab（与首页技能体系一致，建设中技能带 soon）+ 搜索 */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const isActive = filterKey === f.key;
            return (
              <button
                key={f.key}
                onClick={() => pickFilter(f)}
                aria-pressed={isActive}
                title={f.planned ? `${f.label}（建设中）` : f.label}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
                  isActive
                    ? "bg-stone-900 text-white"
                    : f.planned
                      ? "border border-dashed border-stone-300 text-stone-400 hover:border-stone-400 hover:text-stone-500"
                      : "text-stone-600 hover:bg-stone-100"
                )}
              >
                {f.label}
                {f.planned && (
                  <span
                    className={cn(
                      "rounded-full bg-stone-200/80 px-1 text-[9px] leading-4 text-stone-500",
                      isActive && "bg-white/25 text-white"
                    )}
                  >
                    soon
                  </span>
                )}
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

      {/* 建设中分类提示（planned 技能尚无产物） */}
      {activeFilter.planned ? (
        <div className="mt-16 flex flex-col items-center rounded-3xl border border-dashed border-stone-200 bg-white/60 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <Sparkles className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-stone-800">「{activeFilter.label}」正在建设中</h2>
          <p className="mt-1 max-w-sm text-sm text-stone-500">
            即将支持该能力。现在可以先试试文档、PPT、图片、视频或深度研究，产物会自动出现在这里
          </p>
          <button
            onClick={() => router.push("/chat")}
            className="mt-5 flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            <MessageSquare className="h-4 w-4" />
            去 AI 对话试试
          </button>
        </div>
      ) : !hasArtifacts ? (
        <div className="mt-16 flex flex-col items-center rounded-3xl border border-dashed border-stone-200 bg-white/60 px-6 py-14 text-center">
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
      ) : visible.length === 0 ? (
        <div className="mt-16 text-center text-sm text-stone-400">
          没有符合筛选的产物，换个分类或清空搜索试试
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => {
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
