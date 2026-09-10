import { PERSONAS, type Persona } from "@/lib/personas";

export type ExpertMeta = {
  id: string;
  pitch: string;
  starters: { lv: string; text: string; out: string }[];
  suited: string[];
  notSuited: string[];
  bans: string[];
  works: string;
  face?: string;
  tone: string;
  official: boolean;
  warning?: string;
};

const FACE: Record<string, string> = {
  "marketing-strategist": "/cases/experts/hero-week.jpg",
  copywriter: "/cases/experts/p-copy.jpg",
  writer: "/cases/experts/p-copy.jpg",
  editor: "/cases/experts/p-copy.jpg",
  translator: "/cases/experts/p-copy.jpg",
  pm: "/cases/experts/p-pm.jpg",
  hr: "/cases/experts/p-pm.jpg",
  "data-analyst": "/cases/experts/p-pm.jpg",
  legal: "/cases/experts/p-pm.jpg",
  "code-reviewer": "/cases/experts/p-code.jpg",
  "interviewer-tech": "/cases/experts/p-code.jpg",
  travel: "/cases/experts/p-travel.jpg",
  psychologist: "/cases/experts/p-travel.jpg",
  english: "/cases/experts/p-travel.jpg",
  chef: "/cases/experts/p-chef.jpg",
  tutor: "/cases/experts/p-chef.jpg",
  "board-coach": "/cases/experts/p-board.jpg",
  "pitch-coach": "/cases/experts/p-pitch.jpg",
  "weekly-coach": "/cases/experts/p-weekly.jpg",
  "scqa-coach": "/cases/experts/p-scqa.jpg",
};

export const HERO_ART: Record<string, string> = {
  咨询: "/cases/experts/hero-board.jpg",
  营销: "/cases/experts/hero-week.jpg",
};

export type CardExtra = { alias: string; title: string; rating: string; skills: string[] };

export const CARD_EXTRA: Record<string, CardExtra> = {
  "board-coach": { alias: "李明", title: "战略咨询总监", rating: "4.9", skills: ["路演教练", "融资顾问"] },
  "weekly-coach": { alias: "张静", title: "战略咨询总监", rating: "4.5", skills: ["周报教练", "执行力"] },
  "scqa-coach": { alias: "陈柯", title: "战略咨询总监", rating: "4.9", skills: ["SCQA 教练", "逻辑表达"] },
  "pitch-coach": { alias: "周南", title: "战略咨询总监", rating: "4.2", skills: ["董事会辅导", "企业战略"] },
};

function s(a: string, b: string, c: string): ExpertMeta["starters"] {
  return [
    { lv: "30 秒", text: a, out: "要点" },
    { lv: "10 分钟", text: b, out: "一页结构" },
    { lv: "项目", text: c, out: "可执行稿" },
  ];
}

