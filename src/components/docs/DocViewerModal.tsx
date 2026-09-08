"use client";

import { useEffect, useState } from "react";
import { useSseStream } from "@/hooks/useSseStream";
import { Copy, Download, History, Loader2, RotateCcw, Sparkles, Star, Trash2, X } from "lucide-react";
import { formatSize, relativeTime, restoreDocVersion, updateDocument, type DocRow } from "@/lib/documents";
import { downloadMarkdown, downloadWord } from "@/lib/docs/export";
import { toast } from "@/lib/store/toast";

const TYPE_LABEL: Record<string, string> = {
  word: "Word 文档",
  pdf: "PDF",
  excel: "表格",
  ppt: "演示文稿",
  image: "图片",
  text: "文本",
};

/** 文档详情 / 文本预览与编辑 / 导出 */
export function DocViewerModal({
  doc,
  folders,
  onChange,
  onClose,
}: {
  doc: DocRow | null;
  folders: string[];
  onChange: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const aiStream = useSseStream();
  const summary = aiStream.text;

  useEffect(() => {
    setName(doc?.name ?? "");
    setContent(doc?.content ?? "");
    setEditing(false);
    // summary 来自 aiStream.text，start() 自带清零；此处无需手动重置
    setShowVersions(false);
  }, [doc]);

  if (!doc) return null;

  /** AI 总结：走 /api/chat（SSE），汇总正文要点（AI15：SSE 读取收敛进 useSseStream） */
  const summarize = async () => {
    const text = (doc.content ?? "").trim();
    if (!text) {
      toast("文档没有正文可总结", "info");
      return;
    }
    setSummarizing(true);
    // summary 来自 aiStream.text，start() 自带清零；此处无需手动重置
    try {
      const acc = await aiStream.start({
        url: "/api/chat",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "demo",
          messages: [
            { role: "system", content: "你是文档总结助手。用中文输出简洁的要点总结，最多 6 条，每条一行，以 - 开头。" },
            { role: "user", content: `请总结以下文档的核心要点：\n\n${text.slice(0, 6000)}` },
          ],
        }),
      });
      if (!acc.trim()) throw new Error("未返回总结内容");
      toast("总结完成", "success");
    } catch (e) {
      toast(`总结失败：${e instanceof Error ? e.message : ""}`, "error");
    } finally {
      setSummarizing(false);
    }
  };

  const saveContent = () => {
    updateDocument(doc.id, { content });
    setEditing(false);
    onChange();
    toast("已保存", "success");
  };

  const saveName = () => {
    const n = name.trim();
    if (!n || n === doc.name) return;
    updateDocument(doc.id, { name: n });
    onChange();
    toast("已重命名", "success");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="文档预览"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="w-full truncate rounded-lg px-1 py-0.5 text-[15px] font-semibold text-stone-800 outline-none hover:bg-stone-50 focus:bg-stone-50"
            />
            <p className="mt-0.5 px-1 text-[11.5px] text-stone-400">
              {TYPE_LABEL[doc.type]} · {formatSize(doc.sizeKb)} · {doc.owner} · {relativeTime(doc.updatedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => {
                updateDocument(doc.id, { favorite: !doc.favorite });
                onChange();
                toast(doc.favorite ? "已取消收藏" : "已收藏", "success");
              }}
              title={doc.favorite ? "取消收藏" : "收藏"}
              className={`rounded-lg p-1.5 transition hover:bg-stone-100 ${doc.favorite ? "text-amber-400" : "text-stone-400"}`}
            >
              <Star className={`h-4 w-4 ${doc.favorite ? "fill-current" : ""}`} />
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="px-1 text-[12.5px] text-stone-500">{doc.desc}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-[12px]">
          <span className="text-stone-400">文件夹</span>
          <select
            value={doc.folder}
            onChange={(e) => {
              updateDocument(doc.id, { folder: e.target.value });
              onChange();
              toast(`已移动到「${e.target.value}」`, "success");
            }}
            className="rounded-lg border border-stone-200 px-2 py-1 text-stone-600 outline-none"
          >
            {[...new Set([doc.folder, ...folders])].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {doc.tags.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {doc.tags.map((t) => (
                <span key={t} className="rounded-md bg-[#fbf3ec] px-1.5 py-0.5 text-[11px] text-[#c05f3c]">
                  {t}
                </span>
              ))}
            </span>
          )}
        </div>

        {/* AI 总结 */}
        {(summary || summarizing) && (
          <div className="mx-1 mt-3 rounded-xl border border-[#e0b79c] bg-[#fdf1e3] p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-[#c05f3c]">
              <Sparkles className="h-3.5 w-3.5" /> AI 要点总结
            </p>
            <pre className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-6 text-stone-700">
              {summary || "正在总结…"}
            </pre>
          </div>
        )}

        {/* 历史版本 */}
        {(doc.versions?.length ?? 0) > 0 && (
          <div className="mx-1 mt-3 rounded-xl border border-stone-200">
            <button
              onClick={() => setShowVersions((v) => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-stone-600 transition hover:text-stone-800"
            >
              <History className="h-3.5 w-3.5" /> 历史版本（{doc.versions?.length}）
            </button>
            {showVersions && (
              <div className="space-y-1 border-t border-stone-100 p-2">
                {doc.versions!.map((v, i) => (
                  <div key={v.at} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] hover:bg-stone-50">
                    <span className="min-w-0 flex-1 truncate text-stone-500">
                      {relativeTime(v.at)} · {(v.content.length / 1000).toFixed(1)}k 字
                    </span>
                    <button
                      onClick={() => {
                        restoreDocVersion(doc.id, i);
                        onChange();
                        toast("已还原到该版本（当前正文已自动留档）", "success");
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-stone-200 px-2 py-0.5 text-[11px] text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                    >
                      <RotateCcw className="h-3 w-3" /> 还原
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 正文 */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {doc.content !== undefined ? (
            editing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 font-mono text-[12.5px] leading-6 outline-none focus:border-[#e0b79c]"
              />
            ) : (
              <pre className="whitespace-pre-wrap rounded-xl border border-stone-100 bg-[#fbf8f4] p-3.5 text-[12.5px] leading-6 text-stone-700">
                {doc.content || "（空文件）"}
              </pre>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center">
              <p className="text-[13px] text-stone-500">该文件类型暂不支持在线预览正文</p>
              <p className="text-[11.5px] text-stone-400">
                上传 .md / .txt / .csv / .json 等文本文件即可在此查看与编辑
              </p>
            </div>
          )}
        </div>

        {/* 操作 */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {doc.content !== undefined && (
              <>
                {editing ? (
                  <button
                    onClick={saveContent}
                    className="rounded-lg bg-stone-800 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-stone-900"
                  >
                    保存修改
                  </button>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-lg border border-stone-200 px-3.5 py-2 text-[12.5px] text-stone-600 hover:bg-stone-50"
                  >
                    编辑正文
                  </button>
                )}
                <button
                  onClick={() => void summarize()}
                  disabled={summarizing}
                  title="AI 提取本文要点"
                  className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-400 to-red-500 px-3 py-2 text-[12.5px] font-medium text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
                >
                  {summarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  AI 总结
                </button>
                <button
                  onClick={() => {
                    downloadWord(doc.name.replace(/\.[^.]+$/, ""), doc.content ?? "");
                    toast("已导出 Word", "success");
                  }}
                  className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-[12.5px] text-stone-600 hover:bg-stone-50"
                >
                  <Download className="h-3.5 w-3.5" /> Word
                </button>
                <button
                  onClick={() => {
                    downloadMarkdown(doc.name.replace(/\.[^.]+$/, ""), doc.content ?? "");
                    toast("已导出 Markdown", "success");
                  }}
                  className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-[12.5px] text-stone-600 hover:bg-stone-50"
                >
                  <Download className="h-3.5 w-3.5" /> MD
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(doc.content ?? "").then(
                      () => toast("已复制正文", "success"),
                      () => toast("复制失败", "error")
                    );
                  }}
                  className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-[12.5px] text-stone-600 hover:bg-stone-50"
                >
                  <Copy className="h-3.5 w-3.5" /> 复制
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => {
              updateDocument(doc.id, { trashed: true });
              onChange();
              onClose();
              toast("已移入回收站", "info");
            }}
            className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-[12.5px] text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </button>
        </div>
      </div>
    </div>
  );
}
