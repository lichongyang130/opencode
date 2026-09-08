import { generateImages } from "@/lib/gateway/image";
import type { ProviderOverrides } from "@/lib/gateway";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 尺寸白名单（网关与输入舱共用同一批 id，这里兜底校验畸形输入按规范返 400） */
const VALID_SIZES = ["1024x1024", "1792x1024", "1024x1792"];

/**
 * 文生图。
 * POST { model, prompt, size, n?, negative?, reference?, overrides? }
 *   - n=1（默认）→ { url, model, credits, revisedPrompt? }（与旧版单张返回完全兼容）
 *   - n>1（IMG2）→ { images: [{ url, model, revisedPrompt? }], credits }
 * 演示模型返回 SVG data URI；真实模型返回图床 URL / base64。
 */
export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<{
    model?: string;
    prompt?: string;
    size?: string;
    n?: number;
    negative?: string;
    reference?: string;
    overrides?: ProviderOverrides;
  }>(req);
  if (!body) return badJsonResponse();
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return Response.json({ error: "prompt 不能为空" }, { status: 400 });

  // 显式传 null / 非字符串 / 越白名单属于畸形输入，与「未传走默认」区分开，按规范 400
  const size = typeof body.size === "string" && VALID_SIZES.includes(body.size) ? body.size : undefined;
  if (body.size !== undefined && size === undefined) {
    return Response.json({ error: "size 仅支持 1024x1024 / 1792x1024 / 1024x1792" }, { status: 400 });
  }

  // IMG2: 张数 1~4，非整数/越界一律 400（不许静默吞成 1）；显式 null 同样拒
  const nOk = typeof body.n === "number" && Number.isInteger(body.n) && body.n >= 1 && body.n <= 4;
  if (body.n !== undefined && !nOk) {
    return Response.json({ error: "n 仅支持 1~4 的整数" }, { status: 400 });
  }

  // IMG5: 参考图只接受 data URI 或公网 http(s)，越界/超长直接拒绝，不冒 500
  const reference = (body.reference ?? "").trim();
  if (reference) {
    const okShape = reference.startsWith("data:image/") || /^https?:\/\//.test(reference);
    if (!okShape) return Response.json({ error: "reference 仅支持 data:image/ 或 http(s) 链接" }, { status: 400 });
    // data URI base64 大约 12M 字符（约 9MB），万相单图参考上限之内
    if (reference.length > 12_000_000) return Response.json({ error: "参考图过大，请压缩后重试" }, { status: 400 });
  }

  const negative = (body.negative ?? "").trim() || undefined;

  try {
    const results = await generateImages(body.model ?? "demo-image", prompt, {
      size: size ?? "1024x1024",
      n: body.n ?? 1,
      negative,
      reference: reference || undefined,
      overrides: body.overrides,
    });
    if (results.length === 1) return Response.json(results[0]);
    const images = results.map(({ url, model, revisedPrompt }) => ({ url, model, revisedPrompt }));
    return Response.json({ images, credits: results.reduce((sum, r) => sum + r.credits, 0) });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "图像生成失败" },
      { status: 500 }
    );
  }
});