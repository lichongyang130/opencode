import { describe, expect, it } from "vitest";
import { parseSlideDeck } from "./parse";

/**
 * 幻灯片解析测试。
 *
 * 三级降级是这里的全部重点：合法 JSON → 修复后的 JSON → 纯文本切页。
 * 任何一级都不允许抛错，也不允许返回空 deck ——
 * 用户等了半分钟生成，宁可拿到一份粗糙但可编辑的 PPT，也不该看到「生成失败」。
 */

describe("合法 JSON", () => {
  it("完整 deck 原样解析，不标记降级", () => {
    const raw = JSON.stringify({
      title: "季度汇报",
      subtitle: "2026 Q1",
      theme: "ocean",
      slides: [
        { layout: "cover", title: "季度汇报" },
        { layout: "content", title: "进展", bullets: ["a", "b"] },
        { layout: "end", title: "谢谢观看" },
      ],
    });
    const r = parseSlideDeck(raw);
    expect(r.degraded).toBe(false);
    expect(r.repaired).toBe(false);
    expect(r.deck.title).toBe("季度汇报");
    expect(r.deck.subtitle).toBe("2026 Q1");
    expect(r.deck.theme).toBe("ocean");
    expect(r.deck.slides).toHaveLength(3);
  });

  it("剥掉 ```json 围栏", () => {
    const raw = '```json\n{"title":"T","slides":[{"layout":"content","title":"A"}]}\n```';
    const r = parseSlideDeck(raw);
    expect(r.degraded).toBe(false);
    expect(r.deck.title).toBe("T");
  });

  it("非法主题回落到默认 violet", () => {
    const raw = '{"title":"T","theme":"neon","slides":[{"layout":"content","title":"A"}]}';
    expect(parseSlideDeck(raw).deck.theme).toBe("violet");
  });

  it("缺 title 时用 fallbackTitle", () => {
    const raw = '{"slides":[{"layout":"content","title":"A"}]}';
    expect(parseSlideDeck(raw, "我的演示").deck.title).toBe("我的演示");
  });

  it("title 为空串时同样用 fallbackTitle", () => {
    const raw = '{"title":"","slides":[{"layout":"content","title":"A"}]}';
    expect(parseSlideDeck(raw, "兜底标题").deck.title).toBe("兜底标题");
  });

  it("不传 fallbackTitle 时用默认「未命名演示」", () => {
    expect(parseSlideDeck('{"slides":[{"layout":"content","title":"A"}]}').deck.title).toBe(
      "未命名演示"
    );
  });

  it("subtitle 类型不对时置为 undefined", () => {
    const raw = '{"title":"T","subtitle":123,"slides":[{"layout":"content","title":"A"}]}';
    expect(parseSlideDeck(raw).deck.subtitle).toBeUndefined();
  });
});

describe("逐页字段清洗", () => {
  it("过滤掉 layout 非法的页", () => {
    const raw = JSON.stringify({
      title: "T",
      slides: [
        { layout: "content", title: "留下" },
        { layout: "banner", title: "丢掉" },
        { layout: "", title: "也丢掉" },
      ],
    });
    const titles = parseSlideDeck(raw).deck.slides.map((s) => s.title);
    expect(titles).toContain("留下");
    expect(titles).not.toContain("丢掉");
    expect(titles).not.toContain("也丢掉");
  });

  it("接受全部六种合法 layout", () => {
    const layouts = ["cover", "toc", "content", "twoCol", "stats", "end"];
    const raw = JSON.stringify({
      title: "T",
      slides: layouts.map((layout) => ({ layout, title: layout })),
    });
    const r = parseSlideDeck(raw);
    expect(r.degraded).toBe(false);
    expect(r.deck.slides.map((s) => s.layout)).toEqual(layouts);
  });

  it("bullets 里的非字符串统一转成字符串", () => {
    const raw = '{"title":"T","slides":[{"layout":"content","bullets":[1,true,null]}]}';
    expect(parseSlideDeck(raw).deck.slides[1].bullets).toEqual(["1", "true", "null"]);
  });

  it("bullets 不是数组时置为 undefined", () => {
    const raw = '{"title":"T","slides":[{"layout":"content","bullets":"a,b"}]}';
    expect(parseSlideDeck(raw).deck.slides[1].bullets).toBeUndefined();
  });

  it("twoCol 的右栏与栏标题被保留", () => {
    const raw = JSON.stringify({
      title: "T",
      slides: [
        { layout: "twoCol", title: "对比", twoColTitle: "右栏", bullets: ["l"], bulletsRight: ["r"] },
      ],
    });
    const s = parseSlideDeck(raw).deck.slides[1];
    expect(s).toMatchObject({ twoColTitle: "右栏", bullets: ["l"], bulletsRight: ["r"] });
  });

  it("stats 缺 value 的条目被丢弃，label 缺失补空串", () => {
    const raw = JSON.stringify({
      title: "T",
      slides: [
        {
          layout: "stats",
          stats: [{ value: "92%", label: "满意度" }, { label: "没有值" }, { value: 15 }],
        },
      ],
    });
    expect(parseSlideDeck(raw).deck.slides[1].stats).toEqual([
      { value: "92%", label: "满意度" },
      { value: "15", label: "" },
    ]);
  });

  it("stats 不是数组时置为 undefined", () => {
    const raw = '{"title":"T","slides":[{"layout":"stats","stats":{"a":1}}]}';
    expect(parseSlideDeck(raw).deck.slides[1].stats).toBeUndefined();
  });

  it("imagePrompt 与 note 被保留", () => {
    const raw = JSON.stringify({
      title: "T",
      slides: [{ layout: "content", title: "A", imagePrompt: "城市夜景", note: "讲稿" }],
    });
    expect(parseSlideDeck(raw).deck.slides[1]).toMatchObject({
      imagePrompt: "城市夜景",
      note: "讲稿",
    });
  });
});

