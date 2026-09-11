import { readJSON, writeJSON, removeKey } from "@/lib/safe-storage";

export type SkillCat = "写作" | "演示" | "视觉";
export type SkillLevel = "精通" | "进阶" | "入门" | "未练习";

export type SkillDef = {
  key: string;
  label: string;
  desc: string;
  detail: string[];
  cat: SkillCat;
  mode: "chat" | "research" | "slides" | "image" | "video" | "docs";
  levelHint?: SkillLevel;
  system: string;
  draft: string;
  custom?: boolean;
};

export type SkillCtx = { system?: string; label?: string; key?: string; ts?: number };
export type SkillStats = Record<string, { uses: number }>;

export const SKILL_CTX_KEY = "oc:skills.context";
export const SKILL_LAUNCH_KEY = "oc:skills.launch";
export const SKILL_STATS_KEY = "oc:skills.stats";
export const SKILL_CUSTOM_KEY = "oc:skills.custom";
export const SKILL_FAV_KEY = "oc:skills.fav";
export const SKILL_RECENT_KEY = "oc:skills.recent";
export const SKILL_CHANGE_EVENT = "oc:skills.change";

export const BUILTIN_SKILLS: SkillDef[] = [
  {
    key: "copy",
    label: "文案写作",
    desc: "标题、种草、方案与商务邮件。先钩子再结构，一次给多个版本。",
    detail: [
      "适合广告、社媒、邮件和方案里的文字。会先问对象与渠道，再给标题和正文。",
      "输出：多版标题、钩子-利益-行动正文、禁用未验证功效。",
      "不适合：把未测参数写成卖点。",
    ],
    cat: "写作",
    mode: "docs",
    system:
      "【技能：文案写作】你是爆款文案教练。先问对象与渠道，再给多版标题和钩子-利益-行动正文。禁止编造客户评价与未验证功效。",
    draft: "帮我给一款降噪耳机写 3 个小红书标题，并选一条写成种草正文。",
  },
  {
    key: "speech",
    label: "演讲技巧",
    desc: "开场、停顿、翻页与收束。把稿子改成能讲的节奏。",
    detail: [
      "适合发布、述职和路演。会标强攻页与带过页，控制时间。",
      "输出：口播稿、时间切分、可能被追问的三题。",
      "不适合：只要一张装饰封面。",
    ],
    cat: "演示",
    mode: "slides",
    system:
      "【技能：演讲技巧】你是演讲教练。把稿子改成能讲的节奏：开场、强攻页、带过页、收束与可能被追问的三题。控制时间，不堆装饰页。",
    draft: "帮我把「对话即成品」改成 12 分钟路演口播，标出停顿和翻页。",
  },
  {
    key: "ui",
    label: "界面设计",
    desc: "信息架构、状态与空态。先流程再视觉，不堆装饰。",
    detail: [
      "适合后台、工作台和活动页。会给关键路径与组件清单。",
      "输出：页面清单、状态表、一页一意的示意。",
      "不适合：要未提供的像素终稿冒充已开发。",
    ],
    cat: "视觉",
    mode: "image",
    system:
      "【技能：界面设计】你是交互与界面顾问。先流程和状态，再视觉。输出页面清单与空态，不把未提供的像素稿当成已开发。",
    draft: "帮我画「团队周报」后台的关键路径：列表、编辑、空态。",
  },
  {
    key: "video",
    label: "视频编辑",
    desc: "分镜、时长、字幕与导出规格。先脚本再镜头。",
    detail: [
      "适合产品演示和短视频口播。会写镜头表和字幕节奏。",
      "输出：分镜、旁白、B-roll 清单。",
      "不适合：承诺未拍摄素材已成片。",
    ],
    cat: "视觉",
    mode: "video",
    system:
      "【技能：视频编辑】你是分镜与口播教练。先脚本再镜头：时长、画面、旁白、字幕。不承诺未拍摄素材已成片。",
    draft: "为新款降噪耳机写一条 15 秒带货分镜，含字幕。",
  },
  {
    key: "data",
    label: "数据分析",
    desc: "先口径再结论。漏斗、对比与可跑的汇总思路。",
    detail: [
      "适合运营周报和实验解读。未知数据标待核实，不编造显著。",
      "输出：口径、假设、图表建议、SQL 示意。",
      "不适合：要未提供数仓的真实结果。",
    ],
    cat: "写作",
    mode: "research",
    system:
      "【技能：数据分析】你是指标口径教练。先定义再结论。未知数据标待核实，禁止编造统计显著。",
    draft: "帮我定义「周活跃」口径，并给三周对比该怎么画。",
  },
  {
    key: "pm",
    label: "项目管理",
    desc: "里程碑、依赖、风险与负责人。会议要有产出。",
    detail: [
      "适合版本节奏和跨部门接口。缓冲公开，完成度不编造。",
      "输出：里程碑、RACI、风险黄灯。",
      "不适合：只要愿景海报。",
    ],
    cat: "演示",
    mode: "docs",
    system:
      "【技能：项目管理】你是交付教练。里程碑、依赖、风险、负责人。缓冲公开，不编造完成度。",
    draft: "把「技能页改版」切成 4 个里程碑，标黄灯风险。",
  },
];

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SKILL_CHANGE_EVENT));
}

