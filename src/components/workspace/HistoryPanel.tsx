"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  GripVertical,
  Image as ImageIcon,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useChatStore, MODE_LABELS, type Conversation, type WorkspaceMode } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";
import { DAY_BUCKET_LABELS, dayBucketOf } from "@/lib/format";
import { readJSON, writeJSON } from "@/lib/safe-storage";
import { EmptyState } from "@/components/EmptyState";
import { PromptDialog } from "@/components/PromptDialog";

/** UX1: 历史侧栏收起态的持久化键 */
const RAIL_KEY = "opencanvas.history.rail";

const MODE_ICONS: Record<WorkspaceMode, typeof MessageSquare> = {
  chat: MessageSquare,
  docs: FileText,
  slides: Presentation,
  image: ImageIcon,
  video: Video,
  research: BarChart3,
};

/** 全文搜索命中（DB10）：高亮片段里的 [[ ]] 由渲染时转成 mark */
interface SearchHit {
  messageId: string;
  conversationId: string;
  snippet: string;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

/** [[关键词]] → <mark>，其余按普通文本渲染；高亮来自服务端 FTS snippet */
function HighlightedSnippet({ snippet }: { snippet: string }) {
  const parts = useMemo(() => snippet.split(/(\[\[.*?\]\])/g), [snippet]);
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith("[[") && p.endsWith("]]") ? (
          <mark key={i} className="rounded bg-orange-100 px-0.5 text-orange-700">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

/** 会话历史面板：滚动分页 + 全文搜索 + 文件夹分组（DB3/DB10/DB14） */
export function HistoryPanel({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const router = useRouter();
  const {
    conversations,
    activeId,
    selectConversation,
    newConversation,
    toggleArchive,
    loadMoreConversations,
    reorderConversations,
    convoCursor,
    loadingMore,
  } = useChatStore();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);
  // UX3: 拖拽源行 id；drop 时按目标位置全量重编号
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // UX1: 整个历史侧栏的收起态（收起后仅留 48px 悬停展开）；刷新后保留选择
  const [railMode, setRailMode] = useState(false);
  const [railHover, setRailHover] = useState(false);

  useEffect(() => {
    setRailMode(readJSON<boolean>(RAIL_KEY, false));
  }, []);
  const toggleRail = () => {
    setRailMode((v) => {
      writeJSON(RAIL_KEY, !v);
      return !v;
    });
  };

  // DB10: 输入停顿 300ms 后调服务端全文搜索；清空即回本地列表
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`);
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits ?? []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // DB14: 拉一次文件夹列表供分组展示
  useEffect(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((d: { folders?: { id: string; name: string }[] }) => setFolders(d.folders ?? []))
      .catch(() => {});
  }, []);

  // DB3: 滚动接近底部时拉下一页
  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !convoCursor || loadingMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      void loadMoreConversations();
    }
  }, [convoCursor, loadingMore, loadMoreConversations]);

  const archivedCount = conversations.filter((c) => c.archived).length;

  /**
   * UX3: 拖拽落位。以目标列表为基准全量重编号（未进入视图的行不动）：
   * 只重编当前渲染域（文件夹组或未分组区）内的行，避免一次拖拽牵动全部会话。
   */
  const commitReorder = (draggedId: string, targetId: string, scope: Conversation[]) => {
    if (draggedId === targetId) return;
    const from = scope.findIndex((c) => c.id === draggedId);
    const to = scope.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...scope];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderConversations(next.map((c, i) => ({ id: c.id, sortIndex: i })));
  };

  const startNew = () => {
    void newConversation("chat").then((id) => selectConversation(id));
  };

  // UX17: 文件夹命名走统一弹窗而非 window.prompt（原生弹窗阻塞且 jsdom 无法断言）
  const [folderDialog, setFolderDialog] = useState(false);
  const createFolder = async (name: string) => {
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        toast((await res.json()).error ?? "创建失败", "error");
        return;
      }
      const folder = (await res.json()) as { id: string; name: string };
      setFolders((prev) => [...prev, folder]);
      toast(`已创建文件夹「${folder.name}」`, "success");
    } catch {
      toast("网络错误，创建失败", "error");
    }
  };

  /** 单条会话行（搜索模式与列表模式共用；scope 用于 UX3 拖拽重编号的作用域） */
  const renderRow = (
    c: (typeof conversations)[number],
    snippet?: string,
    scope?: Conversation[]
  ) => {
    const Icon = MODE_ICONS[c.mode] ?? MessageSquare;
    const active = c.id === activeId;
    const draggable = Boolean(scope) && !showArchived;
    return (
      <div
        key={c.id}
        draggable={draggable}
        onDragStart={() => {
          dragId.current = c.id;
        }}
        onDragOver={(e) => {
          if (!draggable || !dragId.current) return;
          e.preventDefault();
          setDragOverId(c.id);
        }}
        onDragLeave={() => {
          if (dragOverId === c.id) setDragOverId(null);
        }}
        onDrop={(e) => {
          if (!draggable || !dragId.current || !scope) return;
          e.preventDefault();
          e.stopPropagation();
          commitReorder(dragId.current, c.id, scope);
          dragId.current = null;
          setDragOverId(null);
        }}
        onDragEnd={() => {
          dragId.current = null;
          setDragOverId(null);
        }}
        className={cn(
          "group/row flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition",
          active
            ? "border border-orange-200 bg-orange-50"
            : "border border-transparent hover:bg-white hover:shadow-sm",
          draggable && dragOverId === c.id && dragId.current !== c.id && "border-t-2 border-t-brand-400"
        )}
      >
        {draggable && (
          <GripVertical
            className="mt-1 h-3.5 w-3.5 shrink-0 cursor-grab text-stone-300 opacity-0 transition group-hover/row:opacity-100"
            aria-hidden
          />
        )}
        <button
          onClick={() => {
            void selectConversation(c.id);
            // UX20: 移动端抽屉里选中会话后自动收起，避免遮挡对话区
            onMobileClose?.();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          aria-label="打开会话"
        >
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              active ? "bg-orange-100 text-orange-600" : "bg-stone-100 text-stone-500"
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        </button>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-stone-700">
            {c.title}
          </span>
          {snippet ? (
            <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-stone-400">
              <HighlightedSnippet snippet={snippet} />
            </span>
          ) : (
            <span className="mt-0.5 block text-[11px] text-stone-400">
              {MODE_LABELS[c.mode]}
            </span>
          )}
        </span>
        {showArchived ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              void toggleArchive(c.id);
              toast("已恢复到对话历史", "success");
            }}
            title="取消归档"
            className="shrink-0 rounded-md border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500 transition hover:border-brand-300 hover:text-brand-600"
          >
            恢复
          </button>
        ) : (
          <span className="shrink-0 text-[11px] text-stone-400">
            {formatTime(c.createdAt)}
          </span>
        )}
      </div>
    );
  };

  // 搜索模式：命中会话 + 高亮片段
  if (hits) {
    const hitMap = new Map(hits.map((h) => [h.conversationId, h]));
    const matched = conversations.filter((c) => hitMap.has(c.id));
    return (
      <aside
        className={cn(
          "w-[248px] shrink-0 flex-col border-r border-[#e8ddca] bg-[#fbf7ef]",
          "md:flex",
          mobileOpen ? "absolute inset-y-0 left-0 z-50 flex h-full shadow-2xl" : "max-md:hidden"
        )}
      >
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-stone-800">搜索结果</h2>
          <button
            onClick={() => setQuery("")}
            className="text-xs text-stone-400 transition hover:text-brand-600"
          >
            清空
          </button>
        </div>
        <div className="px-3 pb-2 pt-2">
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-400">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索"
              autoFocus
              className="w-full bg-transparent text-[13px] text-stone-700 outline-none placeholder:text-stone-400"
            />
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
          {searching && <p className="px-2 py-4 text-center text-xs text-stone-400">搜索中…</p>}
          {!searching && matched.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-stone-400">
              没有匹配的内容（仅已加载到本地的会话可跳转）
            </p>
          )}
          {matched.map((c) => renderRow(c, hitMap.get(c.id)?.snippet))}
        </div>
        <PromptDialog
          open={folderDialog}
          title="新建文件夹"
          placeholder="文件夹名称"
          maxLength={30}
          onConfirm={(name) => {
            setFolderDialog(false);
            void createFolder(name);
          }}
          onCancel={() => setFolderDialog(false)}
        />
      </aside>
    );
  }

  // 列表模式：文件夹分组（DB14）+ 未分组
  const grouped = folders
    .map((f) => ({
      folder: f,
      convos: conversations.filter((c) => c.folderId === f.id && Boolean(c.archived) === showArchived),
    }))
    .filter((g) => g.convos.length > 0);
  const ungrouped = conversations.filter(
    (c) => (!c.folderId || !folders.some((f) => f.id === c.folderId)) &&
      Boolean(c.archived) === showArchived
  );

  // UX2: 未分组会话按时间分桶（今天/昨天/7 天内/更早）；用户拖拽过（有 sortIndex）则不分组，
  // 尊重手动顺序优先于时间归纳。
  const timeBuckets = new Map<string, Conversation[]>();
  const manualSorted = ungrouped.some((c) => c.sortIndex !== undefined && c.sortIndex !== null);
  if (!manualSorted && !showArchived) {
    for (const c of ungrouped) {
      const bucket = dayBucketOf(c.updatedAt ?? c.createdAt);
      const list = timeBuckets.get(bucket);
      if (list) list.push(c);
      else timeBuckets.set(bucket, [c]);
    }
  }

  // UX1: 收起态只渲染 48px 图标轨（hover 临时展开浮层，不改变布局宽度）
  const railConvos = conversations.filter((c) => !c.archived).slice(0, 12);
  if (railMode && !railHover) {
    return (
      <aside
        onMouseEnter={() => setRailHover(true)}
        className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-[#e8ddca] bg-[#fbf7ef] py-3 md:flex"
      >
        <button
          onClick={toggleRail}
          title="展开历史面板"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <button
          onClick={startNew}
          title="新建对话"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <div className="mt-1 flex flex-col items-center gap-1 overflow-y-auto">
          {railConvos.map((c) => {
            const Icon = MODE_ICONS[c.mode] ?? MessageSquare;
            return (
              <button
                key={c.id}
                onClick={() => void selectConversation(c.id)}
                title={c.title}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition",
                  c.id === activeId
                    ? "bg-orange-100 text-orange-600"
                    : "text-stone-400 hover:bg-stone-100"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside
      onMouseLeave={() => setRailHover(false)}
      className={cn(
        "w-[248px] shrink-0 flex-col border-r border-[#e8ddca] bg-[#fbf7ef]",
        // 桌面常驻；移动端由抽屉开关控制（max-md 维度显隐，避免与 md:flex 特异性打架）
        "md:flex",
        mobileOpen ? "absolute inset-y-0 left-0 z-50 flex h-full shadow-2xl" : "max-md:hidden",
        // UX1: rail 收起态仅桌面生效 —— 悬停展开为浮层
        !mobileOpen && railMode && "md:absolute md:inset-y-0 md:left-12 md:z-40 md:shadow-xl"
      )}
    >
      {/* 标题 */}
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h2 className="text-[15px] font-semibold text-stone-800">
          {showArchived ? "归档会话" : "对话历史"}
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleRail}
            title={railMode ? "展开历史面板" : "收起历史面板"}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
          <button
            onClick={() => setFolderDialog(true)}
            title="新建文件夹"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowArchived((v) => !v)}
            title={showArchived ? "返回对话历史" : "查看归档会话"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-stone-100",
              showArchived ? "text-brand-600" : "text-stone-400 hover:text-brand-600"
            )}
          >
            {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button
            onClick={startNew}
            title="新建对话"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-brand-600"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="px-3 pb-2 pt-2">
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-400">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索"
            className="w-full bg-transparent text-[13px] text-stone-700 outline-none placeholder:text-stone-400"
          />
        </div>
      </div>

      {/* 列表（滚动分页 + 文件夹分组） */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1"
      >
        {ungrouped.length === 0 && grouped.length === 0 && !searching && (
          showArchived ? (
            <EmptyState
              icon={<Archive className="h-5 w-5" />}
              title="还没有归档的会话"
              description="归档不常用的任务，让列表保持清爽。在会话行上即可归档。"
            />
          ) : (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title="暂无历史对话"
              description="从这里开始你的第一个任务，或直接新建对话。"
              action={
                <button
                  onClick={startNew}
                  className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-brand-700"
                >
                  新建对话
                </button>
              }
            />
          )
        )}
        {grouped.map(({ folder, convos }) => {
          const isCollapsed = collapsed[folder.id];
          return (
            <div key={folder.id} className="space-y-0.5">
              <button
                onClick={() => setCollapsed((prev) => ({ ...prev, [folder.id]: !isCollapsed }))}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-stone-500 transition hover:bg-stone-100"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <Folder className="h-3.5 w-3.5 text-orange-400" />
                <span className="truncate">{folder.name}</span>
                <span className="ml-auto text-[11px] text-stone-400">{convos.length}</span>
              </button>
              {!isCollapsed && convos.map((c) => renderRow(c, undefined, convos))}
            </div>
          );
        })}
        {/* UX2: 时间分组优先展示最近的桶；有手动排序时退回平铺（见 timeBuckets 注释） */}
        {[...timeBuckets.entries()].map(([bucket, convos]) => (
          <div key={bucket} className="space-y-0.5">
            <p className="px-2 py-1.5 text-[11px] font-medium tracking-wide text-stone-400">
              {DAY_BUCKET_LABELS[bucket as keyof typeof DAY_BUCKET_LABELS]}
            </p>
            {convos.map((c) => renderRow(c, undefined, ungrouped))}
          </div>
        ))}
        {manualSorted && ungrouped.map((c) => renderRow(c, undefined, ungrouped))}
        {loadingMore && (
          <p className="px-2 py-3 text-center text-xs text-stone-400">加载中…</p>
        )}
        {convoCursor && !loadingMore && (
          <button
            onClick={() => void loadMoreConversations()}
            className="w-full rounded-lg py-2 text-center text-xs text-stone-400 transition hover:text-brand-600"
          >
            加载更多
          </button>
        )}
      </div>

      {/* 升级方案 */}
      <div className="flex items-center gap-2 border-t border-[#eee4d3] p-3">
        <button
          onClick={() => router.push("/membership")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#e3d8c6] bg-white py-2.5 text-[13px] font-medium text-stone-600 transition hover:border-orange-300 hover:text-brand-600"
        >
          <Sparkles className="h-4 w-4 text-orange-500" />
          升级方案
        </button>
        {archivedCount > 0 && !showArchived && (
          <button
            onClick={() => setShowArchived(true)}
            title="查看归档会话"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e3d8c6] bg-white text-stone-400 transition hover:text-brand-600"
          >
            <Archive className="h-4 w-4" />
          </button>
        )}
      </div>

      <PromptDialog
        open={folderDialog}
        title="新建文件夹"
        placeholder="文件夹名称"
        maxLength={30}
        onConfirm={(name) => {
          setFolderDialog(false);
          void createFolder(name);
        }}
        onCancel={() => setFolderDialog(false)}
      />
    </aside>
  );
}
