/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Markdown } from "./Markdown";

/**
 * 轻量 Markdown 渲染器测试。
 *
 * 这是全自研的解析器（无第三方依赖），流式输出会把半截语法喂进来，
 * 因此重点测两件事：常规语法渲染正确、残缺输入不抛异常。
 */

// mermaid 是 ESM + 依赖真实布局，jsdom 下渲染不了；
// 这里只关心「图表块被识别出来」，把库替换成可控实现
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: "<svg data-testid='mmd'></svg>" })),
  },
}));

const html = (md: string) => {
  const { container } = render(<Markdown content={md} />);
  return container;
};

/* ─────────────── 行内语法 ─────────────── */

describe("Markdown 行内语法", () => {
  it("渲染纯文本段落", () => {
    expect(html("一段普通文字").querySelectorAll("p")).toHaveLength(1);
  });

  it("加粗渲染为 strong", () => {
    const el = html("这是**重点**内容").querySelector("strong");
    expect(el?.textContent).toBe("重点");
  });

  it("行内代码渲染为 code", () => {
    const el = html("执行 `npm test` 命令").querySelector("code");
    expect(el?.textContent).toBe("npm test");
  });

  it("同一行可混排加粗与行内代码", () => {
    const c = html("**注意**：先跑 `lint`");
    expect(c.querySelector("strong")?.textContent).toBe("注意");
    expect(c.querySelector("code")?.textContent).toBe("lint");
  });

  it("未闭合的加粗保留原样不吞内容", () => {
    expect(html("这是**未闭合").textContent).toContain("**未闭合");
  });

  it("未闭合的行内代码保留原样", () => {
    expect(html("命令是 `npm").textContent).toContain("`npm");
  });

  it("空内容不抛异常", () => {
    expect(html("").querySelectorAll("p")).toHaveLength(0);
  });

  it("纯空白行不产生空段落", () => {
    expect(html("\n\n   \n\n").querySelectorAll("p")).toHaveLength(0);
  });
});

/* ─────────────── 标题与引用 ─────────────── */

describe("Markdown 标题与引用", () => {
  it("一级标题用最大字号", () => {
    const el = html("# 文档标题").querySelector("[data-heading]");
    expect(el?.getAttribute("data-heading")).toBe("文档标题");
    expect(el?.className).toContain("text-base");
  });

  it("二级标题字号次之", () => {
    expect(html("## 小节").querySelector("[data-heading]")?.className).toContain("text-sm");
  });

  it("三级及以下标题用最小字号", () => {
    expect(html("### 更小").querySelector("[data-heading]")?.className).toContain("text-[13px]");
  });

  it("超过四级的井号不算标题", () => {
    expect(html("##### 五级").querySelector("[data-heading]")).toBeNull();
  });

  it("井号后没有空格不算标题", () => {
    expect(html("#标签").querySelector("[data-heading]")).toBeNull();
  });

  it("标题内可以有加粗", () => {
    expect(html("## 关于**重点**").querySelector("strong")?.textContent).toBe("重点");
  });

  it("引用渲染为左边框块", () => {
    const el = html("> 引用内容").querySelector(".border-l-2");
    expect(el?.textContent).toBe("引用内容");
  });

  it("引用符号后可省略空格", () => {
    expect(html(">紧贴的引用").querySelector(".border-l-2")?.textContent).toBe("紧贴的引用");
  });
});

/* ─────────────── 列表 ─────────────── */

