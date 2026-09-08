import { buildProviders, getEnvApiKey, type ProviderId, type ProviderOverrides } from "@/lib/gateway";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BASE: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  anthropic: "https://api.anthropic.com",
};

/** 支持动态拉取模型列表的供应商（demo 无远端列表接口） */
const SUPPORTED = ["openai", "deepseek", "dashscope", "anthropic"] as const;
type SupportedProvider = (typeof SUPPORTED)[number];

interface FetchedModel {
  id: string;
}

/**
 * 动态获取某供应商账号/中转实际可用的模型列表。
 * POST { provider, overrides? } -> { models: string[] }
 */
export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<{ provider?: ProviderId; overrides?: ProviderOverrides }>(req);
  if (!body) return badJsonResponse();
  const provider = body.provider;
  // 白名单校验：非法值会让 providers[provider] 变成 undefined，
  // 后续 adapter.isConfigured() 直接抛 TypeError 变成 500
  if (!provider || !SUPPORTED.includes(provider as SupportedProvider)) {
    return Response.json({ error: "不支持的供应商" }, { status: 400 });
  }

  const providers = body.overrides ? buildProviders(body.overrides) : buildProviders();
  const adapter = providers[provider];
  if (!adapter.isConfigured()) {
    return Response.json({ error: "该供应商未配置密钥，请先在模型设置中填写 API Key" }, { status: 400 });
  }

  const ov = body.overrides?.[provider];
  const baseUrl = (ov?.baseUrl || DEFAULT_BASE[provider]).replace(/\/+$/, "");
  // 密钥优先前台 BYOK，其次服务端 env —— 与 isConfigured() 的判断保持一致，
  // 避免「env 配了密钥却发空 Bearer 导致 401」。
  const apiKey = ov?.apiKey || getEnvApiKey(provider as Exclude<ProviderId, "demo">) || "";

  try {
    let ids: string[] = [];

    if (provider === "anthropic") {
      const res = await fetch(`${baseUrl}/v1/models`, {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      if (!res.ok) throw new Error(`列表接口返回 ${res.status}`);
      const data = (await res.json()) as { data?: FetchedModel[] };
      ids = (data.data ?? []).map((m) => m.id);
    } else {
      // OpenAI 兼容：GET /models
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`列表接口返回 ${res.status}`);
      const data = (await res.json()) as { data?: FetchedModel[] };
      ids = (data.data ?? []).map((m) => m.id);
    }

    // 去重 + 过滤明显的非对话模型（embedding/audio/tts/whisper/image 等）
    const blocked = /(embed|tts|whisper|audio|speech|image|moderation|rerank|vision-ocr)/i;
    const models = [...new Set(ids)]
      .filter((id) => !blocked.test(id))
      .sort((a, b) => a.localeCompare(b));

    if (models.length === 0) return Response.json({ error: "未获取到可用模型" }, { status: 502 });
    return Response.json({ models });
  } catch (err) {
    return Response.json(
      { error: `获取失败：${err instanceof Error ? err.message : "网络错误"}（请检查 API Key 与 Base URL/中转地址）` },
      { status: 502 }
    );
  }
});
