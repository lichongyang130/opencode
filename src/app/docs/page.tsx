"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  File,
  FileText,
  FolderPlus,
  Grid3X3,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  List,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { ShellSidebar } from "@/components/mockup/ShellSidebar";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import {
  addDocument,
  createFolder,
  docStats,
  duplicateDocument,
  formatSize,
  isTextFile,
  loadDocuments,
  loadFolders,
  QUOTA_GB,
  relativeTime,
  removeDocument,
  restoreDocument,
  toggleFavorite,
  trashDocument,
  updateDocument,
  type DocRow,
  type DocType,
} from "@/lib/documents";
import { DocViewerModal } from "@/components/docs/DocViewerModal";
import { StorageModal } from "@/components/docs/StorageModal";
import { AppLauncherMenu, NotificationBell } from "@/components/shell/TopBarMenus";

const DOC_STYLE: Record<DocType, { bg: string; text: string; letter: string }> = {
  word: { bg: "bg-sky-50 text-sky-600", text: "text-sky-600", letter: "W" },
  pdf: { bg: "bg-red-50 text-red-500", text: "text-red-500", letter: "PDF" },
  excel: { bg: "bg-emerald-50 text-emerald-600", text: "text-emerald-600", letter: "X" },
  ppt: { bg: "bg-orange-50 text-orange-500", text: "text-orange-500", letter: "P" },
  image: { bg: "bg-amber-50 text-amber-600", text: "text-amber-600", letter: "IMG" },
  text: { bg: "bg-stone-100 text-stone-500", text: "text-stone-500", letter: "TXT" },
};

const TYPE_LABEL: Record<DocType, string> = {
  word: "Word",
  pdf: "PDF",
  excel: "表格",
  ppt: "演示文稿",
  image: "图片",
  text: "文本",
};

const TABS = ["全部文档", "我创建的", "与我共享", "收藏夹", "回收站"];

