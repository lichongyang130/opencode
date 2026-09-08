/**
 * 模型网关 —— 统一类型定义
 * 所有供应商（国内/海外）都适配为这一套接口。
 */

export type Region = "global" | "china" | "builtin";

export type ModelCapability = "text" | "image" | "video";

export type ProviderId =
  | "demo" // 内置免费演示（无需密钥）
  | "openai" // 海外
  | "anthropic" // 海外
  | "deepseek" // 国内
  | "dashscope"; // 国内（通义千问）

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelInfo {
  id: string; // 对外暴露的模型 id，如 "deepseek-chat"
  label: string; // 界面显示名
  provider: ProviderId;
  providerLabel: string;
  region: Region;
  capabilities: ModelCapability[];
  /** 输入价格（美元 / 百万 token），用于成本核算 */
  inputPricePerMtok: number;
  /** 输出价格（美元 / 百万 token） */
  outputPricePerMtok: number;
  /** 1 积分 = INTEGRAL_CREDIT_USD 美元（见 credits.ts） */
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

/** 前台传入的供应商配置（BYOK：浏览器本地保存的密钥 / 中转 Base URL） */
export interface ProviderOverride {
  apiKey?: string;
  baseUrl?: string;
}
export type ProviderOverrides = Partial<Record<ProviderId, ProviderOverride>>;

/**
 * 供应商适配器：返回一个 async generator，逐块产出文本增量。
 * 最后可 yield 一个带 usage 的哨兵对象（AI9：上游真实 token 数优先于估算），
 * 网关层负责识别并剥离，不透传给 onToken。
 */
export interface ProviderAdapter {
  id: ProviderId;
  /** 是否已配置密钥（demo 永远可用） */
  isConfigured(): boolean;
  streamChat(params: ChatCompletionParams): AsyncGenerator<string | UpstreamUsage, void, unknown>;
}

/** 流的最后一个哨兵产出：携带上游回执的真实用量（AI9） */
export interface UpstreamUsage {
  __upstreamUsage: true;
  inputTokens?: number;
  outputTokens?: number;
}

export function isUpstreamUsage(chunk: string | UpstreamUsage): chunk is UpstreamUsage {
  return typeof chunk === "object" && chunk !== null && "__upstreamUsage" in chunk;
}
