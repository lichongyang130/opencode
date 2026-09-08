/** 幻灯片生成 —— 数据结构与主题类型 */

export type SlideLayout =
  | "cover" // 封面
  | "toc" // 目录
  | "content" // 标题 + 要点
  | "twoCol" // 左右双栏
  | "stats" // 关键数字
  | "timeline" // 时间轴（PPT5：阶段推进/里程碑）
  | "compare" // 左右对比（PPT5：方案 A vs B）
  | "process" // 流程（PPT5：步骤链）
  | "quote" // 引用（PPT5：金句/证言）
  | "team" // 团队（PPT5：成员卡片）
  | "end"; // 结束页

export interface Slide {
  layout: SlideLayout;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  /** twoCol：右栏要点 */
  bulletsRight?: string[];
  twoColTitle?: string;
  /** stats/team：数字卡片 [{value:"92%", label:"客户满意度"}] */
  stats?: { value: string; label: string }[];
  /** timeline/process：阶段/步骤数组，item = 阶段名，detail = 说明（复用 stats 结构语义不清晰，独立字段） */
  steps?: { item: string; detail?: string }[];
  /** compare：左侧方案要点（右侧复用 bulletsRight + twoColTitle 命名沿用双栏语义） */
  quote?: string;
  /** quote：署名 */
  quoteBy?: string;
  /** 图片提示词（PPT3：自动生成配图后填 imageUrl） */
  imagePrompt?: string;
  /** PPT3：配图 URL（生成后落位，渲染端优先于占位符显示） */
  imageUrl?: string;
  note?: string;
}

export interface SlideDeck {
  title: string;
  subtitle?: string;
  theme: ThemeId;
  slides: Slide[];
}

/** PPT8：主题市场在既有 5 套色板基础上扩充 */
export type ThemeId =
  | "violet"
  | "ocean"
  | "sunset"
  | "forest"
  | "ink"
  | "rose"
  | "amber"
  | "slate"
  | "midnight"
  | "emerald";

/** PPT1：大纲阶段的数据结构（先流式出可编辑大纲，确认后生成成稿） */
export interface SlideOutline {
  title: string;
  subtitle?: string;
  /** 每页一行：{layout, title}，用户可增删改顺序后再确认生成 */
  pages: { layout: SlideLayout; title: string; hint?: string }[];
}