function DocIcon({ type }: { type: DocType }) {
  const s = DOC_STYLE[type];
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ${s.bg} ${s.text}`}>
      {type === "word" || type === "text" ? <FileText className="h-5 w-5" /> : s.letter}
    </span>
  );
}

export default function DocsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState<DocType | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<DocRow | null>(null);
  const [storageOpen, setStorageOpen] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    setDocs(loadDocuments());
    setFolders(loadFolders().map((f) => f.name));
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const rows = useMemo(() => {
    let list = docs;
    if (tab === 4) list = list.filter((d) => d.trashed);
    else {
      list = list.filter((d) => !d.trashed);
      if (tab === 1) list = list.filter((d) => d.owner === "Alex Chen");
      if (tab === 2) list = list.filter((d) => d.owner !== "Alex Chen");
      if (tab === 3) list = list.filter((d) => d.favorite);
    }
    if (typeFilter) list = list.filter((d) => d.type === typeFilter);
    if (folderFilter) list = list.filter((d) => d.folder === folderFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.desc.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q)) ||
          (d.content ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [docs, tab, typeFilter, folderFilter, query]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);
  const stats = useMemo(() => docStats(docs), [docs]);
  const recent = useMemo(
    () => [...docs.filter((d) => !d.trashed)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [docs]
  );

  const upload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let n = 0;
    for (const f of Array.from(files)) {
      const readable = isTextFile(f.name) && f.size < 512 * 1024;
      const done = (content?: string) => {
        addDocument({
          name: f.name,
          sizeKb: Math.max(1, Math.round(f.size / 1024)),
          desc: `上传于 ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
          content,
        });
        n += 1;
        if (n === files.length) {
          refresh();
          toast(`已上传 ${n} 个文档`, "success");
        }
      };
      if (readable) {
        const reader = new FileReader();
        reader.onload = () => done(String(reader.result ?? ""));
        reader.onerror = () => done(undefined);
        reader.readAsText(f);
      } else {
        done(undefined);
      }
    }
  };

  const shareDoc = async (doc: DocRow) => {
    setMenuFor(null);
    try {
      const res = await fetch("/api/cases/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: `doc:${doc.id}`,
          label: doc.name,
          prompt: `【文档】${doc.name}\n${doc.desc}\n${doc.content ? `\n正文节选：\n${doc.content.slice(0, 800)}` : ""}`,
          source: "文档中心",
        }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "生成失败");
      const url = `${window.location.origin}/s/${data.code}`;
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast("分享链接已生成并复制", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "分享失败", "error");
    }
  };

  const exportDocInfo = (doc: DocRow) => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuFor(null);
    toast("已导出文档信息", "success");
  };

  const renameDoc = (doc: DocRow) => {
    setMenuFor(null);
    const name = window.prompt("重命名文档", doc.name);
    if (!name || !name.trim() || name === doc.name) return;
    updateDocument(doc.id, { name: name.trim() });
    refresh();
    toast("已重命名", "success");
  };

  const newFolder = () => {
    const name = window.prompt("新文件夹名称");
    if (!name?.trim()) return;
    const f = createFolder(name.trim());
    if (!f) {
      toast("文件夹已存在或名称为空", "error");
      return;
    }
    refresh();
    toast(`已创建文件夹「${f.name}」`, "success");
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const batch = (kind: "favorite" | "trash" | "restore" | "delete") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    for (const id of ids) {
      if (kind === "favorite") toggleFavorite(id);
      else if (kind === "trash") trashDocument(id);
      else if (kind === "restore") restoreDocument(id);
      else removeDocument(id);
    }
    setSelected(new Set());
    refresh();
    toast(
      `已${kind === "favorite" ? "收藏" : kind === "trash" ? "移入回收站" : kind === "restore" ? "还原" : "彻底删除"} ${ids.length} 个文档`,
      "success"
    );
  };

  const statCards = [
    { icon: FileText, label: "文档总数", value: String(stats.total), unit: "个", tint: "bg-blue-50 text-blue-600" },
    { icon: File, label: "我的文档", value: String(stats.mine), unit: "个", tint: "bg-sky-50 text-sky-600" },
    { icon: Users, label: "团队文档", value: String(stats.team), unit: "个", tint: "bg-orange-50 text-orange-600" },
    {
      icon: Box,
      label: "存储空间",
      value: stats.sizeGb.toFixed(2),
      unit: `GB / ${QUOTA_GB} GB`,
      tint: "bg-violet-50 text-violet-600",
      bar: Math.min(100, (stats.sizeGb / QUOTA_GB) * 100),
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4] text-stone-800">
      <ShellSidebar active="docs" />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#f0eadf] bg-[#fbf8f4] px-6 py-4">
          <div>
            <h1 className="text-[18px] font-semibold text-stone-900">文档中心</h1>
            <p className="mt-0.5 text-[12.5px] text-stone-400">集中管理你的所有文档，支持预览、分享和协作</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => router.push("/apps")}
              title="更多应用"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white hover:text-stone-700"
            >
              <LayoutGrid className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="ml-2 flex items-center gap-1.5 rounded-xl border border-[#f0c9a8] bg-white px-4 py-2 text-[13px] font-medium text-[#c05f3c] transition hover:bg-[#fdeee1]"
            >
              <Plus className="h-4 w-4" /> 上传文档
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                upload(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </header>

        {/* 内容 */}
        <div className="flex min-h-0 flex-1 overflow-hidden px-6 pb-6 pt-5">
          {/* 主区域 */}
          <div className="min-w-0 flex-1 overflow-y-auto pr-4">
            {/* 统计 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {statCards.map((s) => (
                <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-[#ece6db] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.tint}`}>
                    <s.icon className="h-[22px] w-[22px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-stone-400">{s.label}</p>
                    <p className="text-[20px] font-bold leading-tight text-stone-800">
                      {s.value} <span className="text-[12px] font-normal text-stone-400">{s.unit}</span>
                    </p>
                    {s.bar !== undefined && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(1, s.bar)}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 列表区 */}
            <div className="mt-5 rounded-2xl border border-[#ece6db] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              {/* 标签栏 */}
              <div className="flex flex-wrap items-center gap-1 border-b border-[#f0eadf] px-4 pt-3">
                {TABS.map((t, i) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTab(i);
                      setPage(1);
                      setSelected(new Set());
                    }}
                    className={
                      i === tab
                        ? "relative px-3 pb-3 pt-1 text-[13px] font-medium text-[#c05f3c]"
                        : "px-3 pb-3 pt-1 text-[13px] text-stone-500 transition hover:text-stone-800"
                    }
                  >
                    {t}
                    {i === tab && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#f07a3f]" />}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2 pb-2">
                  <div className="flex items-center gap-2 rounded-lg border border-[#ece6db] bg-white px-3 py-1.5 text-stone-400">
                    <Search className="h-4 w-4" />
                    <input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder="搜索文档名称、内容或标签"
                      className="w-44 bg-transparent text-[12.5px] text-stone-700 outline-none placeholder:text-stone-400"
                    />
                  </div>
                  {/* 筛选：类型 + 文件夹 */}
                  <div className="relative" ref={filterRef}>
                    <button
                      onClick={() => setFilterOpen((v) => !v)}
                      className={`flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-[12.5px] transition hover:text-stone-700 ${
                        typeFilter || folderFilter ? "border-[#e0b79c] text-[#c05f3c]" : "border-[#ece6db] text-stone-500"
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {typeFilter ? TYPE_LABEL[typeFilter] : folderFilter ?? "筛选"}
                    </button>
                    {filterOpen && (
                      <div className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-80 w-48 overflow-y-auto rounded-xl border border-[#ece6db] bg-white p-1.5 shadow-xl">
                        <p className="px-2 py-1 text-[11px] text-stone-400">类型</p>
                        <button
                          onClick={() => {
                            setTypeFilter(null);
                            setFilterOpen(false);
                          }}
                          className={`flex w-full rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[#fdfaf5] ${typeFilter === null ? "text-[#c05f3c]" : "text-stone-600"}`}
                        >
                          全部类型
                        </button>
                        {(Object.keys(TYPE_LABEL) as DocType[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setTypeFilter(t);
                              setFilterOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[#fdfaf5] ${typeFilter === t ? "text-[#c05f3c]" : "text-stone-600"}`}
                          >
                            {TYPE_LABEL[t]}
                            <span className="text-[11px] text-stone-400">
                              {docs.filter((d) => !d.trashed && d.type === t).length}
                            </span>
                          </button>
                        ))}
                        <div className="my-1 border-t border-stone-100" />
                        <p className="px-2 py-1 text-[11px] text-stone-400">文件夹</p>
                        <button
                          onClick={() => {
                            setFolderFilter(null);
                            setFilterOpen(false);
                          }}
                          className={`flex w-full rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[#fdfaf5] ${folderFilter === null ? "text-[#c05f3c]" : "text-stone-600"}`}
                        >
                          全部文件夹
                        </button>
                        {[...new Set([...folders, "未整理"])].map((f) => (
                          <button
                            key={f}
                            onClick={() => {
                              setFolderFilter(f);
                              setFilterOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[#fdfaf5] ${folderFilter === f ? "text-[#c05f3c]" : "text-stone-600"}`}
                          >
                            {f}
                            <span className="text-[11px] text-stone-400">
                              {docs.filter((d) => !d.trashed && d.folder === f).length}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setTypeFilter(null);
                      setFolderFilter(null);
                      setQuery("");
                    }}
                    title="清除筛选"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ece6db] bg-white text-stone-400 transition hover:text-stone-700"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  {/* 视图切换：列表 / 卡片 */}
                  <div className="flex overflow-hidden rounded-lg border border-[#ece6db]">
                    <button
                      onClick={() => setView("list")}
                      title="列表视图"
                      className={view === "list" ? "flex h-8 w-8 items-center justify-center bg-[#fdeee1] text-[#c05f3c]" : "flex h-8 w-8 items-center justify-center bg-white text-stone-400 transition hover:text-stone-700"}
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setView("grid")}
                      title="卡片视图"
                      className={view === "grid" ? "flex h-8 w-8 items-center justify-center bg-[#fdeee1] text-[#c05f3c]" : "flex h-8 w-8 items-center justify-center bg-white text-stone-400 transition hover:text-stone-700"}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 批量操作条 */}
              {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-[#f0eadf] bg-[#fdf6ee] px-5 py-2.5 text-[12.5px]">
                  <span className="text-stone-600">已选 {selected.size} 个</span>
                  <button onClick={() => batch("favorite")} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-stone-600 hover:text-[#c05f3c]">
                    收藏
                  </button>
                  {tab === 4 ? (
                    <>
                      <button onClick={() => batch("restore")} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-stone-600 hover:text-[#c05f3c]">
                        还原
                      </button>
                      <button onClick={() => batch("delete")} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-red-500 hover:bg-red-50">
                        彻底删除
                      </button>
                    </>
                  ) : (
                    <button onClick={() => batch("trash")} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-stone-600 hover:text-red-500">
                      移入回收站
                    </button>
                  )}
                  <button onClick={() => setSelected(new Set())} className="ml-auto text-stone-400 hover:text-stone-600">
                    取消选择
                  </button>
                </div>
              )}

              {/* 表头（仅列表视图） */}
              {view === "list" && (
              <div className="flex items-center px-5 py-2.5 text-[12px] text-stone-400">
                <span className="w-[40%]">文档名称</span>
                <span className="w-[15%]">所有者</span>
                <span className="w-[17%]">标签</span>
                <span className="w-[12%]">更新时间</span>
                <span className="w-[9%]">大小</span>
                <span className="flex-1 text-right">操作</span>
              </div>
              )}

              {/* 行 / 卡片 */}
              {pageRows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-stone-400">
                  <FileText className="h-8 w-8 text-stone-300" />
                  <p className="text-sm">{tab === 4 ? "回收站是空的" : "没有匹配的文档"}</p>
                </div>
              ) : view === "grid" ? (
                <div className="grid grid-cols-1 gap-3 border-t border-[#f5f0e8] p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {pageRows.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col rounded-xl border border-[#ece6db] p-4 transition hover:border-[#e0b79c] hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <DocIcon type={r.type} />
                        <button
                          onClick={() => {
                            toggleFavorite(r.id);
                            refresh();
                          }}
                          title={r.favorite ? "取消收藏" : "收藏"}
                          className={`rounded-lg p-1.5 transition hover:bg-stone-100 ${r.favorite ? "text-amber-400" : "text-stone-300"}`}
                        >
                          <Star className={`h-4 w-4 ${r.favorite ? "fill-current" : ""}`} />
                        </button>
                      </div>
                      <button onClick={() => setViewing(r)} className="mt-2.5 text-left">
                        <span className="block truncate text-[13.5px] font-medium text-stone-700">{r.name}</span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-stone-400">{r.desc}</span>
                      </button>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.tags.slice(0, 3).map((t) => (
                          <span key={t} className="rounded-md bg-[#fbf3ec] px-1.5 py-0.5 text-[10px] font-medium text-[#c05f3c]">
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-stone-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {relativeTime(r.updatedAt)}
                        </span>
                        <span>{formatSize(r.sizeKb)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                pageRows.map((r) => (
                  <div key={r.id} className="flex items-center border-t border-[#f5f0e8] px-5 py-3.5 transition hover:bg-[#fdfaf5]">
                    <div className="flex w-[40%] items-center gap-3 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="h-3.5 w-3.5 shrink-0 accent-[#c05f3c]"
                        aria-label={`选择 ${r.name}`}
                      />
                      <button onClick={() => setViewing(r)} className="flex min-w-0 items-center gap-3 text-left">
                        <DocIcon type={r.type} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-stone-700">{r.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-stone-400">{r.desc}</span>
                        </span>
                      </button>
                    </div>
                    <div className="flex w-[15%] items-center gap-2 pr-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-rose-200 text-[10px] font-semibold text-stone-600">
                        {r.owner.slice(0, 1)}
                      </span>
                      <span className="truncate text-[12.5px] text-stone-600">{r.owner}</span>
                    </div>
                    <div className="flex w-[17%] flex-wrap gap-1 pr-2">
                      {r.tags.slice(0, 2).map((t) => (
                        <span key={t} className="rounded-md bg-[#fbf3ec] px-1.5 py-0.5 text-[10px] font-medium text-[#c05f3c]">
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="w-[12%] text-[12.5px] text-stone-500">{relativeTime(r.updatedAt)}</span>
                    <span className="w-[9%] text-[12.5px] text-stone-500">{formatSize(r.sizeKb)}</span>
                    <div className="flex flex-1 items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          toggleFavorite(r.id);
                          refresh();
                        }}
                        title={r.favorite ? "取消收藏" : "收藏"}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-stone-100 ${r.favorite ? "text-amber-400" : "text-stone-400 hover:text-stone-600"}`}
                      >
                        <Star className={`h-4 w-4 ${r.favorite ? "fill-current" : ""}`} />
                      </button>
                      <button
                        onClick={() => void shareDoc(r)}
                        title="分享"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                      <div className="relative" ref={menuFor === r.id ? menuRef : undefined}>
                        <button
                          onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuFor === r.id && (
                          <div className="absolute right-0 top-[calc(100%+4px)] z-30 w-40 overflow-hidden rounded-xl border border-[#ece6db] bg-white p-1.5 text-left shadow-xl">
                            {r.trashed ? (
                              <button
                                onClick={() => {
                                  restoreDocument(r.id);
                                  setMenuFor(null);
                                  refresh();
                                  toast("已还原", "success");
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 hover:bg-[#fdfaf5]"
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> 还原
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setViewing(r)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 hover:bg-[#fdfaf5]"
                                >
                                  <FileText className="h-3.5 w-3.5" /> 打开
                                </button>
                                <button
                                  onClick={() => renameDoc(r)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 hover:bg-[#fdfaf5]"
                                >
                                  <Layers className="h-3.5 w-3.5" /> 重命名
                                </button>
                                <button
                                  onClick={() => {
                                    duplicateDocument(r.id);
                                    setMenuFor(null);
                                    refresh();
                                    toast("已创建副本", "success");
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 hover:bg-[#fdfaf5]"
                                >
                                  <Download className="h-3.5 w-3.5" /> 创建副本
                                </button>
                                <button
                                  onClick={() => exportDocInfo(r)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 hover:bg-[#fdfaf5]"
                                >
                                  <Download className="h-3.5 w-3.5" /> 导出信息
                                </button>
                              </>
                            )}
                            <div className="my-1 border-t border-stone-100" />
                            <button
                              onClick={() => {
                                if (r.trashed) removeDocument(r.id);
                                else trashDocument(r.id);
                                setMenuFor(null);
                                refresh();
                                toast(r.trashed ? "已彻底删除" : "已移入回收站", "info");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> {r.trashed ? "彻底删除" : "删除"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* 分页 */}
              <div className="flex items-center justify-between border-t border-[#f0eadf] px-5 py-3.5 text-[12.5px] text-stone-500">
                <span>共 {rows.length} 个文档</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={current <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#ece6db] bg-white text-stone-400 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {Array.from({ length: Math.min(pageCount, 4) }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                          p === current
                            ? "border-[#f0c9a8] bg-[#fdf1e3] text-[#c05f3c]"
                            : "border-[#ece6db] bg-white text-stone-500 transition hover:text-stone-700"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    {pageCount > 4 && <span className="px-1 text-stone-300">…</span>}
                    {pageCount > 4 && (
                      <button
                        onClick={() => setPage(pageCount)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#ece6db] bg-white text-stone-500 transition hover:text-stone-700"
                      >
                        {pageCount}
                      </button>
                    )}
                    <button
                      disabled={current >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#ece6db] bg-white text-stone-400 disabled:opacity-40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded-lg border border-[#ece6db] bg-white px-2 py-1.5 text-[12.5px] text-stone-500 outline-none"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n} 条/页
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧面板 */}
          <aside className="hidden w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#ece6db] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] xl:flex">
            {/* 存储空间 */}
            <div className="border-b border-[#f0eadf] p-5">
              <p className="text-[14px] font-semibold text-stone-800">存储空间</p>
              <div className="mt-4 flex items-center gap-5">
                <div className="relative h-28 w-28 shrink-0">
                  <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#f0eadf" strokeWidth="12" />
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke="#f07a3f"
                      strokeWidth="12"
                      strokeDasharray="326.7"
                      strokeDashoffset={326.7 - (Math.min(100, (stats.sizeGb / QUOTA_GB) * 100) / 100) * 326.7}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[20px] font-bold text-stone-800">{stats.sizeGb.toFixed(2)} GB</p>
                    <p className="text-[11px] text-stone-400">/ {QUOTA_GB} GB</p>
                  </div>
                </div>
                <div className="flex-1 space-y-2 text-[12px] text-stone-500">
                  <p className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />文档文件
                    </span>
                    <span>{formatSize((stats.byType.word ?? 0) + (stats.byType.pdf ?? 0) + (stats.byType.text ?? 0))}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />表格 / 演示
                    </span>
                    <span>{formatSize((stats.byType.excel ?? 0) + (stats.byType.ppt ?? 0))}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />图片文件
                    </span>
                    <span>{formatSize(stats.byType.image ?? 0)}</span>
                  </p>
                  <button
                    onClick={() => setStorageOpen(true)}
                    className="w-full rounded-lg border border-[#ece6db] bg-white py-2 text-[12.5px] font-medium text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                  >
                    管理存储空间
                  </button>
                </div>
              </div>
            </div>

            {/* 快速操作 */}
            <div className="border-b border-[#f0eadf] p-5">
              <p className="text-[14px] font-semibold text-stone-800">快速操作</p>
              <div className="mt-3 space-y-1">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#fdfaf5]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Upload className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-stone-700">上传文档</span>
                    <span className="block text-[11px] text-stone-400">文本文件可直接在线预览编辑</span>
                  </span>
                </button>
                <button
                  onClick={() => router.push("/templates")}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#fdfaf5]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <LayoutTemplate className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-stone-700">从模板新建</span>
                    <span className="block text-[11px] text-stone-400">用专业模板一键生成新文档</span>
                  </span>
                </button>
                <button
                  onClick={newFolder}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#fdfaf5]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <FolderPlus className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-stone-700">新建文件夹</span>
                    <span className="block text-[11px] text-stone-400">当前 {folders.length} 个文件夹</span>
                  </span>
                </button>
                <button
                  onClick={() => {
                    if (selected.size > 0) {
                      setSelected(new Set());
                      return;
                    }
                    setSelected(new Set(rows.filter((d) => !d.trashed).slice(0, 5).map((d) => d.id)));
                    toast("已选中前 5 个文档，可批量操作", "info");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#fdfaf5]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <Layers className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-stone-700">批量操作</span>
                    <span className="block text-[11px] text-stone-400">
                      {selected.size > 0 ? `已选 ${selected.size} 个，点击取消` : "勾选文档后可批量收藏/删除"}
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {/* 最近文档 */}
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-[14px] font-semibold text-stone-800">最近文档</p>
              <div className="mt-3 space-y-1">
                {recent.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setViewing(d)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[#fdfaf5]"
                  >
                    <DocIcon type={d.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-stone-700">{d.name}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
                        <Clock className="h-3 w-3" />
                        {relativeTime(d.updatedAt)}
                      </span>
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setTab(0);
                    setPage(1);
                    setTypeFilter(null);
                    setFolderFilter(null);
                    setQuery("");
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[12px] text-[#c05f3c] transition hover:opacity-80"
                >
                  查看全部 <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {viewing && (
        <DocViewerModal
          doc={docs.find((d) => d.id === viewing.id) ?? viewing}
          folders={[...new Set([...folders, "未整理"])]}
          onChange={refresh}
          onClose={() => setViewing(null)}
        />
      )}
      {storageOpen && <StorageModal docs={docs} onChange={refresh} onClose={() => setStorageOpen(false)} />}
      <Toaster />
    </div>
  );
}
