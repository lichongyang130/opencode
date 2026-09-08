import { describe, expect, it } from "vitest";
import { CREDIT_USD_VALUE, calcUsageCost, estimateTokens, reserveCredits } from "./credits";

/**
 * 计费是唯一直接对应真金白银的模块：算多了坑用户，算少了亏平台。
 * 这里把「免费必须为 0、有成本必须至少 1、毛利倍率不能漂」三条铁律钉死。
 */

describe("estimateTokens", () => {
  it("空串仍按 1 token 计（避免 0 成本绕过预扣）", () => {
    expect(estimateTokens("")).toBe(1);
  });

  it("按 3.5 字符/token 向上取整", () => {
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("abcd")).toBe(2);
    expect(estimateTokens("abcdefg")).toBe(2);
    expect(estimateTokens("abcdefgh")).toBe(3);
  });

  it("中文按字符数折算，不因多字节而膨胀", () => {
    expect(estimateTokens("你好世界")).toBe(2);
    expect(estimateTokens("一".repeat(35))).toBe(10);
  });

  it("emoji 等代理对按 UTF-16 长度计算", () => {
    expect(estimateTokens("😀")).toBe(1);
    expect(estimateTokens("😀".repeat(4))).toBe(3);
  });

  it("结果恒为正整数", () => {
    for (const s of ["", " ", "\n", "x", "长".repeat(1000)]) {
      const n = estimateTokens(s);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });
});

describe("calcUsageCost 成本核算", () => {
  it("按百万 token 单价线性累加输入与输出", () => {
    const r = calcUsageCost(1000, 2000, 3, 15);
    expect(r.costUsd).toBeCloseTo(0.033, 10);
    expect(r.inputTokens).toBe(1000);
    expect(r.outputTokens).toBe(2000);
  });

  it("整百万 token 恰好等于单价", () => {
    expect(calcUsageCost(1_000_000, 0, 3, 15).costUsd).toBeCloseTo(3, 10);
    expect(calcUsageCost(0, 1_000_000, 3, 15).costUsd).toBeCloseTo(15, 10);
  });

  it("输入与输出单价不会互相串用", () => {
    const onlyInput = calcUsageCost(1_000_000, 0, 3, 15);
    const onlyOutput = calcUsageCost(0, 1_000_000, 3, 15);
    expect(onlyInput.costUsd).not.toBeCloseTo(onlyOutput.costUsd, 5);
  });
});

describe("calcUsageCost 积分换算", () => {
  it("demo 等免费模型（单价为 0）不扣积分", () => {
    const r = calcUsageCost(1000, 2000, 0, 0);
    expect(r.costUsd).toBe(0);
    expect(r.credits).toBe(0);
  });

  it("零用量也不扣积分", () => {
    expect(calcUsageCost(0, 0, 3, 15).credits).toBe(0);
  });

  it("成本极小但非零时兜底 1 积分", () => {
    const r = calcUsageCost(1, 1, 3, 15);
    expect(r.costUsd).toBeGreaterThan(0);
    expect(r.credits).toBe(1);
  });

  it("按成本 2 倍换算（50% 毛利）并向上取整", () => {
    // 0.033 * 2 / 0.02 = 3.3 -> 4
    expect(calcUsageCost(1000, 2000, 3, 15).credits).toBe(4);
    // 3 * 2 / 0.02 = 300，整数不额外上浮
    expect(calcUsageCost(1_000_000, 0, 3, 0).credits).toBe(300);
    expect(calcUsageCost(1_000_000, 1_000_000, 3, 15).credits).toBe(1800);
  });

  it("扣费积分折算成售价后不低于内部成本（不会亏本）", () => {
    const samples: Array<[number, number, number, number]> = [
      [1, 1, 3, 15],
      [1000, 2000, 3, 15],
      [12345, 6789, 0.15, 0.6],
      [1_000_000, 500_000, 3, 15],
      [7, 3, 10, 30],
    ];
    for (const [i, o, ip, op] of samples) {
      const r = calcUsageCost(i, o, ip, op);
      expect(r.credits * CREDIT_USD_VALUE).toBeGreaterThanOrEqual(r.costUsd);
    }
  });

  it("积分恒为非负整数", () => {
    for (const [i, o] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [999_999, 999_999],
    ]) {
      const { credits } = calcUsageCost(i, o, 3, 15);
      expect(Number.isInteger(credits)).toBe(true);
      expect(credits).toBeGreaterThanOrEqual(0);
    }
  });

  it("用量单调增时积分不减", () => {
    let prev = 0;
    for (const n of [1, 10, 100, 1000, 10_000, 100_000]) {
      const { credits } = calcUsageCost(n, n, 3, 15);
      expect(credits).toBeGreaterThanOrEqual(prev);
      prev = credits;
    }
  });

  it("售价常量为 $0.02，改动需同步 UI 文案", () => {
    expect(CREDIT_USD_VALUE).toBe(0.02);
  });
});

describe("reserveCredits 预扣", () => {
  const model = { inputPricePerMtok: 3, outputPricePerMtok: 15 };

  it("按最大输出上限预扣，避免长输出透支", () => {
    const reserved = reserveCredits("x".repeat(3500), 4000, model);
    const actual = calcUsageCost(1000, 500, model.inputPricePerMtok, model.outputPricePerMtok);
    expect(reserved).toBeGreaterThan(actual.credits);
  });

  it("与 calcUsageCost + estimateTokens 组合结果一致", () => {
    const text = "帮我写一份季度总结";
    expect(reserveCredits(text, 2000, model)).toBe(
      calcUsageCost(estimateTokens(text), 2000, model.inputPricePerMtok, model.outputPricePerMtok)
        .credits
    );
  });

  it("免费模型预扣为 0", () => {
    expect(reserveCredits("任意长度的提示词".repeat(100), 8000, {
      inputPricePerMtok: 0,
      outputPricePerMtok: 0,
    })).toBe(0);
  });

  it("空提示词也至少预扣 1 积分（因输入兜底 1 token）", () => {
    expect(reserveCredits("", 0, model)).toBe(1);
  });

  it("maxOutputTokens 越大预扣越多", () => {
    const a = reserveCredits("提示", 1000, model);
    const b = reserveCredits("提示", 8000, model);
    expect(b).toBeGreaterThan(a);
  });
});