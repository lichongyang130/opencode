import type { ImageAdapter, ImageResult } from "./types";

/** OpenAI Images (DALL·E 3)，海外；支持自定义 baseUrl（中转服务） */
export function createOpenAIImageAdapter(apiKey?: string, baseUrl?: string): ImageAdapter {
  const root = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  return {
    id: "openai",
    isConfigured() {
      return Boolean(apiKey);
    },
    async generate(prompt, opts): Promise<ImageResult> {
      if (!apiKey) throw new Error("openai image: 未配置 OPENAI_API_KEY");
      // IMG5: DALL·E 3 不支持图生图/参考图，明确报错而不是静默忽略让用户误以为生效
      if (opts.reference) {
        throw new Error("OpenAI 绘图（DALL·E 3）暂不支持参考图，请改用通义万相或去掉参考图");
      }
      // IMG4: DALL·E 3 不支持负向提示词，此处忽略（负向词是增强项而非必需）
      const res = await fetch(`${root}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: opts.size === "1024x1792" ? "1024x1792" : opts.size === "1792x1024" ? "1792x1024" : "1024x1024",
        }),
        signal: opts.signal,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`OpenAI 图像错误 ${res.status}: ${t.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        data: { url?: string; b64_json?: string; revised_prompt?: string }[];
      };
      const item = data.data?.[0];
      if (!item) throw new Error("OpenAI 未返回图像");
      return {
        url: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url ?? "",
        model: "dall-e-3",
        revisedPrompt: item.revised_prompt,
      };
    },
  };
}
