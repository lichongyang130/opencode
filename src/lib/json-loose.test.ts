import { describe, expect, it } from "vitest";
import { looseParseJson } from "./json-loose";

/**
 * 宽松 JSON 解析测试。
 *
 * 这里的用例直接照搬线上见过的坏输出形态：围栏、解释文字、被 max_tokens 截断、
 * 尾随逗号。核心契约是「永不抛错」——任何输入都只能返回 value 或 null，
 * 因为调用方（slides / research）拿它当最后一道防线，抛错就等于整次生成丢掉。
 */

describe("正常输入", () => {
  it("纯净 JSON 原样解析且不标记修复", () => {
    const r = looseParseJson('{"title":"标题","n":1}');
    expect(r.value).toEqual({ title: "标题", n: 1 });
    expect(r.repaired).toBe(false);
  });

  it("允许嵌套对象与数组", () => {
    const r = looseParseJson('{"slides":[{"layout":"cover"}],"meta":{"a":[1,2]}}');
    expect(r.value).toEqual({ slides: [{ layout: "cover" }], meta: { a: [1, 2] } });
    expect(r.repaired).toBe(false);
  });

  it("前后有空白不影响解析", () => {
    expect(looseParseJson('\n\n  {"a":1}  \n').value).toEqual({ a: 1 });
  });
});

describe("剥离包裹内容", () => {
  it("剥掉 ```json 代码围栏", () => {
    const r = looseParseJson('```json\n{"a":1}\n```');
    expect(r.value).toEqual({ a: 1 });
    expect(r.repaired).toBe(false);
  });

  it("剥掉不带语言标记的围栏", () => {
    expect(looseParseJson('```\n{"a":1}\n```').value).toEqual({ a: 1 });
  });

  it("围栏语言标记大小写不敏感", () => {
    expect(looseParseJson('```JSON\n{"a":1}\n```').value).toEqual({ a: 1 });
  });

  it("忽略 JSON 前后的解释性文字", () => {
    const raw = '好的，以下是结果：\n{"a":1}\n希望对你有帮助！';
    expect(looseParseJson(raw).value).toEqual({ a: 1 });
  });

  it("从最外层花括号截取，忽略尾部噪声", () => {
    expect(looseParseJson('{"a":{"b":2}} trailing noise').value).toEqual({ a: { b: 2 } });
  });
});

describe("修复尾随逗号", () => {
  it("对象末尾多余逗号能修复并标记 repaired", () => {
    const r = looseParseJson('{"a":1,}');
    expect(r.value).toEqual({ a: 1 });
    expect(r.repaired).toBe(true);
  });

  it("数组末尾多余逗号能修复", () => {
    const r = looseParseJson('{"a":[1,2,],}');
    expect(r.value).toEqual({ a: [1, 2] });
    expect(r.repaired).toBe(true);
  });

  it("逗号与括号之间有换行也能修复", () => {
    expect(looseParseJson('{"a":1,\n  \n}').value).toEqual({ a: 1 });
  });
});

describe("修复截断输出", () => {
  it("缺少右花括号时补齐", () => {
    const r = looseParseJson('{"title":"报告","body":"正文"');
    expect(r.value).toEqual({ title: "报告", body: "正文" });
    expect(r.repaired).toBe(true);
  });

  it("嵌套多层同时截断时按栈逆序补齐", () => {
    const r = looseParseJson('{"a":{"b":[{"c":1');
    expect(r.value).toEqual({ a: { b: [{ c: 1 }] } });
    expect(r.repaired).toBe(true);
  });

  it("断在字符串中间时闭合引号并保留半截内容", () => {
    const r = looseParseJson('{"title":"未说完的标');
    expect(r.value).toEqual({ title: "未说完的标" });
    expect(r.repaired).toBe(true);
  });

  it("断在 key 与 value 之间时丢弃这个残缺键", () => {
    const r = looseParseJson('{"a":1,"heading":');
    expect(r.value).toEqual({ a: 1 });
    expect(r.repaired).toBe(true);
  });

  it("断在逗号后时去掉悬空逗号", () => {
    const r = looseParseJson('{"a":1,');
    expect(r.value).toEqual({ a: 1 });
    expect(r.repaired).toBe(true);
  });

  it("字符串里的花括号不参与括号栈计算", () => {
    const r = looseParseJson('{"tpl":"用 {} 包裹"');
    expect(r.value).toEqual({ tpl: "用 {} 包裹" });
  });

  it("字符串里的转义引号不会被当成闭合引号", () => {
    const r = looseParseJson('{"q":"他说\\"你好\\""');
    expect(r.value).toEqual({ q: '他说"你好"' });
  });

  it("截断的 slides 数组能抢救出已完成的页", () => {
    const raw =
      '{"title":"季度汇报","slides":[{"layout":"cover","title":"封面"},{"layout":"content","title":"第二页"';
    const r = looseParseJson(raw);
    expect(r.repaired).toBe(true);
    const slides = r.value?.slides as unknown[];
    expect(slides).toHaveLength(2);
    expect(slides[0]).toEqual({ layout: "cover", title: "封面" });
  });

  it("围栏未闭合（连 ``` 都被截断）时仍能解析", () => {
    const r = looseParseJson('```json\n{"a":1,"b":2');
    expect(r.value).toEqual({ a: 1, b: 2 });
  });
});

describe("彻底失败时返回 null 而不抛错", () => {
  it.each([
    ["空字符串", ""],
    ["纯空白", "   \n  "],
    ["没有任何花括号", "抱歉，我无法完成这个请求。"],
    ["顶层数组", "[1,2,3]"],
    ["顶层标量", "42"],
    ["顶层字符串", '"hello"'],
    ["无法修复的乱码", "{{{{"],
    ["键缺少引号", "{a:1}"],
  ])("%s 返回 value: null", (_label, input) => {
    const r = looseParseJson(input);
    expect(r.value).toBeNull();
    expect(r.repaired).toBe(false);
  });

  it("对任意随机输入都不抛异常", () => {
    const samples = [
      '{"a":\\}',
      '{"a":"\\',
      "}{",
      '{"a":1}{"b":2}',
      "{".repeat(200),
      '{"a":' + '"'.repeat(50),
      "\u0000{}",
    ];
    for (const s of samples) {
      expect(() => looseParseJson(s)).not.toThrow();
    }
  });

  it("多个 JSON 对象串在一起时取最外层范围，失败也不抛", () => {
    expect(() => looseParseJson('{"a":1} 和 {"b":2}')).not.toThrow();
  });
});