"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, LayoutGrid, Search, Star } from "lucide-react";
import { ShellSidebar } from "@/components/mockup/ShellSidebar";
import { ToolRunnerModal } from "@/components/tools/ToolRunnerModal";
import { ALL_TOOLS, TOOL_GROUPS, recordToolUsage, type ToolDef } from "@/lib/tools";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import { NotificationBell } from "@/components/shell/TopBarMenus";
import { readJSON, writeJSON } from "@/lib/safe-storage";

const FAV_KEY = "oc:tool-favs.v1";
const RECENT_KEY = "oc:tool-recent.v1";
const USAGE_KEY = "oc:tool-usage.v1";

function loadIds(key: string): string[] {
  const list = readJSON<string[]>(key, []);
  return Array.isArray(list) ? list : [];
}

/** 读取工具使用次数统计（模块级函数，避免组件内声明提升带来的隐式依赖） */
function loadUsageMap(): Record<string, number> {
  return readJSON<Record<string, number>>(USAGE_KEY, {});
}

export default function ToolsPage() {
  const router = useRouter();
  const [active, setActive] = useState<ToolDef | null>(null);
  const [query, setQuery] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});
  /** 工具接力：待送入目标工具的文本 */
  const [handoff, setHandoff] = useState<{ toolId: string; text: string } | null>(null);

  useEffect(() => {
    setFavs(loadIds(FAV_KEY));
    setRecentIds(loadIds(RECENT_KEY));
    setUsageMap(loadUsageMap());
  }, []);

  /** 打开工具：记录到最近使用；若是接力目标则带入上文结果 */
  const openTool = useCallback((t: ToolDef, prefill?: string) => {
    recordToolUsage(t.id);
    setUsageMap((m) => ({ ...m, [t.id]: (m[t.id] ?? 0) + 1 }));
    setActive(prefill !== undefined ? { ...t, sample: prefill } : t);
    // 用函数式更新读取最新的最近列表，避免把 recentIds 变成依赖
    setRecentIds((prev) => {
      const next = [t.id, ...prev.filter((i) => i !== t.id)].slice(0, 8);
      writeJSON(RECENT_KEY, next);
      return next;
    });
  }, []);

  // 工具接力：打开目标工具并预填上一步结果
  useEffect(() => {
    if (!handoff) return;
    const target = ALL_TOOLS.find((t) => t.id === handoff.toolId);
    if (target) openTool(target, handoff.text);
    setHandoff(null);
  }, [handoff, openTool]);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((i) => i !== id) : [id, ...favs];
    setFavs(next);
    writeJSON(FAV_KEY, next);
    toast(next.includes(id) ? "已加入常用收藏" : "已取消收藏", "success");
  };

  const byId = useMemo(() => new Map(ALL_TOOLS.map((t) => [t.id, t])), []);
  const recentTools = recentIds.map((id) => byId.get(id)).filter(Boolean) as ToolDef[];
  const favTools = favs.map((id) => byId.get(id)).filter(Boolean) as ToolDef[];

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOL_GROUPS;
    return TOOL_GROUPS.map((g) => ({
      ...g,
      tools: g.tools.filter(
        (t) => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
      ),
    })).filter((g) => g.tools.length > 0);
  }, [query]);

  const total = TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0);
  const usable = TOOL_GROUPS.reduce((n, g) => n + g.tools.filter((t) => t.kind !== "unsupported").length, 0);

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4] text-stone-800">
      <ShellSidebar active="tools" />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#f0eadf] bg-[#fbf8f4] px-6 py-4">
          <div>
            <h1 className="text-[18px] font-semibold text-stone-900">工具箱</h1>
            <p className="mt-0.5 text-[12.5px] text-stone-400">
              共 {total} 个工具，{usable} 个已可直接运行 · 点开即用，无需上传服务器
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-[#ece6db] bg-white px-3 py-2 text-stone-400">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索工具"
                className="w-40 bg-transparent text-[13px] text-stone-700 outline-none placeholder:text-stone-400"
              />
            </div>
            <NotificationBell />
            <button
              onClick={() => router.push("/apps")}
              title="更多应用"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white hover:text-stone-700"
            >
              <LayoutGrid className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5">
          <div className="mx-auto w-full max-w-[1180px]">
            {/* 常用收藏 / 最近使用 */}
            {(favTools.length > 0 || recentTools.length > 0) && (
              <div className="space-y-2.5 rounded-2xl border border-[#ece6db] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                {favTools.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-amber-500">
                      <Star className="h-3.5 w-3.5 fill-current" /> 常用收藏
                    </span>
                    {favTools.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openTool(t)}
                        className="flex items-center gap-1.5 rounded-full border border-[#ece6db] px-2.5 py-1 text-[12px] text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                      >
                        <t.icon className="h-3.5 w-3.5" /> {t.name}
                      </button>
                    ))}
                  </div>
                )}
                {recentTools.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-stone-400">
                      <Clock className="h-3.5 w-3.5" /> 最近使用
                    </span>
                    {recentTools.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openTool(t)}
                        className="flex items-center gap-1.5 rounded-full border border-[#ece6db] px-2.5 py-1 text-[12px] text-stone-500 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                      >
                        <t.icon className="h-3.5 w-3.5" /> {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {groups.length === 0 && (
              <p className="py-16 text-center text-sm text-stone-400">没有找到匹配的工具</p>
            )}
            {groups.map((g) => (
              <div key={g.title} className="mt-5 first:mt-0">
                <h2 className="text-[15px] font-semibold text-stone-800">{g.title}</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {g.tools.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => openTool(t)}
                      className="group relative flex cursor-pointer items-start gap-3 rounded-2xl border border-[#ece6db] bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition hover:shadow-md"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.bg} ${t.tint}`}>
                        <t.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-semibold text-stone-800">{t.name}</span>
                          {t.kind === "unsupported" ? (
                            <span className="shrink-0 rounded bg-stone-100 px-1 py-px text-[9.5px] font-normal text-stone-400">
                              需服务端
                            </span>
                          ) : (
                            <span className="shrink-0 rounded bg-emerald-50 px-1 py-px text-[9.5px] font-normal text-emerald-600">
                              可用
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-stone-400">{t.desc}</span>
                        {(usageMap[t.id] ?? 0) > 0 && (
                          <span className="mt-1 inline-block rounded bg-stone-100 px-1 py-px text-[9.5px] text-stone-400">
                            已用 {usageMap[t.id]} 次
                          </span>
                        )}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFav(t.id);
                        }}
                        title={favs.includes(t.id) ? "取消收藏" : "加入常用收藏"}
                        className={`absolute right-3 top-3 rounded-lg p-1 transition ${
                          favs.includes(t.id)
                            ? "text-amber-400"
                            : "text-stone-300 opacity-0 hover:text-stone-500 group-hover:opacity-100"
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${favs.includes(t.id) ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <ToolRunnerModal
        tool={active}
        onClose={() => setActive(null)}
        onHandoff={(target, text) => setHandoff({ toolId: target.id, text })}
      />
      <Toaster />
    </div>
  );
}
