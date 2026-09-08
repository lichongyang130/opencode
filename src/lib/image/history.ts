/**
 * 绘图提示词历史（IMG6）。
 *
 * 记录每一次生成使用的完整参数（提示词 / 模型 / 尺寸 / 风格 / 负向词），
 * 供「用此参数再生成」一键复用。存在 localStorage 单独键，不碰会话库里的
 * UIImage —— 这样历史记录与产物生命周期解耦，也不会给入库图片增加冗余字段。
 */

import { readJSON, writeJSON, removeKey } from "@/lib/safe-storage";

export interface ImagePromptRecord {
  id: string;
  prompt: string;
  model: string;
  size: string;
  style?: string;
  negative?: string;
  createdAt: number;
}

const KEY = "opencanvas.image.prompt-history.v1";
const MAX = 20;

export function loadPromptHistory(): ImagePromptRecord[] {
  const list = readJSON<unknown>(KEY, []);
  if (!Array.isArray(list)) return [];
  // 脏记录清洗：缺 prompt 的历史没有复用价值，直接剔掉
  return list.filter(
    (r): r is ImagePromptRecord =>
      !!r && typeof r === "object" && typeof (r as ImagePromptRecord).prompt === "string"
  );
}

/** 追加一条历史：同参数去重（保留最近一次），超出上限裁掉最旧 */
export function pushPromptHistory(entry: Omit<ImagePromptRecord, "createdAt" | "id"> & { id?: string; createdAt?: number }): ImagePromptRecord[] {
  const record: ImagePromptRecord = {
    ...entry,
    id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: entry.createdAt ?? Date.now(),
  };
  const rest = loadPromptHistory().filter(
    (r) =>
      !(
        r.prompt === record.prompt &&
        r.model === record.model &&
        r.size === record.size &&
        r.style === record.style &&
        r.negative === record.negative
      )
  );
  const next = [record, ...rest].slice(0, MAX);
  writeJSON(KEY, next);
  return next;
}

export function clearPromptHistory(): void {
  removeKey(KEY);
}