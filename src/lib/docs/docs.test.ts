import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./export";
import { parseOutline, normalizeLevels, findSelectionRange } from "./outline";
import { countWords, readingMinutes, readingLabel } from "./stats";
import { DOC_SKELETONS } from "./templates";

/** DOC 章：文档领域纯逻辑锁定（导出/大纲/统计/模板骨架） */

describe("DOC6 markdownToHtml", () => {
  it("标题/列表/加粗/行内代码基础转换", () => {
    const html = markdownToHtml("# 标题\n\n- **要点** `code`");
    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<strong>要点</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<ul>");
  });

  it("表格转换：表头 + 对齐行跳过 + 数据行", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const html = markdownToHtml(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>1</td>");
    expect(html).not.toContain("---");
  });

  it("引用块与链接/图片", () => {
    const html = markdownToHtml("> 引用\n\n[文档](https://a.b)\n\n![图](https://i.c/x.png)");
    expect(html).toContain("<blockquote>引用</blockquote>");
    expect(html).toContain('<a href="https://a.b">文档</a>');
    expect(html).toContain('<img src="https://i.c/x.png" alt="图"');
  });

  it("代码围栏内容原样保留（不转义标题符号）", () => {
    const html = markdownToHtml("```\n# 不是标题 <b>\n```");
    expect(html).toContain("<pre><code># 不是标题 &lt;b&gt;</code></pre>");
    expect(html).not.toContain("<h1>");
  });

  it("HTML 注入被转义", () => {
    const html = markdownToHtml('<script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("DOC4 parseOutline", () => {
  it("按层级解析标题并记录行号", () => {
    const items = parseOutline("# 一\n正文\n## 二\n### 三");
    expect(items.map((i) => i.text)).toEqual(["一", "二", "三"]);
    expect(items.map((i) => i.level)).toEqual([1, 2, 3]);
    expect(items[2].line).toBe(3);
  });

  it("代码围栏内的 # 不算标题", () => {
    const items = parseOutline("# 真\n```\n# 假\n```");
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("真");
  });

  it("normalizeLevels 压缩缩进（只有 ## 时目录不整体缩进）", () => {
    const items = normalizeLevels(parseOutline("## a\n### b\n#### c"));
    expect(items[0].indent).toBe(0);
    expect(items[2].indent).toBe(2);
  });
});

describe("DOC3 findSelectionRange", () => {
  it("定位选区首次出现位置", () => {
    expect(findSelectionRange("abcabc", "abc")).toEqual([0, 3]);
    expect(findSelectionRange("xxabc", "abc")).toEqual([2, 5]);
  });

  it("找不到返回 null", () => {
    expect(findSelectionRange("abc", "xyz")).toBeNull();
  });
});

describe("DOC7 统计", () => {
  it("中文字数按字计，英文按词计", () => {
    expect(countWords("你好世界")).toBe(4);
    expect(countWords("hello world")).toBe(2);
    expect(countWords("你好 hello")).toBe(3);
    expect(countWords("")).toBe(0);
  });

  it("阅读时长：300 字/分钟向上取整，至少 1", () => {
    expect(readingMinutes("")).toBe(0);
    expect(readingMinutes("一".repeat(300))).toBe(1);
    expect(readingMinutes("一".repeat(301))).toBe(2);
    expect(readingLabel(0)).toBe("0 分钟");
    expect(readingLabel(5)).toBe("5 分钟");
  });
});

describe("DOC12 模板骨架", () => {
  it("四套骨架齐备且都以一级标题开头", () => {
    expect(DOC_SKELETONS.map((s) => s.id)).toEqual(["weekly", "competitor", "prd", "retro"]);
    for (const s of DOC_SKELETONS) {
      expect(s.content.startsWith("# ")).toBe(true);
      expect(s.content).toContain("## ");
    }
  });

  it("周报骨架含表格与任务清单语法", () => {
    const weekly = DOC_SKELETONS.find((s) => s.id === "weekly")!;
    expect(weekly.content).toContain("| 指标 |");
    expect(weekly.content).toContain("- [ ]");
  });
});