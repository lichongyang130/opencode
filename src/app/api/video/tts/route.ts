import { synthesizeNarration, isTtsConfigured, TtsError } from "@/lib/gateway/tts";
import type { ProviderOverrides } from "@/lib/gateway/types";
import { readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 旁白转 TTS（V6）。
 * POST { text, overrides? } -> { audioUrl } | { error }
 * 未配置密钥返回 400 带明确说明（前端据此禁用按钮），畸形输入一律 400。
 */
export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<{ text?: string; overrides?: ProviderOverrides }>(req);
  if (!body) {
    return Response.json({ error: "请求体不是有效的 JSON 对象" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (!text) {
    return Response.json({ error: "text 不能为空" }, { status: 400 });
  }
  if (text.length > 600) {
    return Response.json({ error: "旁白过长（超过 600 字），请拆分镜头" }, { status: 400 });
  }
  if (!isTtsConfigured(body.overrides)) {
    return Response.json(
      { error: "未配置 TTS 供应商密钥（支持 OpenAI / 通义千问），请先在模型设置中配置" },
      { status: 400 }
    );
  }

  try {
    const audioUrl = await synthesizeNarration(text, {
      overrides: body.overrides,
      signal: req.signal,
    });
    return Response.json({ audioUrl });
  } catch (err) {
    if (err instanceof TtsError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "TTS 合成失败" },
      { status: 500 }
    );
  }
});