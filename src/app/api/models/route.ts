import { MODELS, getProviderConfigStatus } from "@/lib/gateway";
import { IMAGE_MODELS, getImageProviderStatus } from "@/lib/gateway/image";

export const runtime = "nodejs";

/** 供前端拉取模型目录及各供应商是否已配置密钥（不泄露密钥） */
export async function GET() {
  return Response.json({
    models: MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      provider: m.provider,
      providerLabel: m.providerLabel,
      region: m.region,
    })),
    imageModels: IMAGE_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      provider: m.provider,
      providerLabel: m.providerLabel,
      region: m.region,
    })),
    status: getProviderConfigStatus(),
    imageStatus: getImageProviderStatus(),
  });
}
