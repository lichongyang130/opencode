/** 深度研究 —— 数据结构 */

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  /** demo 模式下为模拟来源 */
  demo?: boolean;
  /** RS3: Tavily 相关度得分（0~1），来源排序与可信度提示用 */
  score?: number;
  /** RS9: 归一化域名（去重与同源合并的键，浏览器端可信度提示也用它） */
  domain?: string;
}

export interface ResearchReport {
  topic: string;
  /** 简短执行摘要 */
  summary: string;
  /** 分节内容（markdown 风格纯文本，引用用 [n] 角标） */
  sections: { heading: string; body: string }[];
  /** 关键结论/要点 */
  takeaways: string[];
  sources: ResearchSource[];
  demo?: boolean;
  /** RS6: 综述失败但保留了检索来源与原文拼装的半成品标记 */
  partial?: boolean;
  createdAt: number;
}

/** RS5: 研究深度。影响检索轮次与每轮来源数 */
export type ResearchDepth = "quick" | "standard" | "deep";

export const DEPTH_PRESETS: Record<
  ResearchDepth,
  { queries: number; perQuery: number; label: string }
> = {
  quick: { queries: 1, perQuery: 4, label: "快速（1 轮 · 4 条来源）" },
  standard: { queries: 3, perQuery: 6, label: "标准（3 轮 · 每轮 6 条）" },
  deep: { queries: 5, perQuery: 8, label: "深度（5 轮 · 每轮 8 条）" },
};

/** RS8: 输出语言白名单 */
export const RESEARCH_LANGUAGES = ["zh", "en", "ja"] as const;
export type ResearchLanguage = (typeof RESEARCH_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<ResearchLanguage, string> = {
  zh: "中文",
  en: "English",
  ja: "日本語",
};

/** RS1: 研究阶段（结构化进度，前端时间线按序点亮） */
export type ResearchStage = "plan" | "search" | "read" | "write";

export const STAGE_LABELS: Record<ResearchStage, string> = {
  plan: "规划",
  search: "检索",
  read: "阅读",
  write: "撰写",
};

/** 进度回调负载：stage 缺省时保持旧纯文本行为（向后兼容） */
export interface ResearchProgress {
  stage?: ResearchStage;
  message: string;
}

export type ResearchEvent =
  | { type: "status"; message: string; stage?: ResearchStage }
  | { type: "report"; report: ResearchReport }
  | { type: "error"; message: string };
