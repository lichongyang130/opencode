import { describe, expect, it } from "vitest";
import { parseOutline, outlineToContext, fillCoverMeta } from "./outline";
import { checkSlideOverflow, checkDeckOverflow } from "./overflow";
import type { Slide, SlideDeck } from "./types";

/** PPT 章：大纲先行 / 溢出检测 / 封面元信息填充的领域逻辑锁定 */

const deckOf = (slides: Partial<Slide>[]): SlideDeck => ({
  title: "测试演示",
  theme: "violet",
  slides: slides.map((s) => ({ layout: "content", ...s })) as Slide[],
});

describe("PPT1 parseOutline", () => {
  it("合法大纲 JSON 解析为页面骨架", () => {
    const raw = JSON.stringify({
      title: "产品发布",
      subtitle: "2026 秋季",
      pages: [
        { layout: "cover", title: "封面" },
        { layout: "toc", title: "目录" },
        { layout: "content", title: "要点页", hint: "讲三个卖点" },
        { layout: "timeline", title: "路线图" },
        { layout: "end", title: "谢谢" },
      ],
    });
    const o = parseOutline(raw);
    expect(o?.title).toBe("产品发布");
    expect(o?.pages).toHaveLength(5);
    expect(o?.pages[2]).toMatchObject({ layout: "content", title: "要点页", hint: "讲三个卖点" });
  });

  it("非法 layout 页被过滤，全非法返回 null", () => {
    expect(parseOutline('{"pages":[{"layout":"bad","title":"x"}]}')).toBeNull();
    expect(parseOutline("不是 JSON")).toBeNull();
    expect(parseOutline('{"pages":"not array"}')).toBeNull();
  });
});

describe("PPT1 outlineToContext", () => {
  it("大纲转成稿上下文：含标题、结构、hint", () => {
    const ctx = outlineToContext({
      title: "产品发布",
      pages: [
        { layout: "cover", title: "封面" },
        { layout: "content", title: "要点", hint: "卖点" },
      ],
    });
    expect(ctx).toContain("演示标题：产品发布");
    expect(ctx).toContain("第 1 页 [cover] 封面");
    expect(ctx).toContain("第 2 页 [content] 要点 —— 卖点");
    expect(ctx).toContain("严格按此结构生成");
  });
});

describe("PPT9 fillCoverMeta", () => {
  it("无副标题的封面补当日日期", () => {
    const today = new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const deck = fillCoverMeta(deckOf([{ layout: "cover", title: "T" }]));
    expect(deck.slides[0].subtitle).toBe(today);
  });

  it("已有副标题追加日期，重复调用幂等", () => {
    const once = fillCoverMeta(deckOf([{ layout: "cover", title: "T", subtitle: "秋季发布会" }]));
    expect(once.slides[0].subtitle).toContain("秋季发布会 · ");
    const twice = fillCoverMeta(once);
    expect(twice.slides[0].subtitle).toBe(once.slides[0].subtitle);
  });

  it("非封面页不受影响", () => {
    const deck = fillCoverMeta(deckOf([{ layout: "content", title: "T", subtitle: "不动" }]));
    expect(deck.slides[0].subtitle).toBe("不动");
  });
});

describe("PPT11 checkSlideOverflow", () => {
  it("正常页不溢出", () => {
    const r = checkSlideOverflow({ layout: "content", title: "t", bullets: ["短要点一", "短要点二"] });
    expect(r.overflow).toBe(false);
    expect(r.hint).toBe("");
  });

  it("要点过多判定溢出并给建议", () => {
    const long = "这是一条特别长的要点会折行占用多行空间需要被判定溢出才能触发建议文案".repeat(2);
    const r = checkSlideOverflow({ layout: "content", title: "t", bullets: Array(6).fill(long) });
    expect(r.overflow).toBe(true);
    expect(r.hint).toContain("精简要点");
  });

  it("双栏取较高一侧", () => {
    const r = checkSlideOverflow({
      layout: "twoCol",
      title: "t",
      bullets: ["短"],
      bulletsRight: Array(7).fill("特别长特别长特别长特别长特别长特别长特别长"),
    });
    expect(r.overflow).toBe(true);
  });

  it("checkDeckOverflow 只返回溢出页索引", () => {
    const out = checkDeckOverflow([
      { layout: "content", title: "ok", bullets: ["短"] },
      { layout: "content", title: "bad", bullets: Array(8).fill("很长的要点".repeat(10)) },
      { layout: "cover", title: "封面" },
    ]);
    expect(Object.keys(out)).toEqual(["1"]);
  });
});