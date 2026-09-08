import type { WorkspaceMode } from "@/lib/store/chat";

/**
 * 斜杠命令：在输入框以 "/" 开头时弹出。
 * 两类：
 * - action：直接执行（切换工作台等）
 * - prompt：把片段插入/包裹到输入框
 */
export interface SlashCommand {
  /** 触发词，不含 "/" */
  cmd: string;
  label: string;
  desc: string;
  /** action = 切换工作台；prompt = 插入指令片段 */
  kind: "action" | "prompt";
  mode?: WorkspaceMode;
  /** kind=prompt 时插入的文本（{q} 会被当前输入替换） */
  insert?: string;
  /** insert 中光标偏移（相对插入后文本），不填则放末尾 */
  cursor?: number;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // —— 工作台切换 ——
  { cmd: "chat", label: "对话", desc: "切换到 AI 对话工作台", kind: "action", mode: "chat" },
  { cmd: "doc", label: "文档", desc: "切换到文档工作台", kind: "action", mode: "docs" },
  { cmd: "ppt", label: "幻灯片", desc: "切换到 PPT 工作台", kind: "action", mode: "slides" },
  { cmd: "image", label: "绘图", desc: "切换到 AI 绘图工作台", kind: "action", mode: "image" },
  { cmd: "video", label: "视频", desc: "切换到视频脚本工作台", kind: "action", mode: "video" },
  { cmd: "research", label: "深度研究", desc: "切换到深度研究工作台", kind: "action", mode: "research" },
  { cmd: "pack", label: "一键素材包", desc: "一个主题，产出整套营销素材", kind: "prompt", insert: "【素材包】为「{q}」生成一整套营销素材" },
  // —— 写作指令 ——
  { cmd: "write", label: "撰写", desc: "围绕主题撰写完整内容", kind: "prompt", insert: "请围绕「{q}」撰写一篇内容完整、结构清晰的文章，包含引人入胜的开头、分节论述和总结。" },
  { cmd: "translate", label: "翻译", desc: "中英互译，保留语气", kind: "prompt", insert: "请将以下内容翻译（中文↔英文自动识别），保留原意与语气，表达地道：\n\n{q}" },
  { cmd: "polish", label: "润色", desc: "润色文字，更流畅专业", kind: "prompt", insert: "请润色以下文字，使其更流畅、专业、有感染力，保持原意不变：\n\n{q}" },
  { cmd: "expand", label: "扩写", desc: "丰富细节与论据", kind: "prompt", insert: "请扩写以下内容，补充细节、论据与示例，使内容更充实：\n\n{q}" },
  { cmd: "shorten", label: "精简", desc: "压缩篇幅，保留要点", kind: "prompt", insert: "请把以下内容精简为要点清晰的短文，保留核心信息：\n\n{q}" },
  { cmd: "fix", label: "纠错", desc: "修正语法/错别字/标点", kind: "prompt", insert: "请检查并修正以下内容中的语法、错别字、用词与标点问题，输出修正后的版本并简要说明改动：\n\n{q}" },
  { cmd: "outline", label: "大纲", desc: "生成内容大纲", kind: "prompt", insert: "请为「{q}」生成一份详细大纲，含层级标题与每节要点。" },
  { cmd: "brainstorm", label: "头脑风暴", desc: "发散 10+ 创意点子", kind: "prompt", insert: "请围绕「{q}」进行头脑风暴，给出 15 个有创意、可落地的点子，每个一句话说明。" },
  { cmd: "summarize", label: "总结", desc: "提炼摘要与要点", kind: "prompt", insert: "请总结以下内容，输出：一句话摘要 + 3-5 个关键要点：\n\n{q}" },
  { cmd: "email", label: "写邮件", desc: "生成商务邮件", kind: "prompt", insert: "请帮我写一封邮件，主题/目的：{q}。语气专业礼貌，结构完整（称呼、正文、结尾）。" },
  { cmd: "table", label: "表格化", desc: "整理成 Markdown 表格", kind: "prompt", insert: "请把以下信息整理成结构清晰的 Markdown 表格，并补充表头：\n\n{q}" },
];

/** 语气 / 长度 / 受众 快捷参数：一键叠加到 prompt */
export interface PromptChip {
  id: string;
  label: string;
  /** 追加到 prompt 末尾的约束 */
  suffix: string;
}

export const TONE_CHIPS: PromptChip[] = [
  { id: "professional", label: "专业", suffix: "语气：专业严谨、用词准确。" },
  { id: "friendly", label: "亲切", suffix: "语气：亲切自然、像朋友聊天。" },
  { id: "humorous", label: "幽默", suffix: "语气：轻松幽默、有梗但不油腻。" },
  { id: "formal", label: "正式", suffix: "语气：正式书面、适合公文/商务场景。" },
  { id: "inspiring", label: "感染力", suffix: "语气：有感染力、能打动人、激发行动。" },
  { id: "neutral", label: "客观", suffix: "语气：客观中立、只陈述事实与数据。" },
];

export const LENGTH_CHIPS: PromptChip[] = [
  { id: "short", label: "简短", suffix: "篇幅：简短精炼，控制在 200 字以内。" },
  { id: "medium", label: "适中", suffix: "篇幅：适中，500 字左右。" },
  { id: "long", label: "详尽", suffix: "篇幅：详尽深入，1500 字以上，分小节展开。" },
];

export const AUDIENCE_CHIPS: PromptChip[] = [
  { id: "beginner", label: "小白", suffix: "受众：零基础读者，避免术语，多用类比。" },
  { id: "pro", label: "专业人士", suffix: "受众：行业专业人士，可以使用术语并深入细节。" },
  { id: "boss", label: "给老板", suffix: "受众：决策者/管理层，结论先行、突出重点与建议。" },
  { id: "customer", label: "给客户", suffix: "受众：外部客户，突出价值、可信度与行动号召。" },
  { id: "student", label: "给学生", suffix: "受众：学生，循序渐进、配例子、便于理解记忆。" },
];

/** 匹配斜杠命令：输入以 / 开头时调用，返回过滤后的命令 */
export function matchSlash(input: string): SlashCommand[] | null {
  const m = /^\/([a-z]*)$/i.exec(input.trim());
  if (!m) return null;
  const q = m[1].toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(q) || c.label.includes(m[1]));
}
