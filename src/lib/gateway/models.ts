import type { ModelInfo, ProviderId } from "./types";

/**
 * 模型目录 —— 国内 / 海外双市场。
 * 价格为公开 API 定价的量级参考（美元/百万 token），请随官方调价更新。
 * 未配置密钥的模型会在前端选择器中置灰。
 */
export const MODELS: ModelInfo[] = [
  {
    id: "demo",
    label: "演示模型（免费）",
    provider: "demo",
    providerLabel: "Built-in",
    region: "builtin",
    capabilities: ["text"],
    inputPricePerMtok: 0,
    outputPricePerMtok: 0,
  },
  // —— 海外 ——
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    providerLabel: "OpenAI",
    region: "global",
    capabilities: ["text"],
    inputPricePerMtok: 0.15,
    outputPricePerMtok: 0.6,
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    providerLabel: "OpenAI",
    region: "global",
    capabilities: ["text"],
    inputPricePerMtok: 2.5,
    outputPricePerMtok: 10,
  },
  {
    id: "claude-3-5-sonnet-20241022",
    label: "Claude 3.5 Sonnet",
    provider: "anthropic",
    providerLabel: "Anthropic",
    region: "global",
    capabilities: ["text"],
    inputPricePerMtok: 3,
    outputPricePerMtok: 15,
  },
  // —— 国内 ——
  {
    id: "deepseek-chat",
    label: "DeepSeek Chat (V3)",
    provider: "deepseek",
    providerLabel: "DeepSeek",
    region: "china",
    capabilities: ["text"],
    inputPricePerMtok: 0.27,
    outputPricePerMtok: 1.1,
  },
  {
    id: "qwen-plus",
    label: "通义千问 Qwen-Plus",
    provider: "dashscope",
    providerLabel: "阿里云百炼",
    region: "china",
    capabilities: ["text"],
    inputPricePerMtok: 0.4,
    outputPricePerMtok: 1.2,
  },
  {
    id: "qwen-max",
    label: "通义千问 Qwen-Max",
    provider: "dashscope",
    providerLabel: "阿里云百炼",
    region: "china",
    capabilities: ["text"],
    inputPricePerMtok: 2.4,
    outputPricePerMtok: 9.6,
  },
];

export function getModel(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

/** 静态目录里是否存在该模型（动态模型不在此列） */
export function isKnownModel(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}

/** 根据模型 id 前缀推断供应商（用于动态获取的模型） */
export function inferProvider(id: string): ProviderId | null {
  const x = id.toLowerCase();
  if (x.startsWith("gpt") || x.startsWith("o1") || x.startsWith("o3") || x.startsWith("o4") || x.startsWith("chatgpt")) return "openai";
  if (x.startsWith("claude")) return "anthropic";
  if (x.startsWith("deepseek")) return "deepseek";
  if (x.startsWith("qwen") || x.startsWith("wan")) return "dashscope";
  return null;
}

export interface ResolvedModel {
  model: ModelInfo;
  providerId: ProviderId;
  /**
   * 是否发生了兜底（R14）：id 既不在静态目录、也推断不出供应商，已回退演示模型。
   * 调用方必须据此提示用户 —— 悄悄换成 demo 会让人把内置假回答当成真实模型输出。
   */
  fallback: boolean;
}

/**
 * 解析模型：优先静态目录；动态模型（/models 拉取或中转自定义）按显式 provider 或前缀推断，
 * 找不到则回退演示模型。未知模型用低成本档计价。
 */
export function resolveModel(id: string, providerId?: ProviderId | null): ResolvedModel {
  const known = MODELS.find((m) => m.id === id);
  if (known) return { model: known, providerId: known.provider, fallback: false };

  const provider = providerId ?? inferProvider(id);
  if (provider && provider !== "demo") {
    return {
      model: {
        id,
        label: id,
        provider,
        providerLabel: provider,
        region: provider === "deepseek" || provider === "dashscope" ? "china" : "global",
        capabilities: ["text"],
        inputPricePerMtok: 0.5,
        outputPricePerMtok: 1.5,
      },
      providerId: provider,
      fallback: false,
    };
  }
  // 空 id / 拼错的 id / 已下线的中转模型都会走到这里
  return { model: MODELS[0], providerId: "demo", fallback: id !== "demo" };
}
