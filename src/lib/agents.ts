"use client";

/**
 * 智能体（自定义 + 能力开关）本地数据层。
 * 内置智能体来自 personas.ts，这里只存用户自建的与能力开关状态。
 */

import { readJSON, writeJSON } from "@/lib/safe-storage";

const CUSTOM_KEY = "oc:agents.custom.v1";
const SKILL_KEY = "oc:agent-skills.v1";

export interface CustomAgent {
  id: string;
  name: string;
  emoji: string;
  group: string;
  desc: string;
  /** 角色设定（system prompt） */
  system: string;
  createdAt: number;
}

export function loadCustomAgents(): CustomAgent[] {
  const list = readJSON<CustomAgent[]>(CUSTOM_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveCustomAgents(list: CustomAgent[]): void {
  writeJSON(CUSTOM_KEY, list);
}

export function addCustomAgent(a: Omit<CustomAgent, "id" | "createdAt">): CustomAgent {
  const next: CustomAgent = {
    ...a,
    id: `custom-${Date.now()}`,
    createdAt: Date.now(),
  };
  saveCustomAgents([next, ...loadCustomAgents()]);
  return next;
}

export function removeCustomAgent(id: string): void {
  saveCustomAgents(loadCustomAgents().filter((a) => a.id !== id));
}

export function findCustomAgent(id: string | null | undefined): CustomAgent | undefined {
  if (!id) return undefined;
  return loadCustomAgents().find((a) => a.id === id);
}

/** 技能开关：{ [agentId]: { [技能名]: 是否启用 } } */
export type SkillState = Record<string, Record<string, boolean>>;

export function loadSkillState(): SkillState {
  const st = readJSON<SkillState>(SKILL_KEY, {});
  return st && typeof st === "object" && !Array.isArray(st) ? st : {};
}

export function saveSkillState(s: SkillState): void {
  writeJSON(SKILL_KEY, s);
}

export function setSkill(agentId: string, skill: string, on: boolean): SkillState {
  const cur = loadSkillState();
  const next = { ...cur, [agentId]: { ...(cur[agentId] ?? {}), [skill]: on } };
  saveSkillState(next);
  return next;
}

export interface AgentSkill {
  label: string;
  desc: string;
}

/** 每个智能体的技能清单；未列出的用 DEFAULT_SKILLS */
export const AGENT_SKILLS: Record<string, AgentSkill[]> = {
  pm: [
    { label: "需求分析", desc: "拆解用户与业务需求，输出结构化结论" },
    { label: "竞品调研", desc: "对比竞品功能、定价与市场策略" },
    { label: "PRD 撰写", desc: "输出背景、目标、范围、方案与验收标准" },
    { label: "原型建议", desc: "给出页面结构与交互流程建议" },
  ],
  "data-analyst": [
    { label: "数据清洗", desc: "识别缺失值、异常值与口径问题" },
    { label: "指标拆解", desc: "把业务问题拆成可计算的指标" },
    { label: "可视化建议", desc: "推荐合适的图表与呈现方式" },
    { label: "结论输出", desc: "给出可执行的业务洞察与建议" },
  ],
  copywriter: [
    { label: "卖点提炼", desc: "从产品特性中提炼用户价值" },
    { label: "标题生成", desc: "一次给出多组风格不同的标题" },
    { label: "平台适配", desc: "按小红书 / 公众号 / 短视频调整语气" },
    { label: "语气调整", desc: "在专业、亲和、幽默之间切换" },
  ],
  "code-reviewer": [
    { label: "代码审查", desc: "指出潜在缺陷与可读性问题" },
    { label: "重构建议", desc: "给出最小改动的重构路径" },
    { label: "缺陷定位", desc: "根据现象推断可能的原因链" },
    { label: "性能优化", desc: "定位瓶颈并给出优化优先级" },
  ],
  hr: [
    { label: "会议纪要", desc: "把讨论整理成结论与待办" },
    { label: "待办提取", desc: "明确责任人与时间节点" },
    { label: "面试提问", desc: "按岗位生成分层面试题" },
    { label: "候选人评估", desc: "给出结构化评估维度与建议" },
  ],
};

export const DEFAULT_SKILLS: AgentSkill[] = [
  { label: "信息整理", desc: "把零散信息整理成清晰结构" },
  { label: "要点提炼", desc: "抽取关键结论与行动项" },
  { label: "方案建议", desc: "给出可落地的多套方案与取舍" },
  { label: "风险提示", desc: "主动指出遗漏与潜在风险" },
];

export function skillsOf(agentId: string): AgentSkill[] {
  return AGENT_SKILLS[agentId] ?? DEFAULT_SKILLS;
}

/** 把「已关闭的技能」拼成追加指令，真正写进 system prompt */
export function disabledSkillNote(agentId: string, skills: AgentSkill[]): string {
  const st = loadSkillState()[agentId] ?? {};
  const off = skills.filter((s) => st[s.label] === false).map((s) => s.label);
  if (off.length === 0) return "";
  return `本轮回答请避开以下能力（用户已在智能体设置中关闭）：${off.join("、")}。`;
}
