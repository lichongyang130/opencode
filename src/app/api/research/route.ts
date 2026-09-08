import { resolveModel, getProviders, type ProviderOverrides } from "@/lib/gateway";
import { runResearch, synthesizeFromSources } from "@/lib/research/engine";
import {
  DEPTH_PRESETS,
  RESEARCH_LANGUAGES,
  type ResearchDepth,
  type ResearchLanguage,
  type ResearchSource,
} from "@/lib/research/types";
import { readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";
import { acquireSseSlot } from "@/lib/sse-registry";
import { sseFrame, type SseEvent } from "@/lib/sse-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 深度研究 —— SSE。
 * 请求: { topic, model, overrides?, tavilyKey?, depth?, language? }
 * 事件协议（AI14 + RS1）: status（含 stage 阶段标记） → done（result=研究报告）| error
 * 无 Tavily 密钥时返回结构完整的示例报告（来源标注「示例」）。
 */
export const POST = withRoute(
  async (req: Request) => {
    const body = await readJsonBody<{
      topic?: string;
      model?: string;
      overrides?: ProviderOverrides;
      tavilyKey?: string;
      depth?: string;
      language?: string;
    }>(req);
    if (!body) {
      return new Response(JSON.stringify({ error: "请求体不是有效的 JSON 对象" }), { status: 400 });
    }
    const topic = (body.topic ?? "").trim();
    if (!topic) {
      return new Response(JSON.stringify({ error: "topic 不能为空" }), { status: 400 });
    }
    // RS5/RS8: 枚举校验，畸形值一律 400（不许静默吞成默认值）
    const depth = (Object.keys(DEPTH_PRESETS) as ResearchDepth[]).find((d) => d === body.depth) ?? "standard";
    if (body.depth !== undefined && body.depth !== depth) {
      return new Response(JSON.stringify({ error: "depth 仅支持 quick / standard / deep" }), { status: 400 });
    }
    const language = RESEARCH_LANGUAGES.find((l) => l === body.language) ?? "zh";
    if (body.language !== undefined && body.language !== language) {
      return new Response(JSON.stringify({ error: "language 仅支持 zh / en / ja" }), { status: 400 });
    }

    const modelId = body.model ?? "demo";
    const { providerId } = resolveModel(modelId, null);
    const providers = body.overrides
      ? (await import("@/lib/gateway")).buildProviders(body.overrides)
      : getProviders();
    const providerReady = modelId !== "demo" && providers[providerId].isConfigured();
    const useModel = providerReady ? modelId : "demo";

    const stream = new ReadableStream({
      async start(controller) {
        // 连接数兜底：满员直接拒绝
        const slot = acquireSseSlot();
        if (!slot) {
          controller.enqueue(sseFrame({ type: "error", message: "并发连接过多，请稍后重试" }));
          controller.close();
          return;
        }
        const send = (evt: SseEvent) => controller.enqueue(sseFrame(evt));
        try {
          const report = await runResearch(topic, {
            model: useModel,
            overrides: body.overrides,
            tavilyKey: body.tavilyKey,
            depth,
            language,
            // RS1: stage 随 status 透传，前端时间线按序点亮
            onProgress: (p) => send({ type: "status", message: p.message, stage: p.stage }),
            signal: AbortSignal.any([req.signal, slot.signal]),
          });
          send({ type: "done", result: report });
        } catch (err) {
          send({ type: "error", message: err instanceof Error ? err.message : "研究失败" });
        } finally {
          slot.release();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  },
  { slowMs: 0 }
);

/**
 * RS4: 基于选中来源重写——不做新检索，直接把勾选来源喂给综述段。
 * 请求: { topic, model, overrides?, language?, sources: ResearchSource[] }
 */
export const PUT = withRoute(async (req: Request) => {
  const body = await readJsonBody<{
    topic?: string;
    model?: string;
    overrides?: ProviderOverrides;
    language?: string;
    sources?: unknown;
  }>(req);
  if (!body) {
    return new Response(JSON.stringify({ error: "请求体不是有效的 JSON 对象" }), { status: 400 });
  }
  const topic = (body.topic ?? "").trim();
  if (!topic) {
    return new Response(JSON.stringify({ error: "topic 不能为空" }), { status: 400 });
  }
  if (
    !Array.isArray(body.sources) ||
    body.sources.length === 0 ||
    body.sources.length > 30 ||
    !body.sources.every(
      (s) =>
        s && typeof s === "object" && typeof (s as ResearchSource).title === "string" && typeof (s as ResearchSource).url === "string"
    )
  ) {
    return new Response(JSON.stringify({ error: "sources 必须为 1~30 条含 title/url 的来源" }), { status: 400 });
  }
  const language = RESEARCH_LANGUAGES.find((l) => l === body.language) ?? "zh";

  const modelId = body.model ?? "demo";
  const { providerId } = resolveModel(modelId, null);
  const providers = body.overrides
    ? (await import("@/lib/gateway")).buildProviders(body.overrides)
    : getProviders();
  const providerReady = modelId !== "demo" && providers[providerId].isConfigured();
  const useModel = providerReady ? modelId : "demo";

  const stream = new ReadableStream({
    async start(controller) {
      const slot = acquireSseSlot();
      if (!slot) {
        controller.enqueue(sseFrame({ type: "error", message: "并发连接过多，请稍后重试" }));
        controller.close();
        return;
      }
      const send = (evt: SseEvent) => controller.enqueue(sseFrame(evt));
      try {
        const report = await synthesizeFromSources({
          topic,
          model: useModel,
          overrides: body.overrides,
          sources: body.sources as ResearchSource[],
          language,
          onProgress: (p) => send({ type: "status", message: p.message, stage: p.stage ?? "write" }),
          signal: AbortSignal.any([req.signal, slot.signal]),
        });
        send({ type: "done", result: report });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "重写失败" });
      } finally {
        slot.release();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});