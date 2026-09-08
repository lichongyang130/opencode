import type { ChatCompletionParams, ProviderAdapter } from "../types";

/**
 * 内置免费演示模型：无需任何 API 密钥。
 * 逐块吐出一段模拟回复，让产品在零配置下也能完整体验流式交互。
 * 第 1 阶段接入真实模型后可保留为离线/降级方案。
 */
export const demoProvider: ProviderAdapter = {
  id: "demo",
  isConfigured() {
    return true;
  },
  async *streamChat({ messages }: ChatCompletionParams) {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const question = last?.content ?? "";

    // 识别"表格 / 对比"类请求：输出 Markdown 表格，便于体验表格渲染与 CSV 导出
    if (/表格|对比|套餐/.test(question)) {
      const table = [
        "| 套餐 | 免费版 | 专业版 | 团队版 |",
        "| --- | --- | --- | --- |",
        "| 每日对话 | 10 次 | 不限量 | 不限量 |",
        "| 高级模型 | — | ✅ | ✅ |",
        "| 无水印导出 | — | ✅ | ✅ |",
        "| 价格 | ¥0 | ¥39/月 | ¥99/月 |",
        "",
        "上表为演示数据，悬停表格右上角可一键导出 CSV。",
      ].join("\n");
      const chunks = table.match(/[\s\S]{1,24}/g) ?? [table];
      for (const chunk of chunks) {
        yield chunk;
        await new Promise((r) => setTimeout(r, 24));
      }
      return;
    }

    // 识别 mermaid 请求：输出图表源码，体验自动渲染
    if (/mermaid|流程图|时序图|甘特图/i.test(question)) {
      const chart = [
        "这是一张 Mermaid 流程图（自动渲染为图表）：",
        "",
        "```mermaid",
        "graph TD",
        "  A[用户输入需求] --> B{选择能力}",
        "  B -->|写文档| C[文档工作台]",
        "  B -->|做PPT| D[幻灯片工作台]",
        "  B -->|查资料| E[深度研究]",
        "  C --> F[导出成果]",
        "  D --> F",
        "  E --> F",
        "```",
        "",
        "图表源码可在代码块右上角复制。",
      ].join("\n");
      const chunks = chart.match(/[\s\S]{1,24}/g) ?? [chart];
      for (const chunk of chunks) {
        yield chunk;
        await new Promise((r) => setTimeout(r, 24));
      }
      return;
    }

    // 识别"代码"类请求：输出带围栏的代码示例，便于体验代码块复制等能力
    if (/代码|函数|code/i.test(question)) {
      const code = [
        "这是一个防抖函数示例：",
        "",
        "```js",
        "function debounce(fn, delay = 300) {",
        "  let timer = null;",
        "  return (...args) => {",
        "    clearTimeout(timer);",
        "    timer = setTimeout(() => fn(...args), delay);",
        "  };",
        "}",
        "```",
        "",
        "在输入框右上角可一键复制代码。",
      ].join("\n");
      const chunks = code.match(/[\s\S]{1,24}/g) ?? [code];
      for (const chunk of chunks) {
        yield chunk;
        await new Promise((r) => setTimeout(r, 24));
      }
      return;
    }

    // 识别"大纲 / 提纲"类请求：输出结构化 Markdown，便于体验目录、转 PPT 等能力
    if (/大纲|提纲|多级标题/.test(question)) {
      const outline = [
        "# 智能手机产品介绍大纲",
        "",
        "## 一、产品定位",
        "面向年轻创作者的 AI 影像旗舰：一句话定位 + 目标人群画像。",
        "",
        "## 二、核心亮点",
        "1. 影像系统：一英寸大底 + AI 摄影助手",
        "2. 性能：旗舰芯片与散热架构",
        "3. AI 能力：实时转录、圈选搜索、AI 修图",
        "",
        "## 三、设计与做工",
        "机身工艺、配色方案、握持手感与防护等级。",
        "",
        "## 四、价格与上市计划",
        "定价策略、首发权益与开售时间表。",
        "",
        "## 五、总结",
        "一段 30 秒的电梯陈述，把以上要点串起来。",
      ].join("\n");
      const outlineChunks = outline.match(/[\s\S]{1,24}/g) ?? [outline];
      for (const chunk of outlineChunks) {
        yield chunk;
        await new Promise((r) => setTimeout(r, 24));
      }
      return;
    }

    const reply = [
      `你好！我是内置演示模型 👋 你刚才说的是：「${question.slice(0, 80)}」`,
      "",
      "当前没有配置任何真实大模型密钥，所以我在本地模拟流式回复。",
      "要接入真实模型，请在项目根目录创建 .env.local（参考 .env.example），填入任意一个密钥：",
      "",
      "• 海外：OPENAI_API_KEY（GPT）或 ANTHROPIC_API_KEY（Claude）",
      "• 国内：DEEPSEEK_API_KEY（DeepSeek）或 DASHSCOPE_API_KEY（通义千问）",
      "",
      "配置后刷新页面，即可在右上角模型选择器切换。后续阶段我还会接入：",
      "PPT 生成、深度研究、AI 绘图、视频生成、品牌中心与积分订阅系统。",
    ].join("\n");

    const chunks = reply.match(/[\s\S]{1,24}/g) ?? [reply];
    for (const chunk of chunks) {
      yield chunk;
      await new Promise((r) => setTimeout(r, 28));
    }
  },
};