describe("补齐封面与结束页", () => {
  it("首页不是 cover 时补一页封面", () => {
    const raw = '{"title":"季报","slides":[{"layout":"content","title":"A"}]}';
    const slides = parseSlideDeck(raw).deck.slides;
    expect(slides[0]).toMatchObject({ layout: "cover", title: "季报" });
  });

  it("末页不是 end 时补一页结束页", () => {
    const raw = '{"title":"T","slides":[{"layout":"content","title":"A"}]}';
    const slides = parseSlideDeck(raw).deck.slides;
    expect(slides[slides.length - 1]).toMatchObject({ layout: "end", title: "谢谢观看" });
  });

  it("已有首尾页时不重复补", () => {
    const raw = JSON.stringify({
      title: "T",
      slides: [
        { layout: "cover", title: "封面" },
        { layout: "end", title: "结束" },
      ],
    });
    expect(parseSlideDeck(raw).deck.slides).toHaveLength(2);
  });
});

describe("JSON 修复（截断 / 尾随逗号）", () => {
  it("截断的输出能抢救出已完成的页并标记 repaired", () => {
    const raw =
      '{"title":"季度汇报","slides":[{"layout":"cover","title":"封面"},{"layout":"content","title":"进展","bullets":["第一条"';
    const r = parseSlideDeck(raw);
    expect(r.repaired).toBe(true);
    expect(r.degraded).toBe(false);
    expect(r.deck.title).toBe("季度汇报");
    expect(r.deck.slides.map((s) => s.title)).toContain("进展");
  });

  it("尾随逗号能修复且不算降级", () => {
    const raw = '{"title":"T","slides":[{"layout":"content","title":"A"},],}';
    const r = parseSlideDeck(raw);
    expect(r.repaired).toBe(true);
    expect(r.degraded).toBe(false);
  });

  it("修复后一页都没剩时同时标记 repaired 与 degraded", () => {
    const raw = '{"title":"T","slides":[';
    const r = parseSlideDeck(raw);
    expect(r.repaired).toBe(true);
    expect(r.degraded).toBe(true);
    expect(r.deck.slides.length).toBeGreaterThan(0);
  });
});

describe("纯文本兜底", () => {
  it("按 Markdown 标题切页", () => {
    const raw = ["# 第一章", "- 要点一", "- 要点二", "## 第二章", "- 要点三"].join("\n");
    const r = parseSlideDeck(raw, "标题");
    expect(r.degraded).toBe(true);
    const contents = r.deck.slides.filter((s) => s.layout === "content");
    expect(contents.map((s) => s.title)).toEqual(["第一章", "第二章"]);
    expect(contents[0].bullets).toEqual(["要点一", "要点二"]);
  });

  it("识别中文数字编号标题", () => {
    const raw = ["一、背景", "- 说明", "二、方案", "- 步骤"].join("\n");
    const titles = parseSlideDeck(raw).deck.slides.filter((s) => s.layout === "content").map(
      (s) => s.title
    );
    expect(titles).toEqual(["背景", "方案"]);
  });

  it("识别阿拉伯数字编号标题", () => {
    const raw = ["1. 现状", "- a", "2) 目标", "- b"].join("\n");
    const titles = parseSlideDeck(raw).deck.slides.filter((s) => s.layout === "content").map(
      (s) => s.title
    );
    expect(titles).toEqual(["现状", "目标"]);
  });

  it("要点超过 6 条自动翻页并标注（续）", () => {
    const raw = ["# 长章节", ...Array.from({ length: 9 }, (_, i) => `- 第${i + 1}条`)].join("\n");
    const contents = parseSlideDeck(raw).deck.slides.filter((s) => s.layout === "content");
    expect(contents).toHaveLength(2);
    expect(contents[0].bullets).toHaveLength(6);
    expect(contents[1].title).toContain("（续）");
    expect(contents[1].bullets).toHaveLength(3);
  });

  it("没有标题时用 fallbackTitle 作为页标题", () => {
    const r = parseSlideDeck("- 只有要点\n- 再来一条", "兜底标题");
    const content = r.deck.slides.find((s) => s.layout === "content");
    expect(content?.title).toBe("兜底标题");
    expect(content?.bullets).toEqual(["只有要点", "再来一条"]);
  });

  it("完全无法切页时给一页提示，不返回空 deck", () => {
    const r = parseSlideDeck("   ", "标题");
    expect(r.degraded).toBe(true);
    const content = r.deck.slides.find((s) => s.layout === "content");
    expect(content?.bullets?.[0]).toContain("模型未返回可用内容");
  });

  it("裸 JSON 数组（不是对象）也走文本兜底而不是抛错", () => {
    const r = parseSlideDeck('[{"layout":"content"}]');
    expect(r.degraded).toBe(true);
    expect(r.deck.slides.length).toBeGreaterThan(0);
  });

  it("超长标题与要点被截断，避免排版溢出", () => {
    const raw = `# ${"标".repeat(100)}\n- ${"点".repeat(300)}`;
    const content = parseSlideDeck(raw).deck.slides.find((s) => s.layout === "content");
    expect(content?.title?.length).toBe(60);
    expect(content?.bullets?.[0].length).toBe(160);
  });

  it("兜底路径同样补齐封面与结束页", () => {
    const slides = parseSlideDeck("# 只有一页\n- 要点", "T").deck.slides;
    expect(slides[0].layout).toBe("cover");
    expect(slides[slides.length - 1].layout).toBe("end");
  });
});

