import type { ImageAdapter, ImageProviderId, ImageResult } from "./types";
import type { ProviderOverrides } from "../types";
import { IMAGE_MODELS, getImageModel } from "./models";
import { demoImageAdapter } from "./demo-image";
import { createOpenAIImageAdapter } from "./openai-image";
import { createDashScopeImageAdapter } from "./dashscope-image";

const DEFAULTS: Partial<Record<ImageProviderId, string>> = {
  openai: "https://api.openai.com/v1",
  dashscope: "https://dashscope.aliyuncs.com",
};
const ENV_KEY: Partial<Record<ImageProviderId, string | undefined>> = {
  openai: process.env.OPENAI_API_KEY,
  dashscope: process.env.DASHSCOPE_API_KEY,
};

function buildImageAdapters(overrides?: ProviderOverrides): Record<ImageProviderId, ImageAdapter> {
  const keyOf = (id: "openai" | "dashscope") => overrides?.[id]?.apiKey || ENV_KEY[id];
  const urlOf = (id: "openai" | "dashscope") => overrides?.[id]?.baseUrl || DEFAULTS[id];
  return {
    demo: demoImageAdapter,
    openai: createOpenAIImageAdapter(keyOf("openai"), urlOf("openai")),
    dashscope: createDashScopeImageAdapter(keyOf("dashscope"), urlOf("dashscope")),
  };
}

let cache: Record<ImageProviderId, ImageAdapter> | null = null;
function getAdapters(): Record<ImageProviderId, ImageAdapter> {
  if (!cache) cache = buildImageAdapters();
  return cache;
}

export function getImageProviderStatus(): Record<ImageProviderId, boolean> {
  const a = getAdapters();
  return Object.fromEntries(
    Object.entries(a).map(([id, adapter]) => [id, adapter.isConfigured()])
  ) as Record<ImageProviderId, boolean>;
}

/** 统一入口：按模型 id 路由到对应图像供应商（单张，n 固定 1） */
export async function generateImage(
  modelId: string,
  prompt: string,
  opts: { size: string; signal?: AbortSignal; overrides?: ProviderOverrides; negative?: string; reference?: string }
): Promise<ImageResult & { credits: number }> {
  return (await generateImages(modelId, prompt, { ...opts, n: 1 }))[0];
}

/**
 * 统一入口：一次生成 n 张（IMG2）。
 *
 * 所有 provider 的底层 n 都写死 1（dall-e-3 API 本身也不支持 n>1），
 * 所以「多张」在这里用 Promise.all 并发多次调用实现——所见即所得。
 */
export async function generateImages(
  modelId: string,
  prompt: string,
  opts: {
    size: string;
    n?: number;
    signal?: AbortSignal;
    overrides?: ProviderOverrides;
    negative?: string;
    reference?: string;
  }
): Promise<Array<ImageResult & { credits: number }>> {
  const model = getImageModel(modelId);
  const adapters = opts.overrides ? buildImageAdapters(opts.overrides) : getAdapters();
  const adapter = adapters[model.provider];
  if (!adapter.isConfigured()) {
    throw new Error(`绘图模型「${model.label}」未配置密钥，请在模型设置中配置或使用演示绘图`);
  }
  const n = Math.max(1, Math.min(4, opts.n ?? 1));
  const gen = () =>
    adapter.generate(prompt, {
      size: opts.size,
      signal: opts.signal,
      negative: opts.negative,
      reference: opts.reference,
    });
  const results = await Promise.all(Array.from({ length: n }, gen));
  return results.map((r) => ({ ...r, credits: model.creditsPerImage }));
}

export { IMAGE_MODELS, getImageModel };
export type { ImageResult };
