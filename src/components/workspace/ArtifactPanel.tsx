"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckSquare,
  Download,
  FileText as FileTextIcon,
  Image as ImageIcon,
  ImagePlus,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Maximize2,
  Presentation,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useChatStore, type UIImage } from "@/lib/store/chat";
import { STAGE_LABELS, type ResearchStage } from "@/lib/research/types";
import { downloadImageName } from "@/lib/image/mime";
import { SlideDeckView } from "./SlideDeckView";
import { OutlineEditor } from "./OutlineEditor";
import { ReportView } from "./ReportView";
import { DocView } from "./DocView";
import { DocEmpty } from "./DocEmpty";
import { StoryboardView } from "./StoryboardView";
import { StoryboardEmpty } from "./StoryboardEmpty";

function ImageGallery({ images, sending }: { images: UIImage[]; sending: boolean }) {
  // IMG8/IMG11 的动作都挂在 store 上，画廊只管编排交互
  const { deleteImages, clearImages, insertImageToDoc, applyImageToSlide } = useChatStore();
  // IMG7: 网格（默认，一次看多张）/ 大图（逐张细看）两种视图
  const [view, setView] = useState<"grid" | "single">("grid");
  const [zoom, setZoom] = useState<UIImage | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const downloadRef = useRef<HTMLAnchorElement>(null);

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = images.length > 0 && images.every((i) => selected.has(i.id));

  const deleteSelected = () => {
    if (selected.size === 0) return;
    deleteImages([...selected]);
    setSelected(new Set());
  };

  const download = (img: UIImage) => {
    const a = downloadRef.current ?? document.createElement("a");
    a.href = img.url;
    a.target = "_blank";
    a.rel = "noopener";
    // IMG9: 扩展名按真实 MIME 推断 —— SVG data URI 存 .svg、外链 .jpg 不再错存成 .png
    a.download = downloadImageName(img.prompt, img.url);
    // data URI 与同源路径（大图转存后的 /api/files/...）都能被 download 属性直接保存，
    // 只有跨域图床必须另开标签页 —— 浏览器会忽略跨域资源的 download。
    if (img.url.startsWith("data:") || img.url.startsWith("/")) a.click();
    else window.open(img.url, "_blank", "noopener");
  };

  const iconBtn =
    "rounded-lg border border-stone-200 bg-white/90 p-1.5 text-stone-500 shadow-sm transition hover:border-brand-300 hover:text-brand-600";

  return (
    <>
      {/* 工具条：张数 / 视图切换 / 批量管理 / 清空 */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-100 px-4 py-2">
        <span className="text-xs text-stone-500">{images.length} 张</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView(view === "grid" ? "single" : "grid")}
            title={view === "grid" ? "切换到大图视图" : "切换到网格视图"}
            className={iconBtn}
          >
            {view === "grid" ? <Maximize2 className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => {
              setSelecting((v) => !v);
              setSelected(new Set());
            }}
            title={selecting ? "退出批量管理" : "批量管理"}
            className={`${iconBtn} ${selecting ? "border-brand-400 !text-brand-600" : ""}`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              clearImages();
              setSelected(new Set());
              setSelecting(false);
            }}
            title="清空画廊"
            className={iconBtn}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 批量管理条：全选 / 删除所选 */}
      {selecting && (
        <div className="flex shrink-0 items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-1.5 text-xs text-stone-500">
          <span>已选 {selected.size} 张</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(allSelected ? new Set() : new Set(images.map((i) => i.id)))}
              className="text-stone-500 underline-offset-2 transition hover:text-brand-600 hover:underline"
            >
              {allSelected ? "取消全选" : "全选"}
            </button>
            <button
              onClick={deleteSelected}
              disabled={selected.size === 0}
              className="text-red-500 underline-offset-2 transition hover:underline disabled:text-stone-300 disabled:no-underline"
            >
              删除所选
            </button>
          </div>
        </div>
      )}

      <div
        className={
          view === "grid"
            ? "grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2"
            : "flex-1 space-y-4 overflow-y-auto p-4"
        }
      >
        {/* IMG10: 生成中的骨架占位，避免整屏只有右上角一个转圈 */}
        {sending &&
          [0, 1].map((i) => (
            <div
              key={`skeleton-${i}`}
              className={`animate-pulse rounded-xl border border-stone-100 bg-stone-100 ${view === "grid" ? "h-40" : "h-56"}`}
            />
          ))}
        {[...images].reverse().map((img) => {
          const checked = selected.has(img.id);
          return (
            <figure
              key={img.id}
              className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
            >
              <button
                onClick={() => (selecting ? toggleSel(img.id) : setZoom(img))}
                className="block w-full"
                title={selecting ? (checked ? "取消选中" : "选中") : "点击放大"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.prompt}
                  className={view === "grid" ? "h-40 w-full object-cover" : "w-full"}
                />
              </button>
              {selecting && (
                <span
                  className={`pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border ${
                    checked ? "border-brand-500 bg-brand-500 text-white" : "border-stone-300 bg-white/80"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
              )}
              {/* 悬停操作：下载 / 插入文档 / 设为 PPT 配图 / 删除（批量模式下隐藏，避免误触） */}
              {!selecting && (
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => download(img)} title="下载/打开" className={iconBtn}>
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => void insertImageToDoc(img.url, img.prompt)}
                    title="插入文档"
                    className={iconBtn}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => applyImageToSlide(img.url)} title="设为 PPT 配图" className={iconBtn}>
                    <Presentation className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteImages([img.id])}
                    title="删除这张"
                    className="rounded-lg border border-stone-200 bg-white/90 p-1.5 text-stone-500 shadow-sm transition hover:border-red-300 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {view === "single" && (
                <figcaption className="px-3 py-2">
                  <p className="truncate text-xs text-stone-600">{img.prompt}</p>
                  <p className="mt-0.5 text-[10px] text-stone-400">{img.model}</p>
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-8"
          onClick={() => setZoom(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.url}
            alt={zoom.prompt}
            className="max-h-[85vh] max-w-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="max-w-md truncate text-xs text-white/70">{zoom.prompt}</p>
            <button onClick={() => download(zoom)} className={iconBtn} title="下载/打开">
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 产物画布（Artifact Panel）—— OpenCanvas 式右侧栏。
 * - PPT 模式：完整幻灯片工作台（主题/编辑/导出）
 * - 其他模式：最近一条 AI 回复作为"文档"产物
 * 后续阶段：图片、视频、代码预览挂载在这里。
 * 
 * 默认关闭，有产物时自动弹出。
 */
export function ArtifactPanel({
  conversationId,
  onClose,
}: {
  conversationId?: string;
  /** 外部控制显隐时传入（例如首页用本地状态控制抽屉） */
  onClose?: () => void;
} = {}) {
  const { conversations, activeId, sending, artifactOpen, artifactDismissed, setArtifactOpen } =
    useChatStore();
  // conversationId：外部指定要看的会话（首页等场景）；不传则跟随当前会话
  const convo = conversations.find((c) => c.id === (conversationId ?? activeId));
  const mode = convo?.mode ?? "chat";

  const lastAssistant = [...(convo?.messages ?? [])]
    .reverse()
    .find((m) => m.role === "assistant" && m.content && !m.error);

  // 检测是否有产物内容
  const hasArtifact =
    (mode === "image" && (convo?.images?.length ?? 0) > 0) ||
    (mode === "research" && convo?.report) ||
    (mode === "docs" && convo?.doc) ||
    (mode === "slides" && (convo?.deck || convo?.deckOutline)) ||
    (mode === "video" && convo?.video) ||
    (mode === "chat" && lastAssistant);

  // 有产物时自动弹出（但用户手动收起后不再强行弹出，直到下一次生成/切换会话）
  useEffect(() => {
    if (hasArtifact && !artifactOpen && !artifactDismissed) {
      setArtifactOpen(true);
    }
  }, [hasArtifact, artifactOpen, artifactDismissed, setArtifactOpen]);

  // 隐藏状态或无产物内容时不渲染
  if (!artifactOpen) {
    return null;
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full shrink-0 flex-col border-l border-stone-200 bg-white shadow-2xl sm:static sm:w-[26rem] sm:shadow-none lg:w-[30rem]">
      {/* 画布标题栏 */}
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-stone-800">
          <LayoutDashboard className="h-4 w-4 text-orange-500" />
          AI 创作画布
        </h2>
        <button
          onClick={() => (onClose ? onClose() : setArtifactOpen(false))}
          title="关闭画布"
          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 图像画廊：sending 时进入画廊分支而不是整屏转圈 —— 骨架屏占位（IMG10） */}
      {mode === "image" && (convo?.images?.length ?? 0) > 0 ? (
        <ImageGallery images={convo!.images!} sending={sending} />
      ) : mode === "image" && sending ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-stone-400">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm">正在生成图像…</p>
        </div>
      ) : mode === "image" ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center text-stone-400">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
            <ImageIcon className="h-6 w-6" />
          </div>
          <p className="text-sm">在左侧描述你想要的画面<br />生成的图片会展示在这里</p>
        </div>
      ) : /* 深度研究报告 */
      mode === "research" && convo?.report ? (
        <ReportView report={convo.report} />
      ) : mode === "research" && convo?.researchStatus === "loading" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-stone-400">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm">{convo.researchMessage ?? "正在研究…"}</p>
          {/* RS1: 分步时间线。researchStages 记录已完成阶段，未到的按序置灰 */}
          <ol className="w-full max-w-56 space-y-2 text-left">
            {(Object.keys(STAGE_LABELS) as ResearchStage[]).map((stage, i, arr) => {
              const done = convo.researchStages?.[stage];
              // 已完成的打勾；第一个未完成的是「进行中」（转圈）；更靠后的保持灰
              const active = !done && !arr.slice(0, i).some((s) => !convo.researchStages?.[s]);
              return (
                <li key={stage} className="flex items-center gap-2 text-xs">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      done
                        ? "border-brand-500 bg-brand-500 text-white"
                        : active
                          ? "border-brand-400 text-brand-500"
                          : "border-stone-200 text-stone-300"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                  </span>
                  <span className={done || active ? "text-stone-600" : "text-stone-300"}>{STAGE_LABELS[stage]}</span>
                </li>
              );
            })}
          </ol>
          <p className="text-xs">深度研究通常需要 20~60 秒</p>
        </div>
      ) : mode === "research" ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center text-stone-400">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
            <Search className="h-6 w-6" />
          </div>
          <p className="text-sm">在左侧输入研究主题<br />生成带引用的研究报告，可一键转 PPT</p>
        </div>
      ) : /* 文档工作台 */
      mode === "docs" && convo?.doc ? (
        <DocView doc={convo.doc} />
      ) : mode === "docs" && sending ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-stone-400">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm">AI 正在撰写文档…</p>
        </div>
      ) : mode === "docs" ? (
        <DocEmpty />
      ) : /* PPT 工作台 */
      mode === "slides" && convo?.deckOutline ? (
        <OutlineEditor outline={convo.deckOutline} />
      ) : mode === "slides" && convo?.deck ? (
        <SlideDeckView deck={convo.deck} />
      ) : mode === "slides" && convo?.deckStatus === "loading" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-stone-400">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm">{convo.deckMessage ?? "正在生成…"}</p>
          <p className="text-xs">PPT 生成通常需要 10~30 秒</p>
        </div>
      ) : mode === "slides" ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center text-stone-400">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <p className="text-sm">在左侧输入 PPT 主题<br />例如「AI 写作助手产品发布会」</p>
        </div>
      ) : /* 分镜工作台（V4） */
      mode === "video" && convo?.video ? (
        <StoryboardView storyboard={convo.video} />
      ) : mode === "video" && convo?.videoStatus === "loading" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-stone-400">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm">{convo.videoMessage ?? "正在编排分镜…"}</p>
          <p className="text-xs">分镜生成通常需要 10~30 秒</p>
        </div>
      ) : mode === "video" ? (
        <StoryboardEmpty />
      ) : lastAssistant ? (
        <div className="flex-1 overflow-y-auto p-5">
          <article className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-stone-400">
              <FileTextIcon className="h-3.5 w-3.5" />
              文档 · v1
            </div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
              {lastAssistant.content}
              {lastAssistant.streaming && <span className="streaming-cursor" />}
            </div>
          </article>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center text-stone-400">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <p className="text-sm">
            AI 生成的文档、PPT、图片、视频
            <br />
            会实时呈现在这里
          </p>
        </div>
      )}
    </aside>
  );
}
