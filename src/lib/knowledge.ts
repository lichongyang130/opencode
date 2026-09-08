"use client";

/**
 * 知识库本地数据层（localStorage 持久化）。
 * 浏览器端使用；提供种子数据、增删改、文档管理、能力设置与统计。
 * 后续可无缝替换为服务端 API。
 */

import { readJSON, writeJSON } from "@/lib/safe-storage";

export interface KbDoc {
  id: string;
  name: string;
  /** 文件大小（KB） */
  sizeKb: number;
  updatedAt: string;
  /** 可选正文/摘要片段（粘贴导入时保存） */
  excerpt?: string;
  /** 处理流水线状态：新入库文档先进入向量化，PROCESS_MS 后视为就绪 */
  status?: "processing" | "ready";
  addedAt?: number;
}

/** 新文档向量化模拟时长（毫秒），到期后按就绪处理 */
export const KB_PROCESS_MS = 6000;

export function docStatus(d: KbDoc): "processing" | "ready" {
  return d.status === "processing" && d.addedAt && Date.now() - d.addedAt < KB_PROCESS_MS
    ? "processing"
    : "ready";
}

export type KbOwner = "me" | "shared" | "team";

export interface KbAbilities {
  semantic: boolean;
  qa: boolean;
  cite: boolean;
}

export interface KbRow {
  id: string;
  name: string;
  desc: string;
  count: number;
  size: string;
  time: string;
  tint: string;
  sizeGb: number;
  tags: string[];
  updatedAt: string;
  /** 归属：我的 / 共享给我 / 团队 */
  owner: KbOwner;
  /** 最近更新的文档（真实可增删） */
  docs: KbDoc[];
  /** 协作权限：可编辑 / 仅查看 */
  perm?: "edit" | "view";
}

const KEY = "oc:knowledge-bases.v3";
const ABILITY_KEY = "oc:kb-abilities.v1";

/** 由文档名生成稳定伪大小，避免每次渲染数字乱跳 */
function pseudoSize(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 9973;
  return 120 + (h % 4800);
}

function makeDocs(names: string[]): KbDoc[] {
  return names.map((name, i) => ({
    id: `doc-${i + 1}-${name.length}-${Math.abs(pseudoSize(name))}`,
    name,
    sizeKb: pseudoSize(name),
    updatedAt: new Date(Date.now() - (i + 1) * 36e5 * 7).toLocaleString("zh-CN", { hour12: false }),
  }));
}

interface SeedDef {
  id: string;
  name: string;
  desc: string;
  count: number;
  tint: string;
  tags: string[];
  updatedAt: string;
  owner: KbOwner;
  docs: string[];
}

