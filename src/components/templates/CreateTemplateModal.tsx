"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  CATEGORIES,
  extractVariables,
  type Template,
  type TemplateCategory,
} from "@/lib/templates";
import type { WorkspaceMode } from "@/lib/store/chat";

const MODE_LABELS: Record<WorkspaceMode, string> = {
  chat: "AI 对话",
  research: "深度研究",
  slides: "PPT 生成",
  image: "图片设计",
  video: "视频创作",
  docs: "文档写作",
};

/** 新建模板：保存到本机（usePromptStore），后续可在「我的模板」里直接使用 */
export function CreateTemplateModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (p: Omit<Template, "id" | "builtin">) => void;
}) {
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("productivity");
  const [mode, setMode] = useState<WorkspaceMode>("chat");
  const [prompt, setPrompt] = useState("");

  const vars = extractVariables(prompt);
  const canSave = label.trim() && prompt.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-stone-800">
            <Plus className="h-4 w-4 text-[#c05f3c]" /> 提交模板
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">模板名称</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="如：小红书爆款标题"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#e0b79c]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">场景分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#e0b79c]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">使用的工作台</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as WorkspaceMode)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#e0b79c]"
              >
                {(Object.keys(MODE_LABELS) as WorkspaceMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">一句话说明</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="这个模板用来做什么"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#e0b79c]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">
              提示词内容（可用 {"{{变量名}}"} 作为填空）
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="例：为「{{产品}}」写 5 条小红书种草文案，每条含标题、正文和标签…"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#e0b79c]"
            />
            {vars.length > 0 && (
              <p className="mt-1.5 text-[11px] text-stone-400">
                检测到 {vars.length} 个变量：{vars.map((v) => `「${v}」`).join("、")}
                ，使用时需填写
              </p>
            )}
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
                label: label.trim(),
                desc: desc.trim() || "我的自定义模板",
                category,
                mode,
                prompt: prompt.trim(),
              })
            }
            className="rounded-lg bg-gradient-to-r from-orange-400 to-red-500 px-4 py-2 text-sm font-medium text-white hover:brightness-105 disabled:opacity-40"
          >
            保存模板
          </button>
        </div>
      </div>
    </div>
  );
}
