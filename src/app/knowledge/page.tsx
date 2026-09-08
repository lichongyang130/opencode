"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Folder,
  Gauge,
  GraduationCap,
  Layers,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { ShellSidebar } from "@/components/mockup/ShellSidebar";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import {
  addDoc,
  allTags,
  createKnowledgeBase,
  docStatus,
  formatVectors,
  kbVectors,
  loadAbilities,
  loadKnowledgeBases,
  removeDoc,
  removeKnowledgeBase,
  saveAbilities,
  summarize,
  updateKnowledgeBase,
  type KbAbilities,
  type KbDoc,
  type KbOwner,
  type KbRow,
} from "@/lib/knowledge";
import { KbFormModal } from "@/components/knowledge/KbFormModal";
import { KbDocsModal } from "@/components/knowledge/KbDocsModal";
import { DocDetailModal } from "@/components/knowledge/DocDetailModal";
import { AppLauncherMenu, NotificationBell } from "@/components/shell/TopBarMenus";

const TABS: { label: string; owner: KbOwner | null }[] = [
  { label: "全部知识库", owner: null },
  { label: "我的知识库", owner: "me" },
  { label: "共享给我", owner: "shared" },
  { label: "团队知识库", owner: "team" },
];

const OWNER_LABEL: Record<KbOwner, string> = { me: "我的", shared: "共享给我", team: "团队" };

const ABILITIES = [
  { key: "semantic", icon: Sparkles, label: "语义搜索", desc: "基于语义理解的智能搜索" },
  { key: "qa", icon: GraduationCap, label: "问答增强", desc: "基于知识库内容回答问题" },
  { key: "cite", icon: FileText, label: "引用来源", desc: "展示答案引用的文档来源" },
] as const;

const SORTS: { value: "updated" | "count" | "size" | "name"; label: string }[] = [
  { value: "updated", label: "按更新时间" },
  { value: "count", label: "按文档数量" },
  { value: "size", label: "按容量大小" },
  { value: "name", label: "按名称" },
];

function formatSize(n: number) {
  if (n <= 0) return "0 B";
  if (n >= 1) return `${n.toFixed(1)} GB`;
  return `${Math.round(n * 1024)} MB`;
}

