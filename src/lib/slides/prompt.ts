import type { SlideLayout, ThemeId } from "./types";

/**
 * 让 LLM 严格输出幻灯片 JSON 的系统提示词。
 * 只输出 JSON、不要 markdown 代码块、不要解释文字。
 */
export function buildSlidesPrompt(
  topic: string,
  context?: string
): { system: string; user: string } {
  const system = `你是专业的演示文稿设计助手。根据用户主题生成一套高质量中文 PPT 的结构化数据。

严格要求：
1. 只输出一个 JSON 对象，不要输出 markdown 代码块、不要任何解释或前后缀文字。
2. JSON 结构如下：
{
  "title": "演示标题",
  "subtitle": "可选副标题",
  "slides": [
    {"layout": "cover",   "title": "标题", "subtitle": "副标题"},
    {"layout": "toc",     "title": "目录", "bullets": ["章节1","章节2","章节3","章节4"]},
    {"layout": "content", "title": "页标题", "bullets": ["要点1","要点2","要点3"], "imagePrompt": "可选的英文配图描述"},
    {"layout": "twoCol",  "title": "页标题", "bullets": ["左栏要点"], "twoColTitle": "右栏标题", "bulletsRight": ["右栏要点"]},
    {"layout": "stats",   "title": "页标题", "stats": [{"value":"92%","label":"指标名"}]},
    {"layout": "timeline","title": "页标题", "steps": [{"item":"2024 Q1","detail":"里程碑说明"}]},
    {"layout": "compare", "title": "页标题", "bullets": ["方案A要点"], "twoColTitle": "方案 B", "bulletsRight": ["方案B要点"]},
    {"layout": "process", "title": "页标题", "steps": [{"item":"步骤名","detail":"说明"}]},
    {"layout": "quote",   "title": "金句标题", "quote": "引用正文", "quoteBy": "署名"},
    {"layout": "team",    "title": "团队介绍", "stats": [{"value":"姓名","label":"职位/一句话介绍"}]},
    {"layout": "end",     "title": "谢谢观看", "subtitle": "可选"}
  ]
}
3. 页数 8~12 页，必须以 cover 开头、end 结尾，中间合理使用 toc/content/twoCol/stats/timeline/compare/process/quote/team。
4. 每页要点 3~5 条，每条不超过 22 个汉字，信息密度高、可直接上屏。
5. stats 的 value 用简短有力的数字/百分比/金额；数据不确定时用合理示例并避免编造精确来源。
6. imagePrompt 用英文短语描述配图（主体+风格+色调），没有合适配图可省略。
7. note 字段可写演讲者备注（每页一句提词，可选）。
8. timeline 适合路线图/里程碑；compare 适合方案对比；process 适合操作步骤；quote 适合金句强调；team 适合团队介绍页（value 放姓名）。
9. 内容要专业、有洞察，符合商业演示标准。`;

  const user = context
    ? `请基于以下研究资料，为主题「${topic}」生成一份汇报 PPT，充分提炼资料中的数据与结论：\n\n${context}`
    : `请为以下主题生成 PPT：${topic}`;
  return { system, user };
}

/** PPT1：大纲先行阶段。只产出页面骨架（layout + 标题），用户确认后再生成成稿 */
export function buildOutlinePrompt(
  topic: string,
  context?: string
): { system: string; user: string } {
  const system = `你是专业的演示文稿设计助手。请为主题规划 PPT 大纲（只规划，不写正文）。

严格要求：
1. 只输出一个 JSON 对象，不要 markdown 代码块、不要任何解释。
2. 结构：
{
  "title": "演示标题",
  "subtitle": "可选副标题",
  "pages": [
    {"layout": "cover", "title": "封面标题"},
    {"layout": "toc", "title": "目录"},
    {"layout": "content", "title": "页面标题", "hint": "这页要讲什么，一句话"},
    {"layout": "end", "title": "谢谢观看"}
  ]
}
3. 页数 6~12 页，cover 开头 end 结尾。
4. 可用 layout：cover / toc / content / twoCol / stats / timeline / compare / process / quote / team / end。
5. hint 说明该页要传达什么，供用户判断增删页面。`;

  const user = context
    ? `请基于以下资料为主题「${topic}」规划 PPT 大纲：\n\n${context}`
    : `请为主题规划 PPT 大纲：${topic}`;
  return { system, user };
}

const VALID_THEMES: ThemeId[] = [
  "violet",
  "ocean",
  "sunset",
  "forest",
  "ink",
  "rose",
  "amber",
  "slate",
  "midnight",
  "emerald",
];

export function themeOrDefault(theme?: string): ThemeId {
  return (VALID_THEMES as string[]).includes(theme ?? "") ? (theme as ThemeId) : "violet";
}

/** PPT5：新版式合法值（parse 归一用） */
export const VALID_LAYOUTS: SlideLayout[] = [
  "cover",
  "toc",
  "content",
  "twoCol",
  "stats",
  "timeline",
  "compare",
  "process",
  "quote",
  "team",
  "end",
];
