"use client";

/**
 * 文档中心本地数据层（localStorage 持久化）。
 * 记录真实文件名、真实大小、类型、收藏、文件夹、回收站与可预览的正文（文本类）。
 */

import { readJSON, readRaw, writeJSON } from "@/lib/safe-storage";

export type DocType = "word" | "pdf" | "excel" | "ppt" | "image" | "text";

export interface DocVersion {
  /** 该版本保存时间（即被覆盖的时间） */
  at: string;
  content: string;
}

export interface DocRow {
  id: string;
  name: string;
  desc: string;
  owner: string;
  tags: string[];
  /** 文件大小（KB） */
  sizeKb: number;
  type: DocType;
  favorite: boolean;
  folder: string;
  /** ISO 时间串，用于排序与展示 */
  updatedAt: string;
  /** 回收站标记 */
  trashed?: boolean;
  /** 文本类文档的正文（可直接预览/编辑） */
  content?: string;
  /** 历史版本（正文每次被修改前自动留档，最多 5 份） */
  versions?: DocVersion[];
}

export interface Folder {
  id: string;
  name: string;
}

const DOC_KEY = "oc:docs.v1";
const FOLDER_KEY = "oc:doc-folders.v1";

/** 文本类文件：可读取正文并预览 */
const TEXT_EXT = ["md", "txt", "csv", "json", "log", "yaml", "yml"];

export function typeOfName(name: string): DocType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["doc", "docx", "rtf", "odt"].includes(ext)) return "word";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv", "numbers"].includes(ext)) return "excel";
  if (["ppt", "pptx", "key"].includes(ext)) return "ppt";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(ext)) return "image";
  return "text";
}

export function isTextFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXT.includes(ext);
}

export function formatSize(kb: number) {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(2)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(kb))} KB`;
}

/** 相对时间：今天 / 昨天 / 具体日期 */
export function relativeTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 864e5).toDateString() === d.toDateString();
  if (sameDay) return `今天 ${d.toTimeString().slice(0, 5)}`;
  if (yesterday) return `昨天 ${d.toTimeString().slice(0, 5)}`;
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${d.toTimeString().slice(0, 5)}`;
}

const SEED_ROWS: Array<Omit<DocRow, "id" | "updatedAt">> = [
  { name: "产品需求分析报告.docx", desc: "详细的产品需求分析和竞品文档", owner: "Alex Chen", tags: ["产品"], sizeKb: 2458, type: "word", favorite: true, folder: "产品" },
  { name: "竞品调研报告.pdf", desc: "市场竞品分析和对比研究报告", owner: "张晓明", tags: ["市场", "竞品"], sizeKb: 1843, type: "pdf", favorite: false, folder: "市场" },
  { name: "用户需求统计.xlsx", desc: "用户需求收集和统计分析表格", owner: "李若雪", tags: ["用户研究"], sizeKb: 856, type: "excel", favorite: false, folder: "产品" },
  { name: "产品演示文档.pptx", desc: "产品功能演示和方案介绍", owner: "王浩", tags: ["演示"], sizeKb: 5325, type: "ppt", favorite: false, folder: "产品" },
  { name: "PRD产品需求文档.docx", desc: "产品需求文档 PRD v2.0 版本", owner: "Alex Chen", tags: ["产品", "PRD"], sizeKb: 3174, type: "word", favorite: true, folder: "产品" },
  { name: "设计规范文档.pdf", desc: "产品设计规范和组件使用说明", owner: "陈思思", tags: ["设计"], sizeKb: 4813, type: "pdf", favorite: false, folder: "设计" },
  { name: "项目进度跟踪表.xlsx", desc: "项目进度计划和实际完成情况跟踪", owner: "张晓明", tags: ["项目管理"], sizeKb: 1229, type: "excel", favorite: false, folder: "管理" },
  { name: "会议纪要_产品评审会.docx", desc: "产品评审会议纪要和决议事项", owner: "李若雪", tags: ["会议记录", "评审"], sizeKb: 766, type: "word", favorite: true, folder: "管理" },
  { name: "营销活动策划案.pptx", desc: "季度营销活动策划与执行计划", owner: "王浩", tags: ["营销"], sizeKb: 6963, type: "ppt", favorite: false, folder: "市场" },
  { name: "用户反馈汇总.csv", desc: "各渠道用户反馈数据汇总", owner: "李若雪", tags: ["用户研究"], sizeKb: 420, type: "excel", favorite: false, folder: "产品", content: "来源,反馈,数量\n应用商店,希望支持深色模式,128\n客服工单,导出速度慢,64\n问卷,定价偏高,37\n" },
  { name: "产品发布说明.md", desc: "v2.0 版本发布说明与更新清单", owner: "Alex Chen", tags: ["产品", "发布"], sizeKb: 12, type: "text", favorite: false, folder: "产品", content: "# v2.0 发布说明\n\n## 新增\n- 深度研究报告（含引用来源）\n- PPT 一键生成与 PPTX 导出\n\n## 优化\n- 对话流式输出更稳定\n- 画布可手动收起\n" },
];

const SEED_FOLDERS: Folder[] = [
  { id: "f-product", name: "产品" },
  { id: "f-market", name: "市场" },
  { id: "f-design", name: "设计" },
  { id: "f-manage", name: "管理" },
];

