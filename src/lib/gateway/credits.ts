/**
 * 积分计费（第 0 阶段为纯函数 + 内存模拟，第 2 阶段接数据库/支付）。
 *
 * 计费原则（详见 docs/hix-ai-clone-plan.md 第八节）：
 *  - 1 积分 = 0.02 美元售价；内部成本按模型真实 token 价格核算，保证毛利。
 *  - 调用前「预扣」，失败回滚；成功后按真实用量结算。
 */

export const CREDIT_USD_VALUE = 0.02; // 用户视角：1 积分值 $0.02

/** 粗略 token 估算：中文约 1 字/token，英文约 4 字符/token，取 3.5 字符/token 的折中 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 3.5));
}

export interface UsageCost {
  inputTokens: number;
  outputTokens: number;
  /** 内部美元成本 */
  costUsd: number;
  /** 应扣积分（按成本上浮后换算，最少 1 积分） */
  credits: number;
}

/**
 * 成本 -> 积分：成本 × 2（目标 50% 毛利）再换算成积分。
 * demo 模型免费。
 */
export function calcUsageCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMtok: number,
  outputPricePerMtok: number
): UsageCost {
  const costUsd =
    (inputTokens / 1_000_000) * inputPricePerMtok +
    (outputTokens / 1_000_000) * outputPricePerMtok;
  const credits = costUsd === 0 ? 0 : Math.max(1, Math.ceil((costUsd * 2) / CREDIT_USD_VALUE));
  return { inputTokens, outputTokens, costUsd, credits };
}

/** 对话前预扣积分的上限估算（防止超长输出透支） */
export function reserveCredits(
  messagesText: string,
  maxOutputTokens: number,
  model: { inputPricePerMtok: number; outputPricePerMtok: number }
): number {
  const { credits } = calcUsageCost(
    estimateTokens(messagesText),
    maxOutputTokens,
    model.inputPricePerMtok,
    model.outputPricePerMtok
  );
  return credits;
}