describe("Markdown 列表", () => {
  it("短横线列表渲染为 ul", () => {
    const c = html("- 第一项\n- 第二项");
    expect(c.querySelectorAll("ul")).toHaveLength(1);
    expect(c.querySelectorAll("li")).toHaveLength(2);
  });

  it("星号也能作为无序列表标记", () => {
    expect(html("* 星号项").querySelectorAll("ul li")).toHaveLength(1);
  });

  it("圆点也能作为无序列表标记", () => {
    expect(html("• 圆点项").querySelectorAll("ul li")).toHaveLength(1);
  });

  it("数字加点渲染为 ol", () => {
    const c = html("1. 第一步\n2. 第二步");
    expect(c.querySelectorAll("ol")).toHaveLength(1);
    expect(c.querySelectorAll("li")).toHaveLength(2);
  });

  it("数字加右括号也算有序列表", () => {
    expect(html("1) 第一步").querySelectorAll("ol li")).toHaveLength(1);
  });

  it("有序与无序相邻时拆成两个列表", () => {
    const c = html("- 无序\n1. 有序");
    expect(c.querySelectorAll("ul")).toHaveLength(1);
    expect(c.querySelectorAll("ol")).toHaveLength(1);
  });

  it("列表被普通段落打断后重新开列表", () => {
    const c = html("- 甲\n说明文字\n- 乙");
    expect(c.querySelectorAll("ul")).toHaveLength(2);
    expect(c.querySelectorAll("p")).toHaveLength(1);
  });

  it("列表项内支持行内语法", () => {
    expect(html("- 带**重点**的项").querySelector("li strong")?.textContent).toBe("重点");
  });

  it("列表项可以缩进", () => {
    expect(html("   - 缩进项").querySelectorAll("ul li")).toHaveLength(1);
  });
});

/* ─────────────── 代码块 ─────────────── */

describe("Markdown 代码块", () => {
  it("围栏代码渲染为 pre", () => {
    const c = html("```ts\nconst a = 1;\n```");
    expect(c.querySelector("pre code")?.textContent).toBe("const a = 1;");
  });

  it("显示语言标签", () => {
    render(<Markdown content={"```python\nprint(1)\n```"} />);
    expect(screen.getByText("python")).toBeDefined();
  });

  it("无语言时标签退化为 code", () => {
    render(<Markdown content={"```\nplain\n```"} />);
    expect(screen.getByText("code")).toBeDefined();
  });

  it("代码块提供复制按钮", () => {
    render(<Markdown content={"```\nplain\n```"} />);
    expect(screen.getByRole("button", { name: "复制" })).toBeDefined();
  });

  it("代码块前后的正文都能渲染", () => {
    const c = html("前言\n```\nx\n```\n后记");
    const text = c.textContent ?? "";
    expect(text).toContain("前言");
    expect(text).toContain("后记");
  });

  it("流式输出中未闭合的围栏也能渲染出代码块", () => {
    const c = html("```ts\nconst a = 1;");
    expect(c.querySelector("pre code")?.textContent).toBe("const a = 1;");
  });

  it("代码块内的 Markdown 语法不被解析", () => {
    const c = html("```\n# 不是标题\n- 不是列表\n```");
    expect(c.querySelector("[data-heading]")).toBeNull();
    expect(c.querySelectorAll("ul")).toHaveLength(0);
  });

  it("多个代码块各自独立渲染", () => {
    const c = html("```\na\n```\n中间\n```\nb\n```");
    expect(c.querySelectorAll("pre")).toHaveLength(2);
    expect(c.textContent).toContain("中间");
  });

  it("mermaid 代码块走图表分支而不是普通代码块", async () => {
    const { container } = render(<Markdown content={"```mermaid\ngraph TD;A-->B;\n```"} />);
    expect(screen.getByText("正在渲染图表…")).toBeDefined();
    expect(container.querySelector("pre")).toBeNull();
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
  });

  it("mermaid 渲染失败时回退显示源码", async () => {
    const mermaid = (await import("mermaid")).default;
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error("Parse error"));
    const { container } = render(<Markdown content={"```mermaid\nbad syntax\n```"} />);
    await waitFor(() => expect(container.textContent).toContain("Mermaid 渲染失败"));
    expect(container.querySelector("pre")?.textContent).toBe("bad syntax");
  });
});

