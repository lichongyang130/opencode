"use client";

import { Copy, X } from "lucide-react";
import type { KbDoc } from "@/lib/knowledge";
import { toast } from "@/lib/store/toast";

/** 文档详情：真实展示文件名、大小、更新时间与已保存的正文片段 */
export function DocDetailModal({
  doc,
  kbName,
  onClose,
}: {
  doc: KbDoc | null;
  kbName: string;
  onClose: () => void;
}) {
  if (!doc) return null;
  const size = doc.sizeKb >= 1024 ? `${(doc.sizeKb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(doc.sizeKb))} KB`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-stone-800">{doc.name}</h3>
            <p className="mt-0.5 text-[11.5px] text-stone-400">所属：{kbName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="grid grid-cols-3 gap-3 rounded-xl border border-[#ece6db] bg-[#fbf8f4] p-3 text-center">
          <div>
            <dt className="text-[11px] text-stone-400">大小</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-stone-700">{size}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-stone-400">更新时间</dt>
            <dd className="mt-0.5 truncate text-[13px] font-medium text-stone-700">{doc.updatedAt}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-stone-400">格式</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-stone-700">
              {doc.name.split(".").pop()?.toUpperCase() ?? "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-3">
          <p className="mb-1.5 text-[11.5px] text-stone-500">正文片段</p>
          {doc.excerpt ? (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-3 text-[12.5px] leading-6 text-stone-700">
              {doc.excerpt}
            </pre>
          ) : (
            <p className="rounded-xl border border-dashed border-stone-200 px-3 py-6 text-center text-[12px] text-stone-400">
              该文档只记录了文件名与大小（未上传正文）。
              <br />
              可在「查看全部文档」里粘贴正文内容保存。
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(doc.excerpt ?? doc.name).then(
                () => toast("已复制", "success"),
                () => toast("复制失败", "error")
              );
            }}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3.5 py-2 text-[12.5px] text-stone-600 hover:bg-stone-50"
          >
            <Copy className="h-3.5 w-3.5" /> 复制内容
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-stone-800 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-stone-900"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
