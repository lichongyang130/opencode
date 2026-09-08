"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Template, TemplateCategory } from "./templates";
import type { WorkspaceMode } from "./store/chat";

export interface CustomPrompt extends Template {
  builtin?: boolean;
}

interface PromptState {
  /** 收藏的内置模板 id */
  favorites: string[];
  /** 用户自建提示词 */
  custom: CustomPrompt[];
  /** 最近使用的模板 id（最多 12 个） */
  recent: string[];
  toggleFavorite: (id: string) => void;
  addCustom: (p: Omit<CustomPrompt, "id" | "builtin">) => string;
  removeCustom: (id: string) => void;
  markUsed: (id: string) => void;
  isFavorite: (id: string) => boolean;
  /** 批量导入自建提示词，返回导入条数 */
  importCustom: (list: Array<Omit<CustomPrompt, "id" | "builtin">>) => number;
}

/** 导出/分享用的数据结构 */
export interface PromptExport {
  app: "opencanvas-prompts";
  version: 1;
  exportedAt: number;
  prompts: Array<Omit<CustomPrompt, "id" | "builtin">>;
}

/** 序列化为分享码（base64 JSON，中文安全） */
export function encodePrompts(prompts: Array<Omit<CustomPrompt, "id" | "builtin">>): string {
  const data: PromptExport = {
    app: "opencanvas-prompts",
    version: 1,
    exportedAt: Date.now(),
    prompts,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

/** 解析分享码/导入文件，失败返回 null */
export function decodePrompts(code: string): PromptExport | null {
  try {
    let s = code.trim();
    // 容忍用户粘贴 JSON 全文
    if (s.startsWith("{")) {
      const obj = JSON.parse(s) as PromptExport;
      return obj.app === "opencanvas-prompts" ? obj : null;
    }
    // 去掉可能的 URL 前缀
    s = s.replace(/^.*#/, "").replace(/\s/g, "");
    const obj = JSON.parse(decodeURIComponent(escape(atob(s)))) as PromptExport;
    return obj.app === "opencanvas-prompts" ? obj : null;
  } catch {
    return null;
  }
}

let seq = 0;

export const usePromptStore = create<PromptState>()(
  persist(
    (set, get) => ({
      favorites: [],
      custom: [],
      recent: [],
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((x) => x !== id)
            : [...s.favorites, id],
        })),
      addCustom: (p) => {
        const id = `custom-${Date.now()}-${seq++}`;
        set((s) => ({ custom: [{ ...p, id, builtin: false }, ...s.custom] }));
        return id;
      },
      removeCustom: (id) => set((s) => ({ custom: s.custom.filter((x) => x.id !== id) })),
      markUsed: (id) =>
        set((s) => ({
          recent: [id, ...s.recent.filter((x) => x !== id)].slice(0, 12),
        })),
      isFavorite: (id) => get().favorites.includes(id),
      importCustom: (list) => {
        const valid = list.filter(
          (p) => p && typeof p.label === "string" && typeof p.prompt === "string" && p.prompt.trim()
        );
        if (valid.length === 0) return 0;
        const stamped = valid.map((p) => ({
          ...p,
          label: p.label.trim(),
          prompt: p.prompt,
          builtin: false as const,
          id: `custom-${Date.now()}-${seq++}`,
        }));
        set((s) => ({ custom: [...stamped, ...s.custom] }));
        return stamped.length;
      },
    }),
    { name: "opencanvas.prompts.v1" }
  )
);

export const NEW_PROMPT_CATEGORY = "productivity" as TemplateCategory;
export type { WorkspaceMode };
