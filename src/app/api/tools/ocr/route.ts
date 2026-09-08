import { getEnvApiKey, type ProviderOverrides } from "@/lib/gateway";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { logger } from "@/lib/logger";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 图片转文字（OCR）：调用带视觉能力的模型。
 * 按「前台 BYOK 密钥优先、服务端 env 兜底」的顺序选择供应商：
 * - OpenAI      gpt-4o-mini（视觉）
 * - Anthropic   claude-3-5-sonnet-latest（视觉）
 * - 阿里云百炼   qwen-vl-max-latest（视觉，OpenAI 兼容模式）
 * 未配置任何密钥时返回明确错误，由前端提示用户去「模型设置」填密钥。
 */

const VISION_MODELS = {
  openai: { model: "gpt-4o-mini", base: "https://api.openai.com/v1" },
  anthropic: { model: "claude-3-5-sonnet-latest", base: "https://api.anthropic.com" },
  dashscope: { model: "qwen-vl-max-latest", base: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
} as const;

type VisionProvider = keyof typeof VISION_MODELS;

interface Body {
  image: string; // dataURL 或纯 base64
  mimeType?: string;
  prompt?: string;
  provider?: VisionProvider;
  overrides?: ProviderOverrides;
}

const MAX_BYTES = 8 * 1024 * 1024; // base64 前的原始图片大小上限 8MB

function splitDataUrl(raw: string): { mime: string; data: string } {
  const m = raw.match(/^data:([^;,]+);base64,(.*)$/s);
  if (m) return { mime: m[1], data: m[2] };
  return { mime: "image/png", data: raw.replace(/^data:[^,]*,/, "") };
}

function keyFor(id: VisionProvider, overrides?: ProviderOverrides) {
  return overrides?.[id]?.apiKey || getEnvApiKey(id) || "";
}

function baseFor(id: VisionProvider, overrides?: ProviderOverrides) {
  return (overrides?.[id]?.baseUrl || VISION_MODELS[id].base).replace(/\/+$/, "");
}

export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<Body>(req);
  if (!body) return badJsonResponse();

  if (!body.image) return Response.json({ error: "请先选择图片" }, { status: 400 });

  const { mime, data } = splitDataUrl(body.image);
  if (!/^image\//.test(mime)) {
    return Response.json({ error: "只支持图片文件（PNG / JPG / WebP 等）" }, { status: 400 });
  }
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > MAX_BYTES) {
    return Response.json({ error: `图片过大（${(bytes / 1024 / 1024).toFixed(1)}MB），请压缩到 8MB 以内` }, { status: 400 });
  }

  const order: VisionProvider[] = body.provider
    ? [body.provider]
    : ["openai", "dashscope", "anthropic"];
  const provider = order.find((p) => Boolean(keyFor(p, body.overrides)));

  if (!provider) {
    return Response.json(
      {
        error:
          "图片转文字需要带视觉能力的模型：请在「模型设置」里填写 OpenAI / Anthropic / 阿里云百炼 任一密钥后重试（演示模型不支持读图）。",
        needKey: true,
      },
      { status: 400 }
    );
  }

  const prompt =
    body.prompt?.trim() ||
    "请识别图片中的全部文字，按原文排版输出（保留换行与列表结构）。如果图片中有表格，请用 Markdown 表格还原。只输出识别到的文字，不要解释、不要加前后缀。";

  try {
    let text = "";

    if (provider === "anthropic") {
      const res = await fetch(`${baseFor("anthropic", body.overrides)}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keyFor("anthropic", body.overrides),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: VISION_MODELS.anthropic.model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mime, data } },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        // 上游响应体可能含内部地址/密钥片段，交给 logger 脱敏后只记服务端日志
        logger.error("OCR 上游失败", { provider: "anthropic", status: res.status, detail });
        throw new Error(`视觉模型服务返回 ${res.status}`);
      }
      const json = (await res.json()) as { content?: { type?: string; text?: string }[] };
      text = (json.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
    } else {
      const cfg = VISION_MODELS[provider];
      const res = await fetch(`${baseFor(provider, body.overrides)}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keyFor(provider, body.overrides)}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mime};base64,${data}` } },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        logger.error("OCR 上游失败", { provider, status: res.status, detail });
        throw new Error(`视觉模型服务返回 ${res.status}`);
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      text = json.choices?.[0]?.message?.content ?? "";
    }

    if (!text.trim()) throw new Error("模型没有返回文字内容");
    return Response.json({ ok: true, text: text.trim(), provider, model: VISION_MODELS[provider].model });
  } catch (err) {
    return Response.json(
      { error: `识别失败：${err instanceof Error ? err.message : "未知错误"}` },
      { status: 502 }
    );
  }
});

/** 探测：返回当前可用的视觉供应商，供前端提示 */
export function GET() {
  const available = (["openai", "dashscope", "anthropic"] as VisionProvider[]).filter((p) =>
    Boolean(getEnvApiKey(p))
  );
  return Response.json({ serverConfigured: available });
}