/* ─────────────── 表格 ─────────────── */

describe("Markdown 表格", () => {
  const table = "| 名称 | 数量 |\n| --- | --- |\n| 甲 | 1 |\n| 乙 | 2 |";

  it("解析表头与数据行", () => {
    const c = html(table);
    expect(c.querySelectorAll("th")).toHaveLength(2);
    expect(c.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("表头文字正确", () => {
    const ths = [...html(table).querySelectorAll("th")].map((t) => t.textContent);
    expect(ths).toEqual(["名称", "数量"]);
  });

  it("单元格文字正确", () => {
    const tds = [...html(table).querySelectorAll("tbody td")].map((t) => t.textContent);
    expect(tds).toEqual(["甲", "1", "乙", "2"]);
  });

  it("提供导出 CSV 按钮", () => {
    render(<Markdown content={table} />);
    expect(screen.getByRole("button", { name: "导出 CSV" })).toBeDefined();
  });

  it("缺列的行补空单元格而不越界", () => {
    const c = html("| A | B |\n| --- | --- |\n| 只有一列 |");
    const tds = [...c.querySelectorAll("tbody td")].map((t) => t.textContent);
    expect(tds).toEqual(["只有一列", ""]);
  });

  it("对齐语法的分隔行也能识别", () => {
    const c = html("| A | B |\n| :--- | ---: |\n| 1 | 2 |");
    expect(c.querySelectorAll("th")).toHaveLength(2);
  });

  it("缺少分隔行时不当作表格", () => {
    const c = html("| A | B |\n| 1 | 2 |");
    expect(c.querySelectorAll("table")).toHaveLength(0);
    expect(c.querySelectorAll("p").length).toBeGreaterThan(0);
  });

  it("单元格内支持行内语法", () => {
    const c = html("| A |\n| --- |\n| **粗** |");
    expect(c.querySelector("tbody strong")?.textContent).toBe("粗");
  });

  it("表格后的正文继续渲染", () => {
    const c = html(`${table}\n表格说明`);
    expect(c.textContent).toContain("表格说明");
  });

  it("表格与列表可以共存", () => {
    const c = html(`- 前置项\n\n${table}`);
    expect(c.querySelectorAll("ul li")).toHaveLength(1);
    expect(c.querySelectorAll("table")).toHaveLength(1);
  });
});

/* ─────────────── 组合与健壮性 ─────────────── */

describe("Markdown 健壮性", () => {
  it("完整文档各元素齐全", () => {
    const c = html(
      "# 标题\n\n导语段落。\n\n## 小节\n\n- 要点一\n- 要点二\n\n1. 步骤一\n\n> 提示\n\n```ts\nconst x = 1;\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |",
    );
    expect(c.querySelectorAll("[data-heading]")).toHaveLength(2);
    expect(c.querySelectorAll("ul")).toHaveLength(1);
    expect(c.querySelectorAll("ol")).toHaveLength(1);
    expect(c.querySelectorAll(".border-l-2")).toHaveLength(1);
    expect(c.querySelectorAll("pre")).toHaveLength(1);
    expect(c.querySelectorAll("table")).toHaveLength(1);
  });

  it("逐字符增量喂入都不抛异常", () => {
    const full = "# 标题\n- 项\n```ts\nconst a = 1;\n```\n| A |\n| --- |\n| 1 |";
    for (let i = 1; i <= full.length; i += 1) {
      expect(() => render(<Markdown content={full.slice(0, i)} />)).not.toThrow();
    }
  });

  it("HTML 标签按文本转义而不注入节点", () => {
    const c = html("<script>alert(1)</script>");
    expect(c.querySelector("script")).toBeNull();
    expect(c.textContent).toContain("<script>alert(1)</script>");
  });

  it("超长单行不影响渲染", () => {
    const c = html("x".repeat(20000));
    expect(c.querySelectorAll("p")).toHaveLength(1);
  });
});