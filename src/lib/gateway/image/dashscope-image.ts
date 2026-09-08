import type { ImageAdapter, ImageResult } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 阿里云百炼 通义万相 文生图（国内）。
 * 流程：创建异步任务 → 轮询状态 → 返回结果图 URL。
 * 参考百炼 multimodal-generation 接口。
 */
export function createDashScopeImageAdapter(apiKey?: string, baseUrl?: string): ImageAdapter {
  const root = (baseUrl || "https://dashscope.aliyuncs.com").replace(/\/+$/, "");
  return {
    id: "dashscope",
    isConfigured() {
      return Boolean(apiKey);
    },
    async generate(prompt, opts): Promise<ImageResult> {
      if (!apiKey) throw new Error("dashscope image: 未配置 DASHSCOPE_API_KEY");

      const size =
        opts.size === "1024x1792"
          ? "720*1280"
          : opts.size === "1792x1024"
            ? "1280*720"
            : "1024*1024";

      // IMG5: 参考图（图生图）——content 数组先放 image 再放 text，万相据此以图为基准生成
      const content: Array<{ text?: string; image?: string }> = [];
      if (opts.reference) content.push({ image: opts.reference });
      content.push({ text: prompt });

      // IMG4: 负向提示词走 parameters.negative_prompt（万相 t2i 支持）
      const parameters: Record<string, unknown> = { size, n: 1 };
      if (opts.negative?.trim()) parameters.negative_prompt = opts.negative.trim();

      const create = await fetch(
        `${root}/api/v1/services/aigc/multimodal-generation/generation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-DashScope-Async": "enable",
          },
          body: JSON.stringify({
            model: "wan2.7-t2i-flash",
            input: { messages: [{ role: "user", content }] },
            parameters,
          }),
          signal: opts.signal,
        }
      );
      if (!create.ok) {
        const t = await create.text().catch(() => "");
        throw new Error(`万相创建任务失败 ${create.status}: ${t.slice(0, 200)}`);
      }
      const created = (await create.json()) as { output?: { task_id?: string }; code?: string; message?: string };
      const taskId = created.output?.task_id;
      if (!taskId) throw new Error(`万相未返回任务ID: ${created.message ?? ""}`);

      // 轮询（最多约 90 秒）
      for (let i = 0; i < 30; i++) {
        await sleep(3000);
        const r = await fetch(`${root}/api/v1/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: opts.signal,
        });
        // 轮询请求也要校验状态，避免密钥失效/限流被吞成「超时」
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          throw new Error(`万相轮询失败 ${r.status}: ${t.slice(0, 200)}`);
        }
        const data = (await r.json()) as {
          output?: {
            task_status?: string;
            results?: { url?: string }[];
            message?: string;
          };
        };
        const status = data.output?.task_status;
        if (status === "SUCCEEDED") {
          const url = data.output?.results?.[0]?.url;
          if (!url) throw new Error("万相任务完成但无图片 URL");
          return { url, model: "wan2.7-t2i-flash" };
        }
        if (status === "FAILED") {
          throw new Error(`万相生成失败: ${data.output?.message ?? ""}`);
        }
      }
      throw new Error("万相生成超时");
    },
  };
}
