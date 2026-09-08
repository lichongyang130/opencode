import { describe, expect, it } from "vitest";
import { caseShareToPrompt, decodeCaseShare, encodeCaseShare } from "./case-share";

/**
 * 分享码是唯一「从外部字符串直接喂进 UI」的入口，
 * 任何非法/伪造输入都必须收敛成 null，而不是抛异常或产出半成品提示词。
 */

const sample = {
  templateId: "m-social-xhs",
  label: "小红书爆款笔记",
  values: { 产品: "新中式茶饮" },
};

/** 与实现同款的编码方式，用于构造非法负载 */
function rawEncode(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

describe("encodeCaseShare / decodeCaseShare 往返", () => {
  it("往返后内容完全一致并自动补上类型标记", () => {
    const decoded = decodeCaseShare(encodeCaseShare(sample));
    expect(decoded).toEqual({ k: "case", ...sample });
  });

  it("中文与 emoji 不丢失、不乱码", () => {
    const p = {
      templateId: "t-cn",
      label: "中文标签 😀",
      values: { 产品: "龙井·冷萃", 风格: "清新水彩 🎨" },
    };
    expect(decodeCaseShare(encodeCaseShare(p))).toEqual({ k: "case", ...p });
  });

  it("编码结果只含 base64 字符，可安全放进 URL query", () => {
    expect(encodeCaseShare(sample)).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it("空 values 也能往返", () => {
    const p = { templateId: "t-empty", label: "无变量", values: {} };
    expect(decodeCaseShare(encodeCaseShare(p))).toEqual({ k: "case", ...p });
  });

  it("容忍首尾空白（用户从聊天软件复制常带空格换行）", () => {
    const code = encodeCaseShare(sample);
    expect(decodeCaseShare(`  \n ${code} \t `)).toEqual({ k: "case", ...sample });
  });

  it("支持直接粘贴整条分享链接，自动提取 c 参数", () => {
    const code = encodeCaseShare(sample);
    const url = `https://example.com/apps?tab=case&c=${encodeURIComponent(code)}&from=wx`;
    expect(decodeCaseShare(url)).toEqual({ k: "case", ...sample });
  });

  it("链接中 c 参数为首个查询参数时同样可解析", () => {
    const code = encodeCaseShare(sample);
    expect(decodeCaseShare(`/apps?c=${encodeURIComponent(code)}`)).toEqual({
      k: "case",
      ...sample,
    });
  });
});

describe("decodeCaseShare 非法输入", () => {
  it("空串", () => {
    expect(decodeCaseShare("")).toBeNull();
  });

  it("纯空白", () => {
    expect(decodeCaseShare("   \n ")).toBeNull();
  });

  it("含非 base64 字符", () => {
    expect(decodeCaseShare("!!!not-base64!!!")).toBeNull();
  });

  it("合法 base64 但解出来不是 JSON", () => {
    expect(decodeCaseShare(btoa("hello world"))).toBeNull();
  });

  it("合法 JSON 但缺少 case 标记", () => {
    expect(decodeCaseShare(rawEncode({ templateId: "t1", values: {} }))).toBeNull();
  });

  it("类型标记被伪造成其它值", () => {
    expect(decodeCaseShare(rawEncode({ k: "deck", templateId: "t1", values: {} }))).toBeNull();
  });

  it("缺少 templateId", () => {
    expect(decodeCaseShare(rawEncode({ k: "case", values: {} }))).toBeNull();
  });

  it("templateId 为空串", () => {
    expect(decodeCaseShare(rawEncode({ k: "case", templateId: "", values: {} }))).toBeNull();
  });

  it("values 为 null（typeof null 也是 object，必须挡住）", () => {
    expect(decodeCaseShare(rawEncode({ k: "case", templateId: "t1", values: null }))).toBeNull();
  });

  it("values 缺失", () => {
    expect(decodeCaseShare(rawEncode({ k: "case", templateId: "t1" }))).toBeNull();
  });

  it("values 是数组", () => {
    expect(decodeCaseShare(rawEncode({ k: "case", templateId: "t1", values: ["a"] }))).toBeNull();
  });

  it("values 是字符串", () => {
    expect(decodeCaseShare(rawEncode({ k: "case", templateId: "t1", values: "x" }))).toBeNull();
  });

  it("顶层是数组", () => {
    expect(decodeCaseShare(rawEncode([{ k: "case" }]))).toBeNull();
  });

  it("顶层是 null", () => {
    expect(decodeCaseShare(rawEncode(null))).toBeNull();
  });
});

describe("caseShareToPrompt", () => {
  const getTemplate = (id: string) =>
    id === "m-social-xhs" ? { prompt: "为「{{产品}}」写 5 条小红书种草笔记" } : undefined;

  it("把变量值填进模板提示词", () => {
    expect(caseShareToPrompt(encodeCaseShare(sample), getTemplate)).toEqual({
      templateId: "m-social-xhs",
      prompt: "为「新中式茶饮」写 5 条小红书种草笔记",
    });
  });

  it("缺失的变量降级为【占位】而不是留空", () => {
    const code = encodeCaseShare({ templateId: "m-social-xhs", label: "L", values: {} });
    expect(caseShareToPrompt(code, getTemplate)?.prompt).toBe(
      "为「【产品】」写 5 条小红书种草笔记"
    );
  });

  it("模板已被删除时返回 null，不生成半成品提示词", () => {
    const code = encodeCaseShare({ templateId: "gone", label: "L", values: {} });
    expect(caseShareToPrompt(code, getTemplate)).toBeNull();
  });

  it("分享码本身非法时返回 null，且不查询模板", () => {
    let called = false;
    const spy = (id: string) => {
      called = true;
      return getTemplate(id);
    };
    expect(caseShareToPrompt("garbage!!", spy)).toBeNull();
    expect(called).toBe(false);
  });

  it("多次出现的同一变量全部替换", () => {
    const tpl = () => ({ prompt: "{{产品}} 的卖点，以及 {{产品}} 的场景" });
    const code = encodeCaseShare({ templateId: "t", label: "L", values: { 产品: "茶" } });
    expect(caseShareToPrompt(code, tpl)?.prompt).toBe("茶 的卖点，以及 茶 的场景");
  });
});