const SEED_DEF: SeedDef[] = [
  {
    id: "kb-prod",
    name: "产品文档库",
    desc: "包含产品需求文档、PRD、设计文档、产品说明等相关资料",
    count: 156,
    tint: "bg-sky-50 text-sky-600",
    tags: ["产品", "需求", "设计", "PRD"],
    updatedAt: "2024-01-15 16:30",
    owner: "me",
    docs: ["产品需求文档PRD v2.1", "用户体验设计规范", "产品功能清单 v1.3"],
  },
  {
    id: "kb-market",
    name: "市场调研资料",
    desc: "市场分析、竞品调研、行业报告等内容",
    count: 89,
    tint: "bg-emerald-50 text-emerald-600",
    tags: ["市场", "竞品", "行业"],
    updatedAt: "2024-02-02 10:12",
    owner: "team",
    docs: ["2024 行业白皮书", "竞品功能对比表", "用户访谈纪要"],
  },
  {
    id: "kb-tech",
    name: "技术知识库",
    desc: "技术文档、开发指南、API 文档等内容",
    count: 232,
    tint: "bg-violet-50 text-violet-600",
    tags: ["技术", "API", "开发"],
    updatedAt: "2024-03-05 09:50",
    owner: "me",
    docs: ["服务端接口文档", "前端组件规范", "部署与运维手册"],
  },
  {
    id: "kb-training",
    name: "培训资料库",
    desc: "培训课件、操作手册、学习资料等内容",
    count: 78,
    tint: "bg-orange-50 text-orange-600",
    tags: ["培训", "课程", "手册"],
    updatedAt: "2024-03-18 14:22",
    owner: "shared",
    docs: ["新人入职手册", "产品操作培训 PPT", "常见问题 FAQ"],
  },
  {
    id: "kb-policy",
    name: "公司制度文档",
    desc: "公司制度、流程规范、政策文件等内容",
    count: 45,
    tint: "bg-amber-50 text-amber-600",
    tags: ["制度", "流程", "政策"],
    updatedAt: "2024-04-01 09:00",
    owner: "team",
    docs: ["考勤与假期制度", "报销流程说明", "信息安全管理规范"],
  },
  {
    id: "kb-case",
    name: "客户案例库",
    desc: "成功案例、解决方案、客户反馈等内容",
    count: 127,
    tint: "bg-cyan-50 text-cyan-600",
    tags: ["案例", "交付", "反馈"],
    updatedAt: "2024-04-22 17:31",
    owner: "me",
    docs: ["零售行业解决方案", "制造业客户案例集", "客户满意度调研"],
  },
  {
    id: "kb-legal",
    name: "法务合同库",
    desc: "合同模板、合规文件、授权协议等内容",
    count: 64,
    tint: "bg-red-50 text-red-600",
    tags: ["合同", "法务", "合规"],
    updatedAt: "2024-05-06 13:40",
    owner: "shared",
    docs: ["标准服务合同模板", "数据处理协议", "授权书范本"],
  },
  {
    id: "kb-hr",
    name: "人力资源库",
    desc: "招聘、绩效、员工手册及 HR 制度文档",
    count: 92,
    tint: "bg-pink-50 text-pink-600",
    tags: ["招聘", "绩效", "HR"],
    updatedAt: "2024-05-20 15:00",
    owner: "team",
    docs: ["招聘面试指南", "绩效考核办法", "员工手册 v3"],
  },
  {
    id: "kb-finance",
    name: "财务制度库",
    desc: "预算、报销、税务及财务制度规范",
    count: 37,
    tint: "bg-lime-50 text-lime-600",
    tags: ["财务", "预算", "税务"],
    updatedAt: "2024-06-02 10:10",
    owner: "shared",
    docs: ["年度预算表", "费用报销标准", "税务合规指引"],
  },
  {
    id: "kb-marketing",
    name: "营销素材库",
    desc: "品牌素材、活动物料、社媒内容素材",
    count: 214,
    tint: "bg-fuchsia-50 text-fuchsia-600",
    tags: ["营销", "品牌", "素材"],
    updatedAt: "2024-06-15 12:35",
    owner: "me",
    docs: ["品牌视觉规范", "双十一活动物料", "社媒文案合集"],
  },
  {
    id: "kb-deploy",
    name: "交付资料库",
    desc: "项目交付物、验收文档、实施记录",
    count: 58,
    tint: "bg-teal-50 text-teal-600",
    tags: ["交付", "项目", "验收"],
    updatedAt: "2024-06-30 18:05",
    owner: "team",
    docs: ["项目验收报告", "实施排期表", "交付检查清单"],
  },
  {
    id: "kb-knowledge",
    name: "行业报告库",
    desc: "行业研究报告、白皮书、趋势分析",
    count: 176,
    tint: "bg-indigo-50 text-indigo-600",
    tags: ["报告", "行业", "白皮书"],
    updatedAt: "2024-07-10 09:20",
    owner: "shared",
    docs: ["AI 行业趋势报告", "出海市场研究", "年度技术展望"],
  },
];

function buildSeed(): KbRow[] {
  return SEED_DEF.map((d) => {
    // 容量按文档数估算（每篇 160~300KB 的文本类文档），与文档中心共用同一配额体系
    const avgKb = 160 + (pseudoSize(d.name) % 140);
    const sizeGb = (d.count * avgKb) / 1024 / 1024;
    return {
      id: d.id,
      name: d.name,
      desc: d.desc,
      count: d.count,
      size: sizeGb >= 1 ? `${sizeGb.toFixed(1)} GB` : `${Math.round(sizeGb * 1024)} MB`,
      time: d.updatedAt.slice(5, 16),
      tint: d.tint,
      sizeGb,
      tags: d.tags,
      updatedAt: d.updatedAt,
      owner: d.owner,
      docs: makeDocs(d.docs),
    };
  });
}

function read(): KbRow[] {
  const list = readJSON<KbRow[] | null>(KEY, null);
  if (Array.isArray(list)) {
    // 兼容旧数据：补齐新增字段
    return list.map((r) => ({
      ...r,
      owner: r.owner ?? "me",
      docs: r.docs ?? [],
      tags: r.tags ?? [],
    }));
  }
  const seed = buildSeed();
  write(seed);
  return seed;
}

function write(list: KbRow[]) {
  writeJSON(KEY, list);
}

const now = () => new Date().toLocaleString("zh-CN", { hour12: false });

export function loadKnowledgeBases(): KbRow[] {
  return read();
}

export function saveKnowledgeBase(row: KbRow) {
  const list = read();
  const idx = list.findIndex((r) => r.id === row.id);
  if (idx >= 0) list[idx] = row;
  else list.unshift(row);
  write(list);
}