function readDocs(): DocRow[] {
  const saved = readJSON<DocRow[] | null>(DOC_KEY, null);
  if (Array.isArray(saved)) return saved;
  const now = Date.now();
  const seed: DocRow[] = SEED_ROWS.map((r, i) => ({
    ...r,
    id: `d${i + 1}`,
    updatedAt: new Date(now - i * 36e5 * 9).toISOString(),
  }));
  writeDocs(seed);
  if (readRaw(FOLDER_KEY) === null) writeFolders(SEED_FOLDERS);
  return seed;
}

function writeDocs(list: DocRow[]) {
  writeJSON(DOC_KEY, list);
}

export function loadDocuments(): DocRow[] {
  return readDocs();
}

export function loadFolders(): Folder[] {
  const list = readJSON<Folder[] | null>(FOLDER_KEY, null);
  return Array.isArray(list) ? list : SEED_FOLDERS.slice();
}

function writeFolders(list: Folder[]) {
  writeJSON(FOLDER_KEY, list);
}

export function createFolder(name: string): Folder | null {
  const n = name.trim();
  if (!n) return null;
  const list = loadFolders();
  if (list.some((f) => f.name === n)) return null;
  const folder = { id: `f-${Date.now()}`, name: n };
  writeFolders([...list, folder]);
  return folder;
}

export function removeFolder(id: string) {
  writeFolders(loadFolders().filter((f) => f.id !== id));
  const docs = readDocs().map((d) => (d.folder === folderNameById(id) ? { ...d, folder: "未整理" } : d));
  writeDocs(docs);
}

function folderNameById(id: string) {
  return loadFolders().find((f) => f.id === id)?.name ?? "";
}

export function addDocument(input: {
  name: string;
  sizeKb: number;
  owner?: string;
  desc?: string;
  tags?: string[];
  folder?: string;
  content?: string;
}): DocRow {
  const row: DocRow = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name,
    desc: input.desc?.trim() || "—",
    owner: input.owner ?? "Alex Chen",
    tags: input.tags ?? [],
    sizeKb: Math.max(1, Math.round(input.sizeKb)),
    type: typeOfName(input.name),
    favorite: false,
    folder: input.folder ?? "未整理",
    updatedAt: new Date().toISOString(),
    content: input.content,
  };
  const list = readDocs();
  writeDocs([row, ...list]);
  return row;
}

export function updateDocument(id: string, patch: Partial<DocRow>): DocRow | null {
  const list = readDocs();
  const idx = list.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const old = list[idx];
  const next: DocRow = { ...old, ...patch, updatedAt: new Date().toISOString() };
  // 正文变化时自动留档旧版本（最多保留 5 份）
  if (patch.content !== undefined && patch.content !== (old.content ?? "")) {
    const versions = [
      { at: new Date().toISOString(), content: old.content ?? "" },
      ...(old.versions ?? []),
    ].slice(0, 5);
    next.versions = versions;
  }
  list[idx] = next;
  writeDocs(list);
  return next;
}

/** 还原到指定历史版本（当前正文会先自动留档） */
export function restoreDocVersion(id: string, index: number): DocRow | null {
  const doc = readDocs().find((d) => d.id === id);
  const v = doc?.versions?.[index];
  if (!doc || !v) return null;
  return updateDocument(id, { content: v.content });
}

export function removeDocument(id: string) {
  writeDocs(readDocs().filter((d) => d.id !== id));
}

/** 移入回收站（可还原） */
export function trashDocument(id: string) {
  updateDocument(id, { trashed: true });
}

export function restoreDocument(id: string) {
  updateDocument(id, { trashed: false });
}

export function toggleFavorite(id: string): boolean {
  const list = readDocs();
  const doc = list.find((d) => d.id === id);
  if (!doc) return false;
  updateDocument(id, { favorite: !doc.favorite });
  return !doc.favorite;
}

export function duplicateDocument(id: string): DocRow | null {
  const doc = readDocs().find((d) => d.id === id);
  if (!doc) return null;
  const name = doc.name.replace(/(\.[^.]+)?$/, (m) => `-副本${m ?? ""}`);
  return addDocument({
    name,
    sizeKb: doc.sizeKb,
    owner: doc.owner,
    desc: doc.desc,
    tags: doc.tags,
    folder: doc.folder,
    content: doc.content,
  });
}

export function docStats(list: DocRow[]) {
  const alive = list.filter((d) => !d.trashed);
  const sizeKb = alive.reduce((a, d) => a + d.sizeKb, 0);
  const byType: Record<DocType, number> = { word: 0, pdf: 0, excel: 0, ppt: 0, image: 0, text: 0 };
  for (const d of alive) byType[d.type] += d.sizeKb;
  return {
    total: alive.length,
    mine: alive.filter((d) => d.owner === "Alex Chen").length,
    team: alive.filter((d) => d.owner !== "Alex Chen").length,
    trashed: list.filter((d) => d.trashed).length,
    sizeKb,
    sizeGb: sizeKb / 1024 / 1024,
    byType,
  };
}

/** 10 GB 配额下的使用比例 */
export const QUOTA_GB = 10;
