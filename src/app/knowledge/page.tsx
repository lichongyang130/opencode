"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Folder,
  Info,
  MessageSquare,
  Search,
  Share2,
} from "lucide-react";
import { ShellSidebar } from "@/components/mockup/ShellSidebar";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import {
  loadAbilities,
  loadKnowledgeBases,
  saveAbilities,
  updateKnowledgeBase,
  type KbAbilities,
  type KbRow,
} from "@/lib/knowledge";
import { KbFormModal } from "@/components/knowledge/KbFormModal";
import { readJSON, writeJSON } from "@/lib/safe-storage";

const FAV_KEY = "oc:kb.fav";

const FOLDERS: Record<string, { name: string; count: number }[]> = {
  "kb-prod": [
    { name: "产品路线图 2024", count: 45 },
    { name: "PRD 文档库", count: 68 },
    { name: "竞品分析", count: 29 },
    { name: "用户研究", count: 22 },
  ],
  "kb-market": [
    { name: "行业白皮书", count: 31 },
    { name: "竞品对照", count: 24 },
    { name: "用户访谈", count: 18 },
  ],
  "kb-tech": [
    { name: "接口文档", count: 80 },
    { name: "组件规范", count: 42 },
    { name: "运维手册", count: 36 },
  ],
};

const MEMBERS = [
  { name: "李伟", src: "/cases/experts/a01.jpg" },
  { name: "张静", src: "/cases/experts/a02.jpg" },
  { name: "陈雷", src: "/cases/experts/a03.jpg" },
];

const MAIN_TABS = ["文档", "成员", "应用"] as const;

