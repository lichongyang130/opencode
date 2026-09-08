"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { KbOwner, KbRow } from "@/lib/knowledge";

const OWNER_LABEL: Record<KbOwner, string> = { me: "我的知识库", shared: "共享给我", team: "团队知识库" };

/** 新建 / 编辑知识库 */
export function KbFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial: KbRow | null;
  onClose: () => void;
  onSave: (input: { name: string; desc: string; tags: string[]; owner: KbOwner }) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState("");
  const [owner, setOwner] = useState<KbOwner>("me");

  useEffect(() => {
    setName(initial?.name ?? "");
    setDesc(initial?.desc ?? "");
    setTags(initial?.tags.join("、") ?? "");
    setOwner(initial?.owner ?? "me");
  }, [initial]);

  const canSave = name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-stone-800">
            {initial ? "管理知识库" : "新建知识库"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：产品文档库"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#e0b79c]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">描述</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="这个知识库放什么内容"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#e0b79c]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">标签（用、或逗号分隔）</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="产品、需求、PRD"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#e0b79c]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">归属</label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value as KbOwner)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#e0b79c]"
            >
              {(Object.keys(OWNER_LABEL) as KbOwner[]).map((o) => (
                <option key={o} value={o}>
                  {OWNER_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            取消
          </button>
          <button
            disabled={!canSave}
            onClick={() =>
              onSave({
                name: name.trim(),
                desc: desc.trim(),
                tags: tags
                  .split(/[、,，\s]+/)
                  .map((t) => t.trim())
                  .filter(Boolean),
                owner,
              })
            }
            className="rounded-lg bg-gradient-to-r from-orange-400 to-red-500 px-4 py-2 text-sm font-medium text-white hover:brightness-105 disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