export function readSkillCtx(): SkillCtx {
  return readJSON<SkillCtx>(SKILL_CTX_KEY, {});
}

export function skillSystemExtra(): string {
  return readSkillCtx().system?.trim() ?? "";
}

export function writeSkillCtx(ctx: SkillCtx) {
  writeJSON(SKILL_CTX_KEY, ctx);
  emit();
}

export function clearSkillCtx() {
  removeKey(SKILL_CTX_KEY);
  emit();
}

export function readStats(): SkillStats {
  return readJSON<SkillStats>(SKILL_STATS_KEY, {});
}

export function bumpSkillUse(key: string) {
  const stats = readStats();
  const uses = (stats[key]?.uses ?? 0) + 1;
  writeJSON(SKILL_STATS_KEY, { ...stats, [key]: { uses } });
  emit();
}

export function progressOf(key: string): { uses: number; pct: number; level: SkillLevel } {
  const uses = readStats()[key]?.uses ?? 0;
  const pct = Math.min(100, uses * 14);
  const level: SkillLevel = uses >= 8 ? "精通" : uses >= 3 ? "进阶" : uses > 0 ? "入门" : "未练习";
  return { uses, pct, level };
}

export function readCustomSkills(): SkillDef[] {
  return readJSON<SkillDef[]>(SKILL_CUSTOM_KEY, []);
}

export function saveCustomSkill(s: SkillDef) {
  const list = readCustomSkills().filter((x) => x.key !== s.key);
  writeJSON(SKILL_CUSTOM_KEY, [...list, { ...s, custom: true }]);
  emit();
}

export function removeCustomSkill(key: string) {
  writeJSON(
    SKILL_CUSTOM_KEY,
    readCustomSkills().filter((x) => x.key !== key),
  );
  emit();
}

export function allSkills(): SkillDef[] {
  return [...BUILTIN_SKILLS, ...readCustomSkills()];
}

export function readFav(): string[] {
  return readJSON<string[]>(SKILL_FAV_KEY, []);
}

export function toggleFav(key: string): string[] {
  const cur = readFav();
  const next = cur.includes(key) ? cur.filter((k) => k !== key) : [key, ...cur];
  writeJSON(SKILL_FAV_KEY, next);
  emit();
  return next;
}

export function readRecent(): string[] {
  return readJSON<string[]>(SKILL_RECENT_KEY, []);
}

export function pushRecent(key: string) {
  const next = [key, ...readRecent().filter((k) => k !== key)].slice(0, 8);
  writeJSON(SKILL_RECENT_KEY, next);
  emit();
}

export function launchSkill(s: SkillDef) {
  bumpSkillUse(s.key);
  pushRecent(s.key);
  writeJSON(SKILL_LAUNCH_KEY, {
    text: s.draft,
    system: s.system,
    label: s.label,
    ts: Date.now(),
  });
  writeSkillCtx({ system: s.system, label: s.label, key: s.key, ts: Date.now() });
}
