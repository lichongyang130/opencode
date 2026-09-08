"use client";

import { Trash2, X } from "lucide-react";
import { docStats, formatSize, QUOTA_GB, removeDocument, type DocRow } from "@/lib/documents";
import { toast } from "@/lib/store/toast";

const TYPE_META: Array<{ key: DocRow["type"]; label: string; color: string }> = [
  { key: "word", label: "Word 文档", color: "bg-sky-400" },
  { key: "pdf", label: "PDF 文件", color: "bg-red-400" },
  { key: "ppt", label: "演示文稿", color: "bg-orange-400" },
  { key: "excel", label: "表格文件", color: "bg-emerald-400" },
  { key: "image", label: "图片文件", color: "bg-amber-300" },
  { key: "text", label: "文本文件", color: "bg-stone-300" },
];

/** 管理存储空间：真实统计 + 清理操作 */
export function StorageModal({
  docs,
  onChange,
  onClose,
}: {
  docs: DocRow[];
  onChange: () => void;
  onClose: () => void;
}) {
  const stats = docStats(docs);
  const percent = Math.min(100, (stats.sizeGb / QUOTA_GB) * 100);
  const trash = docs.filter((d) => d.trashed);
  const trashKb = trash.reduce((a, d) => a + d.sizeKb, 0);
  const largest = [...docs.filter((d) => !d.trashed)].sort((a, b) => b.sizeKb - a.sizeKb).slice(0, 5);

  const emptyTrash = () => {
    if (trash.length === 0) return;
    for (const d of trash) removeDocument(d.id);
    onChange();
    toast(`已清空回收站，释放 ${formatSize(trashKb)}`, "success");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-stone-800">管理存储空间</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-[#ece6db] bg-[#fbf8f4] p-4">
          <p className="text-[12px] text-stone-400">已使用</p>
          <p className="mt-0.5 text-[22px] font-bold text-stone-800">
            {stats.sizeGb.toFixed(2)} GB
            <span className="ml-1 text-[12px] font-normal text-stone-400">/ {QUOTA_GB} GB</span>
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(1, percent)}%` }} />
          </div>
          <p className="mt-1.5 text-[11.5px] text-stone-400">
            共 {stats.total} 个文档，占比 {percent.toFixed(1)}%
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {TYPE_META.map((t) => {
            const kb = stats.byType[t.key] ?? 0;
            const pct = stats.sizeKb ? (kb / stats.sizeKb) * 100 : 0;
            return (
              <div key={t.key}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-1.5 text-stone-600">
                    <span className={`h-2.5 w-2.5 rounded-full ${t.color}`} />
                    {t.label}
                  </span>
                  <span className="text-stone-500">
                    {formatSize(kb)} · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-full rounded-full ${t.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {largest.length > 0 && (
          <div className="mt-5">
            <p className="text-[13px] font-semibold text-stone-800">占用最大的文件</p>
            <div className="mt-2 space-y-1">
              {largest.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-[#fdfaf5]">
                  <span className="min-w-0 flex-1 truncate text-stone-700">{d.name}</span>
                  <span className="shrink-0 text-stone-400">{formatSize(d.sizeKb)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between rounded-xl border border-[#ece6db] px-3 py-3">
          <div>
            <p className="text-[12.5px] font-medium text-stone-700">回收站</p>
            <p className="text-[11px] text-stone-400">
              {trash.length} 个文件 · 占用 {formatSize(trashKb)}
            </p>
          </div>
          <button
            onClick={emptyTrash}
            disabled={trash.length === 0}
            className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-[12px] text-red-500 transition hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> 彻底清空
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-5 text-stone-400">
          统计基于本机文档库（含上传时记录的真实大小）。
        </p>
      </div>
    </div>
  );
}
