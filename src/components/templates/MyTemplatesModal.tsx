"use client";

import { useState } from "react";
import { Download, FileText, Trash2, X } from "lucide-react";
import { CATEGORY_LABELS, MODE_LABEL_OF, type Template } from "@/lib/templates";
import { encodePrompts, usePromptStore } from "@/lib/prompt-store";
import { toast } from "@/lib/store/toast";

/** 我的模板：查看全部自建模板，可直接使用 / 删除 / 导出 */
export function MyTemplatesModal({
  onClose,
  onUse,
}: {
  onClose: () => void;
  onUse: (t: Template) => void;
}) {
  const custom = usePromptStore((s) => s.custom);
  const removeCustom = usePromptStore((s) => s.removeCustom);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const exportAll = () => {
    if (custom.length === 0) return;
    const code = encodePrompts(
      custom.map(({ id: _id, builtin: _b, cases: _c, ...rest }) => rest)
    );
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opencanvas-templates-${custom.length}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`已导出 ${custom.length} 个模板分享码`, "success");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-stone-800">
            <FileText className="h-4 w-4 text-[#c05f3c]" /> 我的模板（{custom.length}）
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={exportAll}
              disabled={custom.length === 0}
              title="导出为分享码文件"
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30"
            >
              <Download className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {custom.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-400">
              还没有自建模板，点右上角「提交模板」创建第一个
            </p>
          ) : (
            <div className="space-y-1">
              {custom.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#fdfaf5]"
                >
                  <button
                    onClick={() => onUse(t)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[13.5px] font-medium text-stone-700">
                      {t.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-stone-400">
                      {CATEGORY_LABELS[t.category]} · {MODE_LABEL_OF[t.mode]} · {t.desc}
                    </span>
                  </button>
                  {confirmId === t.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => {
                          removeCustom(t.id);
                          setConfirmId(null);
                          toast("已删除模板", "info");
                        }}
                        className="rounded-lg bg-red-500 px-2 py-1 text-[11px] text-white"
                      >
                        确认删除
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] text-stone-500"
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(t.id)}
                      title="删除模板"
                      className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] leading-5 text-stone-400">
          自建模板保存在本机浏览器（localStorage），导出的是分享码文本，可在提示词库「导入」中还原。
        </p>
      </div>
    </div>
  );
}