describe("永不抛错", () => {
  it.each([
    ["空字符串", ""],
    ["纯空白", "  \n\t "],
    ["顶层 null", "null"],
    ["顶层数字", "42"],
    ["乱码", "{{{{"],
    ["slides 不是数组", '{"title":"T","slides":"x"}'],
    ["slides 元素是标量", '{"title":"T","slides":[1,"a",null]}'],
    ["slides 为空数组", '{"title":"T","slides":[]}'],
    ["超长无换行文本", "x".repeat(5000)],
  ])("%s 不抛异常且返回可用 deck", (_label, input) => {
    expect(() => parseSlideDeck(input)).not.toThrow();
    const r = parseSlideDeck(input);
    expect(r.deck.slides.length).toBeGreaterThan(0);
    expect(r.deck.theme).toBe("violet");
  });
});

describe("PPT5 新版式解析", () => {
  /** 单页 deck 会被 withCoverAndEnd 前后补页，按 layout 取目标页而非位置索引 */
  const pageOf = (raw: string, layout: string) =>
    parseSlideDeck(raw).deck.slides.find((s) => s.layout === layout);

  it("timeline/process 的 steps 解析（detail 截断与非法项过滤）", () => {
    const raw = JSON.stringify({
      title: "T",
      slides: [
        {
          layout: "timeline",
          title: "路线图",
          steps: [
            { item: "Q1 起步", detail: "长".repeat(200) },
            { item: "Q2 扩张", detail: "增长期" },
            { bad: 1 },
            "not-object",
          ],
        },
        {
          layout: "process",
          title: "步骤",
          steps: [{ item: "第一步" }, { item: 42 }],
        },
      ],
    });
    const tl = pageOf(raw, "timeline");
    expect(tl?.steps).toHaveLength(2);
    expect(tl?.steps?.[0].detail?.length).toBeLessThanOrEqual(120);
    expect(tl?.steps?.[1]).toMatchObject({ item: "Q2 扩张", detail: "增长期" });
    const ps = pageOf(raw, "process");
    expect(ps?.steps?.map((s) => s.item)).toEqual(["第一步", "42"]);
  });

  it("quote 版式的 quote/quoteBy 解析", () => {
    const raw = JSON.stringify({
      title: "T",
      slides: [{ layout: "quote", title: "金句", quote: "少即是多", quoteBy: "设计原则" }],
    });
    expect(pageOf(raw, "quote")).toMatchObject({ quote: "少即是多", quoteBy: "设计原则" });
  });

  it("imageUrl 透传（PPT3 配图回填）", () => {
    const raw = JSON.stringify({
      title: "T",
      slides: [{ layout: "content", title: "页", imagePrompt: "a cat", imageUrl: "https://x/y.png" }],
    });
    const r = parseSlideDeck(raw);
    const content = r.deck.slides.find((s) => s.layout === "content");
    expect(content?.imageUrl).toBe("https://x/y.png");
  });

  it("steps 为空/缺失时字段为空值（undefined / 空数组均可）", () => {
    const raw = JSON.stringify({
      title: "T",
      slides: [{ layout: "timeline", title: "无步骤" }, { layout: "process", steps: [] }],
    });
    const r = parseSlideDeck(raw);
    const missing = r.deck.slides.find((s) => s.title === "无步骤");
    expect(missing?.steps ?? []).toHaveLength(0);
    const empty = r.deck.slides.find((s) => s.layout === "process");
    expect(empty?.steps ?? []).toHaveLength(0);
  });
});