export function removeKnowledgeBase(id: string) {
  write(read().filter((r) => r.id !== id));
}

export function createKnowledgeBase(input: {
  name: string;
  desc?: string;
  tags?: string[];
  owner?: KbOwner;
}): KbRow {
  const row: KbRow = {
    id: `kb-${Date.now()}`,
    name: input.name.trim() || "未命名知识库",
    desc: input.desc?.trim() || "新建知识库，等待上传文档与配置能力",
    count: 0,
    size: "0 B",
    time: "刚刚",
    tint: "bg-sky-50 text-sky-600",
    sizeGb: 0,
    tags: input.tags ?? [],
    updatedAt: now(),
    owner: input.owner ?? "me",
    docs: [],
  };
  saveKnowledgeBase(row);
  return row;
}

export function updateKnowledgeBase(
  id: string,
  patch: Partial<Pick<KbRow, "name" | "desc" | "tags" | "owner" | "perm">>
): KbRow | null {
  const list = read();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const next: KbRow = {
    ...list[idx],
    ...patch,
    updatedAt: now(),
    time: "刚刚",
  };
  list[idx] = next;
  write(list);
  return next;
}

/* ────────── 文档管理 ────────── */

export function addDoc(
  kbId: string,
  doc: { name: string; sizeKb?: number; excerpt?: string }
): KbDoc | null {
  const list = read();
  const idx = list.findIndex((r) => r.id === kbId);
  if (idx < 0) return null;
  const sizeKb = doc.sizeKb ?? 512;
  const newDoc: KbDoc = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: doc.name,
    sizeKb,
    updatedAt: now(),
    excerpt: doc.excerpt?.slice(0, 200) || undefined,
    status: "processing",
    addedAt: Date.now(),
  };
  const kb = list[idx];
  const count = kb.count + 1;
  const sizeGb = kb.sizeGb + sizeKb / 1024 / 1024;
  list[idx] = {
    ...kb,
    count,
    sizeGb,
    size: sizeGb >= 1 ? `${sizeGb.toFixed(1)} GB` : `${Math.round(sizeGb * 1024)} MB`,
    time: "刚刚",
    updatedAt: now(),
    docs: [newDoc, ...kb.docs],
  };
  write(list);
  return newDoc;
}

export function removeDoc(kbId: string, docId: string): boolean {
  const list = read();
  const idx = list.findIndex((r) => r.id === kbId);
  if (idx < 0) return false;
  const kb = list[idx];
  const doc = kb.docs.find((d) => d.id === docId);
  if (!doc) return false;
  const count = Math.max(0, kb.count - 1);
  const sizeGb = Math.max(0, kb.sizeGb - doc.sizeKb / 1024 / 1024);
  list[idx] = {
    ...kb,
    count,
    sizeGb,
    size: sizeGb >= 1 ? `${sizeGb.toFixed(1)} GB` : `${Math.round(sizeGb * 1024)} MB`,
    docs: kb.docs.filter((d) => d.id !== docId),
    time: "刚刚",
    updatedAt: now(),
  };
  write(list);
  return true;
}

/* ────────── 能力设置（按知识库持久化） ────────── */

const DEFAULT_ABILITIES: KbAbilities = { semantic: true, qa: true, cite: false };

export function loadAbilities(kbId: string): KbAbilities {
  const map = readJSON<Record<string, KbAbilities>>(ABILITY_KEY, {});
  return { ...DEFAULT_ABILITIES, ...(map[kbId] ?? {}) };
}

export function saveAbilities(kbId: string, abilities: KbAbilities) {
  const map = readJSON<Record<string, KbAbilities>>(ABILITY_KEY, {});
  map[kbId] = abilities;
  writeJSON(ABILITY_KEY, map);
}

/* ────────── 统计与工具 ────────── */

/** 向量条目数：按文档数 × 每篇切分 chunk 数（24~59，随库名稳定），全站统一口径 */
export function kbVectors(row: Pick<KbRow, "name" | "count">): number {
  const chunksPerDoc = 24 + (pseudoSize(row.name) % 36);
  return row.count * chunksPerDoc;
}

/** 向量条目数展示：千位以上用 K 单位 */
export function formatVectors(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function summarize(list: KbRow[]) {
  return {
    total: list.length,
    docs: list.reduce((a, r) => a + r.count, 0),
    vectors: list.reduce((a, r) => a + kbVectors(r), 0),
    sizeGb: list.reduce((a, r) => a + r.sizeGb, 0),
  };
}

export function allTags(list: KbRow[]): string[] {
  const set = new Set<string>();
  for (const r of list) for (const t of r.tags) set.add(t);
  return [...set];
}
