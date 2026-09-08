import type { ProviderAdapter, ProviderId, ProviderOverrides } from "../types";
import { createOpenAICompatibleProvider } from "./openai-compatible";
import { createAnthropicProvider } from "./anthropic";
import { demoProvider } from "./demo";

const DEFAULTS: Record<Exclude<ProviderId, "demo">, string> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  anthropic: "https://api.anthropic.com",
};

const ENV_KEY: Record<Exclude<ProviderId, "demo">, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  dashscope: process.env.DASHSCOPE_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
};

let cache: Record<ProviderId, ProviderAdapter> | null = null;

/** 按覆盖配置（来自前台设置）构建供应商集合；环境变量作为兜底 */
export function buildProviders(overrides?: ProviderOverrides): Record<ProviderId, ProviderAdapter> {
  const keyOf = (id: Exclude<ProviderId, "demo">) => overrides?.[id]?.apiKey || ENV_KEY[id];
  const urlOf = (id: Exclude<ProviderId, "demo">) => overrides?.[id]?.baseUrl || DEFAULTS[id];

  return {
    demo: demoProvider,
    openai: createOpenAICompatibleProvider({
      id: "openai",
      baseUrl: urlOf("openai"),
      apiKey: keyOf("openai"),
    }),
    deepseek: createOpenAICompatibleProvider({
      id: "deepseek",
      baseUrl: urlOf("deepseek"),
      apiKey: keyOf("deepseek"),
    }),
    dashscope: createOpenAICompatibleProvider({
      id: "dashscope",
      baseUrl: urlOf("dashscope"),
      apiKey: keyOf("dashscope"),
    }),
    anthropic: createAnthropicProvider(keyOf("anthropic"), urlOf("anthropic")),
  };
}

/** 默认供应商（仅环境变量），带缓存 */
export function getProviders(): Record<ProviderId, ProviderAdapter> {
  if (!cache) cache = buildProviders();
  return cache;
}

/** 读取服务端环境变量中某供应商的密钥（不泄露内容，仅供路由内部兜底使用） */
export function getEnvApiKey(id: Exclude<ProviderId, "demo">): string | undefined {
  return ENV_KEY[id];
}

/** 供前端展示：服务端环境变量配置状态（不泄露密钥） */
export function getProviderConfigStatus(): Record<ProviderId, boolean> {
  const p = getProviders();
  return Object.fromEntries(
    Object.entries(p).map(([id, adapter]) => [id, adapter.isConfigured()])
  ) as Record<ProviderId, boolean>;
}