export default function KnowledgePage() {
  const router = useRouter();
  const [rows, setRows] = useState<KbRow[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [tab, setTab] = useState(0);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<"updated" | "count" | "size" | "name">("updated");
  const [selectedId, setSelectedId] = useState("");
  const [abilities, setAbilities] = useState<KbAbilities>({ semantic: true, qa: true, cite: false });
  const [formOpen, setFormOpen] = useState<{ open: boolean; row: KbRow | null }>({ open: false, row: null });
  const [docsOpen, setDocsOpen] = useState(false);
  const [docDetail, setDocDetail] = useState<KbDoc | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  /* 检索测试（演示：基于文档名与摘要的关键词匹配） */
  const [rtQuery, setRtQuery] = useState("");
  const [rtDone, setRtDone] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setRows(loadKnowledgeBases());

  useEffect(() => {
    const list = loadKnowledgeBases();
    setRows(list);
    setSelectedId((prev) => prev || list[0]?.id || "");
  }, []);

  useEffect(() => {
    if (selectedId) setAbilities(loadAbilities(selectedId));
  }, [selectedId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      // 行菜单容器标记 data-menu-open；点在其内部时不关闭（避免菜单项点击前被卸载）
      const insideMenu = t instanceof Element && Boolean(t.closest("[data-menu-open]"));
      if (!insideMenu) setMenuFor(null);
      if (filterRef.current && !filterRef.current.contains(t)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const filtered = useMemo(() => {
    const owner = TABS[tab].owner;
    let arr = rows;
    if (owner) arr = arr.filter((r) => r.owner === owner);
    if (tagFilter) arr = arr.filter((r) => r.tags.includes(tagFilter));
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.desc.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    arr = [...arr];
    if (sort === "updated") arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    else if (sort === "count") arr.sort((a, b) => b.count - a.count);
    else if (sort === "size") arr.sort((a, b) => b.sizeGb - a.sizeGb);
    else arr.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    return arr;
  }, [rows, tab, tagFilter, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const summary = summarize(rows);
  const tags = useMemo(() => allTags(rows), [rows]);

  /* 检索测试结果：按字符 2-gram 命中率对当前知识库文档排序，取前 3 条 */
  const rtResults = useMemo(() => {
    const q = rtQuery.trim().toLowerCase();
    if (!q || !selected) return [];
    const grams = new Set<string>();
    for (let i = 0; i < q.length - 1; i += 1) grams.add(q.slice(i, i + 2));
    if (grams.size === 0) return [];
    return selected.docs
      .map((d) => {
        const hay = `${d.name} ${d.excerpt ?? ""}`.toLowerCase();
        let hit = 0;
        grams.forEach((g) => {
          if (hay.includes(g)) hit += 1;
        });
        return { doc: d, score: hit / grams.size };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [rtQuery, selected]);

  const toggleAbility = (key: keyof KbAbilities) => {
    if (!selected) return;
    const next = { ...abilities, [key]: !abilities[key] };
    setAbilities(next);
    saveAbilities(selected.id, next);
    toast(`「${selected.name}」已${next[key] ? "开启" : "关闭"}${ABILITIES.find((a) => a.key === key)?.label ?? ""}`, "info");
  };

  /** 协作权限切换：仅查看时成员只能检索，不能增删文档 */
  const setPerm = (perm: "edit" | "view") => {
    if (!selected || (selected.perm ?? "edit") === perm) return;
    updateKnowledgeBase(selected.id, { perm });
    refresh();
    toast(perm === "view" ? "已设为仅查看，成员只能检索" : "已设为可编辑", "info");
  };

  const saveForm = (input: { name: string; desc: string; tags: string[]; owner: KbOwner }) => {
    const row = formOpen.row;
    if (row) {
      updateKnowledgeBase(row.id, input);
      toast("知识库已更新", "success");
    } else {
      const created = createKnowledgeBase(input);
      setSelectedId(created.id);
      setTab(0);
      toast(`已创建知识库「${created.name}」`, "success");
    }
    setFormOpen({ open: false, row: null });
    refresh();
  };

  const removeKb = (row: KbRow) => {
    removeKnowledgeBase(row.id);
    setMenuFor(null);
    if (selectedId === row.id) setSelectedId("");
    refresh();
    toast(`已删除「${row.name}」`, "info");
  };

  const exportKb = (row: KbRow) => {
    const blob = new Blob([JSON.stringify(row, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuFor(null);
    toast("已导出知识库信息", "success");
  };

  const shareKb = async (row: KbRow) => {
    setMenuFor(null);
    try {
      const res = await fetch("/api/cases/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: `kb:${row.id}`,
          label: row.name,
          prompt: `【知识库】${row.name}\n${row.desc}\n标签：${row.tags.join("、") || "无"}\n文档数：${row.count}\n容量：${row.size}`,
          source: "知识库",
        }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "生成失败");
      const url = `${window.location.origin}/s/${data.code}`;
      setShareLink(url);
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast("分享链接已生成并复制", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "生成分享失败", "error");
    }
  };

  const quickUpload = (files: FileList | null) => {
    if (!selected || !files || files.length === 0) return;
    for (const f of Array.from(files)) {
      addDoc(selected.id, { name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) });
    }
    refresh();
    toast(`已向「${selected.name}」添加 ${files.length} 个文档，正在向量化`, "success");
  };

  const stat = (label: string, n: number | string, unit: string, tint: string, Icon: typeof Box) => (
    <div className="flex items-center gap-3 rounded-2xl border border-[#ece6db] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <div>
        <p className="text-[12px] text-stone-400">{label}</p>
        <p className="text-[20px] font-bold leading-tight text-stone-800">
          {n} <span className="text-[12px] font-normal text-stone-400">{unit}</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4] text-stone-800">
      <ShellSidebar active="knowledge" />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#f0eadf] bg-[#fbf8f4] px-6 py-4">
          <div>
            <h1 className="text-[18px] font-semibold text-stone-900">知识库</h1>
            <p className="mt-0.5 text-[12.5px] text-stone-400">管理和使用你的知识资源，让 AI 更好地理解和回答</p>
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
              onClick={() => setFormOpen({ open: true, row: null })}
              className="ml-2 flex items-center gap-1.5 rounded-xl border border-[#f0c9a8] bg-white px-4 py-2 text-[13px] font-medium text-[#c05f3c] transition hover:bg-[#fdeee1]"
            >
              <Plus className="h-4 w-4" /> 新建知识库
            </button>
          </div>
        </header>

        {/* 内容 */}
        <div className="flex min-h-0 flex-1 overflow-hidden px-6 pb-6 pt-5">
          {/* 主区域 */}
          <div className="min-w-0 flex-1 overflow-y-auto pr-4">
            {/* 统计 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stat("知识库总数", summary.total, "个", "bg-violet-50 text-violet-600", Box)}
              {stat("文档总数", summary.docs.toLocaleString("zh-CN"), "个", "bg-sky-50 text-sky-600", FileText)}
              {stat("向量条目数", formatVectors(summary.vectors), "条", "bg-orange-50 text-orange-600", Layers)}
              {stat("总大小", formatSize(summary.sizeGb), "", "bg-emerald-50 text-emerald-600", Gauge)}
            </div>

            {/* 列表区 */}
            <div className="mt-5 rounded-2xl border border-[#ece6db] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              {/* 标签栏 */}
              <div className="flex flex-wrap items-center gap-1 border-b border-[#f0eadf] px-4 pt-3">
                {TABS.map((t, i) => (
                  <button
                    key={t.label}
                    onClick={() => {
                      setTab(i);
                      setPage(1);
                    }}
                    className={
                      i === tab
                        ? "relative px-3 pb-3 pt-1 text-[13px] font-medium text-[#c05f3c]"
                        : "px-3 pb-3 pt-1 text-[13px] text-stone-500 transition hover:text-stone-800"
                    }
                  >
                    {t.label}
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
                      placeholder="搜索知识库"
                      className="w-36 bg-transparent text-[12.5px] text-stone-700 outline-none placeholder:text-stone-400"
                    />
                  </div>
                  {/* 筛选：标签 + 排序 */}
                  <div className="relative" ref={filterRef}>
                    <button
                      onClick={() => setFilterOpen((v) => !v)}
                      className={`flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-[12.5px] transition hover:text-stone-700 ${
                        tagFilter ? "border-[#e0b79c] text-[#c05f3c]" : "border-[#ece6db] text-stone-500"
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" /> {tagFilter ?? "筛选"}
                    </button>
                    {filterOpen && (
                      <div className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-80 w-56 overflow-y-auto rounded-xl border border-[#ece6db] bg-white p-1.5 shadow-xl">
                        <p className="px-2 py-1 text-[11px] text-stone-400">标签</p>
                        <button
                          onClick={() => {
                            setTagFilter(null);
                            setPage(1);
                            setFilterOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[#fdfaf5] ${
                            tagFilter === null ? "text-[#c05f3c]" : "text-stone-600"
                          }`}
                        >
                          全部标签 <span className="text-[11px] text-stone-400">{rows.length}</span>
                        </button>
                        {tags.map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setTagFilter(t);
                              setPage(1);
                              setFilterOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[#fdfaf5] ${
                              tagFilter === t ? "text-[#c05f3c]" : "text-stone-600"
                            }`}
                          >
                            {t}
                            <span className="text-[11px] text-stone-400">
                              {rows.filter((r) => r.tags.includes(t)).length}
                            </span>
                          </button>
                        ))}
                        <div className="my-1 border-t border-stone-100" />
                        <p className="px-2 py-1 text-[11px] text-stone-400">排序</p>
                        {SORTS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => {
                              setSort(s.value);
                              setFilterOpen(false);
                            }}
                            className={`flex w-full rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[#fdfaf5] ${
                              sort === s.value ? "text-[#c05f3c]" : "text-stone-600"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 表头 */}
              <div className="flex items-center px-5 py-2.5 text-[12px] text-stone-400">
                <span className="w-[24%]">名称</span>
                <span className="w-[38%]">描述</span>
                <span className="w-[11%]">文档数量</span>
                <span className="w-[11%]">大小</span>
                <span className="w-[13%]">更新时间</span>
                <span className="flex-1 text-right">操作</span>
              </div>

              {/* 行 */}
              {pageRows.length === 0 && (
                <p className="py-14 text-center text-sm text-stone-400">没有匹配的知识库</p>
              )}
              {pageRows.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`flex cursor-pointer items-center border-t border-[#f5f0e8] px-5 py-3.5 transition hover:bg-[#fdfaf5] ${
                    selected?.id === r.id ? "bg-[#fdf6ee]" : ""
                  }`}
                >
                  <div className="flex w-[24%] items-center gap-3 pr-2">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${r.tint}`}>
                      <Folder className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-stone-700">{r.name}</span>
                      <span className="block text-[10.5px] text-stone-400">{OWNER_LABEL[r.owner]}</span>
                    </span>
                  </div>
                  <span className="w-[38%] truncate pr-2 text-xs text-stone-400">{r.desc}</span>
                  <span className="w-[11%] text-[13px] text-stone-700">{r.count}</span>
                  <span className="w-[11%] text-[13px] text-stone-500">{r.size}</span>
                  <span className="w-[13%] text-[13px] text-stone-500">{r.time}</span>
                  <div className="flex flex-1 items-center justify-end gap-1">
                    <div data-menu-open className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === r.id ? null : r.id);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuFor === r.id && (
                        <div
                          className="absolute right-0 top-[calc(100%+4px)] z-30 w-40 overflow-hidden rounded-xl border border-[#ece6db] bg-white p-1.5 text-left shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setMenuFor(null);
                              setFormOpen({ open: true, row: r });
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 hover:bg-[#fdfaf5]"
                          >
                            <Users className="h-3.5 w-3.5" /> 管理知识库
                          </button>
                          <button
                            onClick={() => void shareKb(r)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 hover:bg-[#fdfaf5]"
                          >
                            <Share2 className="h-3.5 w-3.5" /> 分享
                          </button>
                          <button
                            onClick={() => exportKb(r)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-stone-600 hover:bg-[#fdfaf5]"
                          >
                            <Download className="h-3.5 w-3.5" /> 导出信息
                          </button>
                          <div className="my-1 border-t border-stone-100" />
                          <button
                            onClick={() => removeKb(r)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> 删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* 分页 */}
              <div className="flex items-center justify-between border-t border-[#f0eadf] px-5 py-3.5 text-[12.5px] text-stone-500">
                <span>共 {filtered.length} 条</span>
                <div className="flex items-center gap-3">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded-lg border border-[#ece6db] bg-white px-2 py-1.5 text-[12.5px] text-stone-500 outline-none"
                  >
                    {[6, 12, 24].map((n) => (
                      <option key={n} value={n}>
                        {n} 条 / 页
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={current <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#ece6db] bg-white text-stone-400 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
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
                    <button
                      disabled={current >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#ece6db] bg-white text-stone-400 disabled:opacity-40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span>前往</span>
                  <input
                    value={current}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (n >= 1 && n <= pageCount) setPage(n);
                    }}
                    className="h-7 w-9 rounded-lg border border-[#ece6db] bg-white text-center text-[12px] outline-none"
                  />
                  <span>页</span>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧详情面板 */}
          <aside className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#ece6db] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] xl:flex">
            {selected ? (
              <>
                <div className="max-h-[45vh] overflow-y-auto px-5 pt-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <Folder className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="flex items-center gap-1.5 text-[16px] font-semibold text-stone-800">
                        <span className="truncate">{selected.name}</span>{" "}
                        <Shield className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 已启用 · {OWNER_LABEL[selected.owner]}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-[12px] text-stone-400">
                    <p>
                      <span className="text-stone-500">类别</span> · {selected.tags[0] ?? "未分类"}
                    </p>
                    <p>
                      <span className="text-stone-500">创建人</span> · Alex Chen
                    </p>
                    <p>
                      <span className="text-stone-500">创建时间</span> · {selected.updatedAt}
                    </p>
                  </div>
                  <p className="mt-3 text-[12.5px] leading-6 text-stone-500">描述：{selected.desc}</p>
                </div>

                {/* 统计 */}
                <div className="mx-5 mt-4 grid grid-cols-3 divide-x divide-[#f0eadf] rounded-xl border border-[#f0eadf] py-3 text-center">
                  <div>
                    <p className="text-[18px] font-bold text-stone-800">{selected.count}</p>
                    <p className="mt-0.5 text-[11px] text-stone-400">文档数量</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-bold text-stone-800">{formatSize(selected.sizeGb)}</p>
                    <p className="mt-0.5 text-[11px] text-stone-400">知识库大小</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-bold text-stone-800">{formatVectors(kbVectors(selected))}</p>
                    <p className="mt-0.5 text-[11px] text-stone-400">向量条目数</p>
                  </div>
                </div>

                {/* 标签 */}
                <div className="mt-5 px-5">
                  <p className="text-[13.5px] font-semibold text-stone-800">标签</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.tags.length ? (
                      selected.tags.map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setTagFilter(t);
                            setPage(1);
                          }}
                          className="rounded-full border border-[#ece6db] bg-[#fbf8f4] px-2.5 py-1 text-[11px] text-stone-500 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                        >
                          {t}
                        </button>
                      ))
                    ) : (
                      <span className="text-[11px] text-stone-400">暂无标签，可在「管理知识库」里添加</span>
                    )}
                  </div>
                </div>

                {/* 能力设置 */}
                <div className="mt-5 px-5">
                  <p className="text-[13.5px] font-semibold text-stone-800">能力设置</p>
                  <div className="mt-2 space-y-1">
                    {ABILITIES.map((s) => (
                      <div key={s.key} className="flex items-center gap-3 py-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fbf3ec] text-[#c05f3c]">
                          <s.icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-stone-700">{s.label}</p>
                          <p className="text-[11px] text-stone-400">{s.desc}</p>
                        </div>
                        <button
                          onClick={() => toggleAbility(s.key)}
                          className={`relative h-5 w-9 rounded-full transition ${abilities[s.key] ? "bg-[#ff6a3d]" : "bg-stone-200"}`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                              abilities[s.key] ? "right-0.5" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 协作权限 */}
                <div className="mx-5 mt-4 flex items-center justify-between rounded-xl border border-[#f0eadf] px-3.5 py-2.5">
                  <div className="min-w-0 pr-2">
                    <p className="text-[12.5px] font-medium text-stone-700">协作权限</p>
                    <p className="mt-0.5 text-[10.5px] leading-4 text-stone-400">
                      仅查看：成员只能检索，不能增删文档
                    </p>
                  </div>
                  <div className="flex shrink-0 rounded-lg border border-[#ece6db] p-0.5">
                    {([
                      { id: "edit" as const, label: "可编辑" },
                      { id: "view" as const, label: "仅查看" },
                    ]).map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setPerm(o.id)}
                        className={
                          (selected.perm ?? "edit") === o.id
                            ? "rounded-md bg-[#fdeee1] px-2 py-1 text-[11px] font-medium text-[#c05f3c]"
                            : "rounded-md px-2 py-1 text-[11px] text-stone-400 transition hover:text-stone-700"
                        }
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 检索测试 */}
                <div className="mt-5 px-5">
                  <p className="text-[13.5px] font-semibold text-stone-800">检索测试</p>
                  <p className="mt-0.5 text-[11px] text-stone-400">
                    输入问题，验证该知识库能命中哪些内容（演示：基于关键词匹配）
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={rtQuery}
                      onChange={(e) => {
                        setRtQuery(e.target.value);
                        setRtDone(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setRtDone(true);
                      }}
                      placeholder="例如：PRD 的验收标准"
                      className="min-w-0 flex-1 rounded-xl border border-[#ece6db] bg-white px-3 py-2 text-[12.5px] text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-[#e0b79c]"
                    />
                    <button
                      onClick={() => setRtDone(true)}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 px-3.5 text-[12.5px] font-medium text-white shadow-sm transition hover:brightness-105"
                    >
                      检索
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {rtDone && !selected && (
                      <p className="px-1 py-1 text-[11.5px] text-stone-400">先选择一个知识库</p>
                    )}
                    {rtDone && selected && selected.docs.length === 0 && (
                      <p className="px-1 py-1 text-[11.5px] text-stone-400">
                        该知识库还没有文档，先点「+ 上传」添加
                      </p>
                    )}
                    {rtDone && selected && selected.docs.length > 0 && rtResults.length === 0 && (
                      <p className="px-1 py-1 text-[11.5px] text-stone-400">
                        没有命中文档。试试问题里带上文档标题中的关键词。
                      </p>
                    )}
                    {rtResults.map((r) => (
                      <button
                        key={r.doc.id}
                        onClick={() => setDocDetail(r.doc)}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-[#ece6db] bg-[#fbf8f4] px-2.5 py-2 text-left transition hover:border-[#e0b79c]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                          <FileText className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-stone-700">
                            {r.doc.name}
                          </span>
                          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-stone-200/70">
                            <span
                              className="block h-full rounded-full bg-[#f07a3f]"
                              style={{ width: `${Math.round(r.score * 100)}%` }}
                            />
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-[#c05f3c]">
                          {Math.round(r.score * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 最近更新 */}
                <div className="mt-5 px-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[13.5px] font-semibold text-stone-800">最近更新的文档</p>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="text-[11px] text-stone-400 transition hover:text-[#c05f3c]"
                    >
                      + 上传
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        quickUpload(e.target.files);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {selected.docs.length === 0 && (
                      <p className="px-2 py-2 text-[11.5px] text-stone-400">还没有文档，点「+ 上传」添加</p>
                    )}
                    {selected.docs.slice(0, 3).map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setDocDetail(d)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left transition hover:bg-[#fdfaf5]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-stone-700">{d.name}</span>
                        {docStatus(d) === "processing" && (
                          <span className="shrink-0 animate-pulse rounded-full bg-amber-50 px-1.5 py-px text-[9.5px] font-medium text-amber-600">
                            向量化中
                          </span>
                        )}
                        <span className="shrink-0 text-[11px] text-stone-400">{d.updatedAt.slice(5, 16)}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setDocsOpen(true)}
                      className="flex items-center gap-1 px-2 py-1 text-[12px] text-[#c05f3c] transition hover:opacity-80"
                    >
                      查看全部文档（{selected.docs.length}） <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {shareLink && (
                  <div className="mx-5 mt-4 rounded-xl border border-[#e0b79c] bg-[#fdf1e3] px-3 py-2">
                    <p className="text-[11px] text-stone-500">分享链接（已复制）</p>
                    <a
                      href={shareLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-[12px] text-[#c05f3c] underline"
                    >
                      {shareLink}
                    </a>
                  </div>
                )}

                <div className="mt-auto flex items-center gap-2 border-t border-[#f0eadf] p-4">
                  <button
                    onClick={() => void shareKb(selected)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#ece6db] bg-white py-2.5 text-[13px] font-medium text-stone-600 transition hover:border-[#e0b79c]"
                  >
                    <Share2 className="h-4 w-4" /> 分享知识库
                  </button>
                  <button
                    onClick={() => setFormOpen({ open: true, row: selected })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 py-2.5 text-[13px] font-medium text-white shadow-sm transition hover:brightness-105"
                  >
                    <Users className="h-4 w-4" /> 管理知识库
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-stone-400">选择一个知识库查看详情</div>
            )}
          </aside>
        </div>
      </main>

      {formOpen.open && (
        <KbFormModal initial={formOpen.row} onClose={() => setFormOpen({ open: false, row: null })} onSave={saveForm} />
      )}
      {docsOpen && selected && (
        <KbDocsModal
          kb={selected}
          onClose={() => setDocsOpen(false)}
          onChange={refresh}
          onOpenDoc={(d) => setDocDetail(d)}
        />
      )}
      {docDetail && selected && (
        <DocDetailModal doc={docDetail} kbName={selected.name} onClose={() => setDocDetail(null)} />
      )}
      <Toaster />
    </div>
  );
}