export default function KnowledgePage() {
  const [rows, setRows] = useState<KbRow[]>([]);
  const [selectedId, setSelectedId] = useState("kb-prod");
  const [mainTab, setMainTab] = useState<(typeof MAIN_TABS)[number]>("文档");
  const [q, setQ] = useState("");
  const [folderQ, setFolderQ] = useState("");
  const [abilities, setAbilities] = useState<KbAbilities>({ semantic: true, qa: true, cite: false });
  const [formOpen, setFormOpen] = useState(false);
  const [fav, setFav] = useState<string[]>([]);

  useEffect(() => {
    const list = loadKnowledgeBases();
    setRows(list);
    setSelectedId((id) => list.find((r) => r.id === id)?.id ?? list[0]?.id ?? "");
    setFav(readJSON<string[]>(FAV_KEY, []));
  }, []);

  useEffect(() => {
    if (selectedId) setAbilities(loadAbilities(selectedId));
  }, [selectedId]);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  const shown = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim().toLowerCase();
    return rows.filter((r) => `${r.name}${r.desc}${r.tags.join()}`.toLowerCase().includes(s));
  }, [rows, q]);

  const folders = (selected ? FOLDERS[selected.id] ?? selected.docs.map((d) => ({ name: d.name, count: 1 })) : []).filter(
    (f) => !folderQ.trim() || f.name.includes(folderQ.trim()),
  );

  const toggleFav = (id: string) => {
    const next = fav.includes(id) ? fav.filter((x) => x !== id) : [id, ...fav];
    setFav(next);
    writeJSON(FAV_KEY, next);
  };

  const toggleAbility = (key: keyof KbAbilities) => {
    if (!selected) return;
    const next = { ...abilities, [key]: !abilities[key] };
    setAbilities(next);
    saveAbilities(selected.id, next);
  };

  const share = async () => {
    if (!selected) return;
    try {
      const res = await fetch("/api/cases/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: `kb:${selected.id}`,
          label: selected.name,
          prompt: `【知识库】${selected.name}\n${selected.desc}`,
          source: "知识库",
        }),
      });
      const data = (await res.json()) as { code?: string };
      if (!res.ok || !data.code) throw new Error("分享失败");
      const url = `${window.location.origin}/s/${data.code}`;
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast("分享链接已复制", "success");
    } catch {
      toast("分享失败", "error");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f1e8] text-stone-800">
      <ShellSidebar active="knowledge" />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-6 border-b border-[#efe6d8] bg-[#fbf8f2] px-6 py-3">
          <div className="flex gap-5 text-[14px]">
            {MAIN_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMainTab(t)}
                className={`relative pb-1 ${mainTab === t ? "font-medium text-stone-900" : "text-stone-400"}`}
              >
                {t}
                {mainTab === t && <span className="absolute inset-x-0 -bottom-3 h-0.5 bg-[#c45c2a]" />}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-stone-200">
              <Search className="h-4 w-4 text-stone-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索" className="w-36 bg-transparent text-[13px] outline-none" />
            </div>
            <button type="button" className="rounded-full p-2 text-stone-400 hover:bg-white" aria-label="消息">
              <MessageSquare className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-full p-2 text-stone-400 hover:bg-white" aria-label="通知">
              <Bell className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cases/experts/a04.jpg" alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-[13px] text-stone-600">张三</span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
            {selected && (
              <>
                <div className="relative overflow-hidden rounded-[22px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.cover ?? "/knowledge/cover-product.jpg"}
                    alt=""
                    className="h-[220px] w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
                    <h1 className="text-[28px] font-bold drop-shadow">{selected.name}</h1>
                    <p className="mt-1 max-w-md text-[13px] text-white/90">{selected.desc}</p>
                    <button
                      type="button"
                      onClick={() => setFormOpen(true)}
                      className="mt-3 rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-stone-800"
                    >
                      管理
                    </button>
                  </div>
                </div>

                {mainTab === "文档" && (
                  <>
                    <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 ring-1 ring-stone-200">
                      <Search className="h-4 w-4 text-stone-400" />
                      <input
                        value={folderQ}
                        onChange={(e) => setFolderQ(e.target.value)}
                        placeholder={`搜索${selected.name}...`}
                        className="w-full bg-transparent text-[13px] outline-none"
                      />
                    </div>
                    <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/80">
                      {folders.length === 0 && <p className="px-4 py-10 text-center text-[13px] text-stone-400">没有匹配的文件夹</p>}
                      {folders.map((f) => (
                        <div key={f.name} className="flex items-center justify-between border-b border-stone-100 px-5 py-4 last:border-0">
                          <span className="flex items-center gap-3 text-[14px] text-stone-700">
                            <Folder className="h-5 w-5 text-stone-400" />
                            {f.name}
                          </span>
                          <span className="text-[13px] text-stone-400">{f.count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {mainTab === "成员" && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {MEMBERS.map((m) => (
                      <div key={m.name} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.src} alt="" className="h-10 w-10 rounded-full object-cover" />
                        <div>
                          <p className="text-[14px] font-medium">{m.name}</p>
                          <p className="text-[12px] text-stone-400">可编辑</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {mainTab === "应用" && (
                  <p className="mt-8 text-center text-[13px] text-stone-400">应用接入稍后开放。先用右侧增强功能。</p>
                )}
              </>
            )}
          </main>

          <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-[#efe6d8] bg-[#fbf8f2] px-5 py-5 xl:block">
            {selected ? (
              <>
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-700">
                  <Folder className="h-4 w-4" /> 知识库详情
                </p>
                <div className="mt-4 flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.cover ?? "/knowledge/cover-product.jpg"}
                    alt=""
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{selected.name}</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-stone-500">{selected.desc}</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 text-center">
                  <div>
                    <p className="text-[11px] text-stone-400">文档数量</p>
                    <p className="mt-1 text-[20px] font-bold">{selected.count}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-400">成员数</p>
                    <p className="mt-1 text-[20px] font-bold">{MEMBERS.length}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-400">更新时间</p>
                    <p className="mt-1 text-[16px] font-bold">3小时前</p>
                  </div>
                </div>
                <p className="mt-5 text-[12px] text-stone-400">标签</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(selected.tags?.length ? selected.tags : ["未分类"]).map((t) => (
                    <span key={t} className="rounded-md bg-[#f3e6d8] px-2 py-1 text-[11px] text-stone-600">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-[12px] text-stone-400">增强功能</p>
                <div className="mt-2 space-y-3">
                  {(
                    [
                      { key: "semantic" as const, label: "语义搜索" },
                      { key: "qa" as const, label: "问答增强" },
                    ]
                  ).map((a) => (
                    <div key={a.key} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[13px] text-stone-700">
                        <Search className="h-3.5 w-3.5 text-stone-400" />
                        {a.label}
                        <Info className="h-3 w-3 text-stone-300" />
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleAbility(a.key)}
                        className={`relative h-5 w-9 rounded-full ${abilities[a.key] ? "bg-[#e07a2f]" : "bg-stone-200"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${abilities[a.key] ? "right-0.5" : "left-0.5"}`} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-[12px] text-stone-400">成员</p>
                <div className="mt-2 flex items-center">
                  {MEMBERS.map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.name} src={m.src} alt={m.name} title={m.name} className="-ml-1 h-8 w-8 rounded-full border-2 border-white object-cover first:ml-0" />
                  ))}
                  <span className="ml-2 text-[12px] text-stone-500">{MEMBERS.map((m) => m.name).join("  ")}</span>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="flex-1 rounded-xl border border-stone-200 bg-white py-2 text-[13px] text-stone-700"
                  >
                    修改设置
                  </button>
                  <button type="button" onClick={() => void share()} className="flex-1 rounded-xl border border-stone-200 bg-white py-2 text-[13px] text-stone-700">
                    <span className="inline-flex items-center justify-center gap-1">
                      <Share2 className="h-3.5 w-3.5" /> 分享
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => selected && toggleFav(selected.id)}
                  className="mt-3 w-full text-center text-[12px] text-stone-400"
                >
                  {selected && fav.includes(selected.id) ? "已收藏" : "加入收藏"}
                </button>
              </>
            ) : (
              <p className="text-[13px] text-stone-400">选择一个知识库</p>
            )}
          </aside>
        </div>
      </div>

      {formOpen && selected && (
        <KbFormModal
          initial={selected}
          onClose={() => setFormOpen(false)}
          onSave={(input) => {
            updateKnowledgeBase(selected.id, input);
            setRows(loadKnowledgeBases());
            setFormOpen(false);
            toast("知识库已更新", "success");
          }}
        />
      )}
      <Toaster />
    </div>
  );
}