const META: Record<string, Omit<ExpertMeta, "id" | "face" | "official">> = {
  copywriter: {
    pitch: "开头三秒有钩子。标题、正文、结尾各司其职，一次给多个版本。",
    starters: s("给降噪耳机写 3 个小红书标题", "写一条种草文案（钩子-利益-行动）", "同一卖点出短视频口播+图文两版"),
    suited: ["增长", "内容"],
    notSuited: ["需要实测参数当文案"],
    bans: ["编造客户评价", "未验证功效"],
    works: "先给钩子再给全文，多版本。",
    tone: "营销",
  },
  "marketing-strategist": {
    pitch: "把 Campaign 拆成可执行周计划：定位、渠道、节奏与衡量，不说空话。",
    starters: s("一句话定位新茶饮", "上市 8 周渠道节奏", "预算未知时的衡量指标怎么写"),
    suited: ["创始人", "市场"],
    notSuited: ["要全国份额承诺"],
    bans: ["编造 ROI 百分比"],
    works: "先策略再动作、渠道、节奏。",
    tone: "营销",
  },
  translator: {
    pitch: "中英互译信达雅。商务正式，营销留情绪。",
    starters: s("译一句产品定位", "译一封商务邮件并保留语气", "本地化一页手册（标歧义）"),
    suited: ["出海", "文档"],
    notSuited: ["法律公证翻译"],
    bans: ["假装已公证"],
    works: "只出译文，歧义括号备注。",
    tone: "写作",
  },
  writer: {
    pitch: "小说、散文、诗歌。长人物、磨对白，不堆辞藻。",
    starters: s("便利店微型小说开头", "改成第一人称", "列三条情节走向"),
    suited: ["创作者"],
    notSuited: ["公文套话"],
    bans: ["抄袭在世作家段落"],
    works: "画面感与节奏优先。",
    tone: "写作",
  },
  editor: {
    pitch: "先总评，再原文→建议，最后改稿。",
    starters: s("审一段产品介绍", "把逻辑漏洞列成表", "出一版可发布改稿"),
    suited: ["文档", "上会"],
    notSuited: ["只要捧场"],
    bans: ["把规划改成已量产"],
    works: "严格、可执行。",
    tone: "写作",
  },
  pm: {
    pitch: "背景、用户故事、优先级、验收，写成能开发的 PRD。",
    starters: s("一句话写「团队周报」目标", "列出用户故事与优先级", "补验收标准与边界"),
    suited: ["产品", "研发"],
    notSuited: ["只要愿景海报"],
    bans: ["虚构未谈过的干系人"],
    works: "结构先于文采。",
    tone: "职场",
  },
  "data-analyst": {
    pitch: "先口径再结论。漏斗、假设、SQL 可跑。",
    starters: s("定义「准时率」口径", "给三周对比框架", "写一条可运行的汇总 SQL（注明方言）"),
    suited: ["运营", "分析"],
    notSuited: ["要未提供的真实数仓结果"],
    bans: ["编造统计显著"],
    works: "口径 → 假设 → 验证。",
    tone: "职场",
  },
  hr: {
    pitch: "简历量化、JD、模拟面试与谈薪。",
    starters: s("把经历改成 STAR", "写 AI 产品经理 JD", "模拟一面并点评"),
    suited: ["求职", "招聘"],
    notSuited: ["签证移民法律"],
    bans: ["保证录用"],
    works: "两边视角都给。",
    tone: "职场",
  },
  legal: {
    pitch: "指出风险条款与不利表述。非执业意见。",
    starters: s("这段免责够不够", "标出对我不利的三句", "给修改建议（非律师函）"),
    suited: ["商务初审"],
    notSuited: ["需要签字盖章"],
    bans: ["冒充执业律师"],
    works: "风险点 + 白话解释。",
    tone: "职场",
    warning: "非执业律师，不替代正式法律意见。",
  },
  tutor: {
    pitch: "不直接喂答案。提问、类比、再检查。",
    starters: s("我不懂边际效用", "用生活例子讲一遍", "出一道检验题"),
    suited: ["学习"],
    notSuited: ["只要答案应付考试作弊"],
    bans: ["代写考试"],
    works: "启发式。",
    tone: "学习",
  },
  english: {
    pitch: "英文对话。每轮纠错、地道说法、句型。",
    starters: s("Let's start with a self-intro", "纠正刚才三处", "给一个可套用句型"),
    suited: ["口语练习"],
    notSuited: ["官方雅思阅卷"],
    bans: ["承诺提分分数"],
    works: "英文沉浸，中文点拨。",
    tone: "学习",
  },
  "code-reviewer": {
    pitch: "正确性、边界、可读、性能、安全。给改法，不臆造 API。",
    starters: s("看这段函数的边界", "标严重程度", "给一版最小修复"),
    suited: ["研发"],
    notSuited: ["要未提供仓库的全量审计"],
    bans: ["编造不存在的 API"],
    works: "问题-原因-示例。",
    tone: "技术",
  },
  "interviewer-tech": {
    pitch: "一次一题，逐步追问，结束给评价。",
    starters: s("模拟前端一面开场", "追问原理", "给整体评价与改进"),
    suited: ["求职准备"],
    notSuited: ["替你面试"],
    bans: ["泄露未公开真题当官方"],
    works: "一问一答。",
    tone: "技术",
  },
  chef: {
    pitch: "按手头食材出菜谱：份量、步骤、用时。",
    starters: s("鸡胸西兰花怎么做", "一周备餐三天", "标过敏替代"),
    suited: ["家庭"],
    notSuited: ["医疗营养处方"],
    bans: ["有害健康吃法当推荐"],
    works: "实用步骤。",
    tone: "生活",
  },
  psychologist: {
    pitch: "先听，再拆想法与事实。非医疗。",
    starters: s("我有点焦虑，想被听见", "帮我分开事实和评价", "给一个今晚能做的小步骤"),
    suited: ["情绪梳理"],
    notSuited: ["危机干预、诊断"],
    bans: ["诊断、开药"],
    works: "共情后小步骤。",
    tone: "生活",
    warning: "非专业医疗。若有伤害自己或他人的想法，请寻求当地紧急帮助。",
  },
  travel: {
    pitch: "按天排行程、交通、预算与避坑，不赶场。",
    starters: s("成都 5 天亲子节奏", "雨天备选", "预算人民币区间（示意）"),
    suited: ["出行规划"],
    notSuited: ["签证担保"],
    bans: ["编造未核实营业时间"],
    works: "按天、留白。",
    tone: "生活",
  },
  "board-coach": {
    pitch: "一页地图：论点、支撑、时间、强攻/带过。未知数字待核实。",
    starters: s("先写投票句", "列出强攻三页", "25 分钟怎么切"),
    suited: ["上会"],
    notSuited: ["要编造营收过会"],
    bans: ["编造客户与营收"],
    works: "结论先行。",
    tone: "咨询",
  },
  "pitch-coach": {
    pitch: "故事弧。不编 ARR，尽调看证据。",
    starters: s("一句话冲突", "12 页弧线", "Ask 怎么写才不空"),
    suited: ["融资预演"],
    notSuited: ["要假客户墙"],
    bans: ["编造 ARR 与未签港口名"],
    works: "世界-冲突-方案-Ask。",
    tone: "咨询",
  },
  "weekly-coach": {
    pitch: "完成 / 风险 / 求助 / 负责人。无愿景页。",
    starters: s("三件完成", "两件黄灯", "求助写成一个人名"),
    suited: ["执行层周会"],
    notSuited: ["品牌故事会"],
    bans: ["空话愿景"],
    works: "五页极简。",
    tone: "咨询",
  },
  "scqa-coach": {
    pitch: "SCQA。示意须标注，禁止把规划写成量产。",
    starters: s("四句 S-C-Q-A", "发布词 vs 工程事实表", "删除哪句对外承诺"),
    suited: ["发布预审"],
    notSuited: ["要无边界承诺"],
    bans: ["无边界全息、未测小时数"],
    works: "口径会签。",
    tone: "咨询",
  },
};

export const WEEKLY_DEFAULT = "board-coach";
export const EXPERT_VERSION = "v3";

export function faceOf(id: string) {
  return FACE[id];
}

export function metaOf(id: string): ExpertMeta {
  const base = META[id];
  const p = PERSONAS.find((x) => x.id === id);
  if (base) {
    return { id, official: true, face: FACE[id], ...base };
  }
  return {
    id,
    official: false,
    face: FACE[id],
    pitch: p?.desc ?? "",
    starters: p?.starter ? s(p.starter, p.starter, p.starter) : [],
    suited: [],
    notSuited: [],
    bans: [],
    works: "",
    tone: p?.group ?? "",
  };
}

export function biosOf(p: Persona): string[] {
  return (p.system || p.desc)
    .split(/(?<=。)/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export function searchExperts(q: string, list: Persona[]) {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((p) => {
    const m = metaOf(p.id);
    const blob = [p.name, p.desc, p.group, m.pitch, ...m.starters.map((x) => x.text), ...m.suited].join(" ").toLowerCase();
    return blob.includes(s);
  });
}
