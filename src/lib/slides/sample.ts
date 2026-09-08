import type { SlideDeck, ThemeId } from "./types";

/** 演示模型（无密钥）时返回的示例 PPT，让 PPT 功能零配置可体验 */
export function buildSampleDeck(topic: string, theme: ThemeId = "violet"): SlideDeck {
  const t = topic.trim() || "AI 智能体工作空间产品发布";
  return {
    title: t,
    subtitle: "让研究、分析与创作在一个流程中完成",
    theme,
    slides: [
      {
        layout: "cover",
        title: t,
        subtitle: "产品发布会 · 2026",
        imagePrompt: "futuristic AI workspace, purple gradient, clean tech style",
      },
      {
        layout: "toc",
        title: "目录",
        bullets: ["行业背景", "产品方案", "核心能力", "市场与定价"],
      },
      {
        layout: "content",
        title: "行业背景：AI 创作需求爆发",
        bullets: [
          "全球 AI 写作/设计工具用户已超 1 亿",
          "用户平均在 5 个以上 AI 工具间切换",
          "单点工具无法打通「调研→成稿→设计」链路",
          "市场亟需一站式智能体工作空间",
        ],
        imagePrompt: "growing market chart, abstract 3d, violet tone",
      },
      {
        layout: "stats",
        title: "市场机会",
        stats: [
          { value: "10M+", label: "目标早期用户" },
          { value: "$20B", label: "2030 市场规模" },
          { value: "6 合 1", label: "研究/PPT/图/视频/文档/代码" },
        ],
      },
      {
        layout: "twoCol",
        title: "产品方案：对话即成品",
        bullets: [
          "一句话生成整套营销素材",
          "深度研究自动多轮搜索",
          "文档 / PPT / 图片 / 视频联动",
          "品牌资产保持风格一致",
        ],
        twoColTitle: "技术底座",
        bulletsRight: [
          "统一模型网关，国内外模型即插即用",
          "Agent 编排引擎，多步任务自动执行",
          "积分计费，成本透明可控",
        ],
      },
      {
        layout: "content",
        title: "核心能力一：深度研究",
        bullets: [
          "自动拆解问题、多轮联网搜索",
          "阅读并去重数十篇资料",
          "输出带引用的结构化研究报告",
          "一键转为演示幻灯片",
        ],
      },
      {
        layout: "content",
        title: "核心能力二：一键 PPT",
        bullets: [
          "主题一句话，大纲与成稿自动完成",
          "多套主题版式，配图自动生成",
          "画布内直接编辑、换主题",
          "一键导出 PPTX / PDF",
        ],
        imagePrompt: "presentation slides floating, modern flat illustration",
      },
      {
        layout: "stats",
        title: "效率提升",
        stats: [
          { value: "10x", label: "内容产出速度" },
          { value: "-80%", label: "工具切换成本" },
          { value: "98%", label: "用户满意度目标" },
        ],
      },
      {
        layout: "end",
        title: "谢谢观看",
        subtitle: "立即免费体验 · 注册即送积分",
      },
    ],
  };
}
