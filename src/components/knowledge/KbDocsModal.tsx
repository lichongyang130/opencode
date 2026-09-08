"use client";

import { useRef, useState } from "react";
import { FileText, Globe, Loader2, Trash2, Upload, X } from "lucide-react";
import { addDoc, docStatus, removeDoc, type KbDoc, type KbRow } from "@/lib/knowledge";
import { toast } from "@/lib/store/toast";

function fmtSize(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(kb))} KB`;
}

/** 文档处理状态徽章：新入库文档先向量化，之后显示就绪 */
function StatusBadge({ doc }: { doc: KbDoc }) {
  const ready = docStatus(doc) === "ready";
  return ready ? (
    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[9.5px] font-medium text-emerald-600">
      已就绪
    </span>
  ) : (
    <span className="shrink-0 animate-pulse rounded-full bg-amber-50 px-1.5 py-px text-[9.5px] font-medium text-amber-600">
      向量化中…
    </span>
  );
}

/** 知识库文档：查看全部 / 上传 / URL 导入 / 删除 */
export function KbDocsModal({
  kb,
  onClose,
  onChange,
  onOpenDoc,
}: {
  kb: KbRow;
  onClose: () => void;
  onChange: () => void;
  onOpenDoc: (doc: KbDoc) => void;
}) {
  const [paste, setPaste] = useState("");
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      addDoc(kb.id, { name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) });
    }
    onChange();
    toast(`已添加 ${files.length} 个文档，正在向量化`, "success");
  };

  /** URL 抓取入库：服务端拉取网页并去标签提取正文 */
  const importUrl = async () => {
    const u = url.trim();
    if (!u) return;
    setImporting(true);
    try {
      const res = await fetch("/api/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = (await res.json()) as { title?: string; text?: string; bytes?: number; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? "抓取失败");
      addDoc(kb.id, {
        name: `${data.title}.txt`,
        sizeKb: Math.max(1, Math.round((data.bytes ?? 0) / 1024)),
        excerpt: data.text.slice(0, 200),
      });
      setUrl("");
      onChange();
      toast(`已导入《${data.title}》，正在向量化`, "success");
    } catch (e) {
      toast(`导入失败：${e instanceof Error ? e.message : ""}`, "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="知识库文档"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-stone-800">{kb.name} · 文档</h3>
            <p className="mt-0.5 text-[11.5px] text-stone-400">共 {kb.docs.length} 个（总库 {kb.count} 个）</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 上传 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-[#e0b79c] px-3 py-2 text-[12.5px] text-[#c05f3c] transition hover:bg-[#fdeee1]"
          >
            <Upload className="h-3.5 w-3.5" /> 上传文档
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
          <span className="text-[11px] text-stone-400">文件名与大小会真实记录（内容不上传服务器）</span>
        </div>

        {/* URL 导入 */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-stone-200 px-2.5 py-1.5">
            <Globe className="h-3.5 w-3.5 shrink-0 text-stone-400" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void importUrl();
              }}
              placeholder="https://… 粘贴网页链接，自动抓取正文入库"
              className="w-full bg-transparent text-[12px] outline-none placeholder:text-stone-400"
            />
          </div>
          <button
            onClick={() => void importUrl()}
            disabled={importing || !url.trim()}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-[12px] text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c] disabled:opacity-40"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            导入
          </button>
        </div>

        {/* 列表 */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {kb.docs.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-400">还没有文档，先上传或粘贴一段内容</p>
          ) : (
            <div className="space-y-1">
              {kb.docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[#fdfaf5]">
                  <button onClick={() => onOpenDoc(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-stone-700">{d.name}</span>
                      <span className="block text-[10.5px] text-stone-400">
                        {fmtSize(d.sizeKb)} · {d.updatedAt}
                      </span>
                    </span>
                    <StatusBadge doc={d} />
                  </button>
                  <button
                    onClick={() => {
                      removeDoc(kb.id, d.id);
                      onChange();
                      toast("已删除文档", "info");
                    }}
                    title="删除"
                    className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 粘贴内容 */}
        <div className="mt-3 border-t border-stone-100 pt-3">
          <p className="mb-1.5 text-[11.5px] text-stone-500">或粘贴一段正文，存为文本文档</p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={3}
            placeholder="粘贴内容…"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12.5px] outline-none focus:border-[#e0b79c]"
          />
          <button
            disabled={!paste.trim()}
            onClick={() => {
              const name = `粘贴内容-${new Date().toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}.txt`;
              addDoc(kb.id, { name, sizeKb: Math.max(1, Math.round(paste.length / 1024)), excerpt: paste });
              setPaste("");
              onChange();
              toast("已存为文本文档", "success");
            }}
            className="mt-2 w-full rounded-lg bg-stone-800 py-2 text-[12.5px] font-medium text-white transition hover:bg-stone-900 disabled:opacity-40"
          >
            存为文档
          </button>
        </div>
      </div>
    </div>
  );
}
