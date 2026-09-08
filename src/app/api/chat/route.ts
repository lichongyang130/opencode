import {
  streamChatCompletion,
  type ChatMessage,
  type ProviderId,
  type ProviderOverrides,
} from "@/lib/gateway";
import { readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";
import { acquireSseSlot } from "@/lib/sse-registry";
import { sseFrame } from "@/lib/sse-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 对话接口 —— SSE 流式输出。
 * 请求: { model, messages, overrides?, provider? }
 * 事件协议见 src/lib/sse-events.ts（AI14）：
 *   delta  逐块文本增量
 *   usage  结束时的用量/计费回执
 *   error  失败终态
 */
export const POST = withRoute(
  async (req: Request) => {
    const body = await readJsonBody<{
      model?: string;
      messages?: ChatMessage[];
      overrides?: ProviderOverrides;
      provider?: ProviderId | null;
    }>(req);
    if (!body) {
      return new Response(JSON.stringify({ error: "请求体不是有效的 JSON 对象" }), { status: 400 });
    }
    const model = body.model ?? "demo";
    const messages = body.messages ?? [];
    const overrides = body.overrides;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages 不能为空" }), { status: 400 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        // 连接数兜底：满员直接拒绝，不给模型白烧 token 的机会
        const slot = acquireSseSlot();
        if (!slot) {
          controller.enqueue(sseFrame({ type: "error", message: "并发连接过多，请稍后重试" }));
          controller.close();
          return;
        }
        try {
          const result = await streamChatCompletion(
            model,
            messages,
            {
              onToken: (delta) => controller.enqueue(sseFrame({ type: "delta", delta })),
              // 客户端断开与连接超时都应中止上游模型流，避免白烧 token
              signal: AbortSignal.any([req.signal, slot.signal]),
            },
            overrides,
            body.provider ?? null
          );
          controller.enqueue(
            sseFrame({
              type: "usage",
              credits: result.credits,
              costUsd: result.costUsd,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
            })
          );
        } catch (err) {
          controller.enqueue(
            sseFrame({ type: "error", message: err instanceof Error ? err.message : "未知错误" })
          );
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
  // SSE 是长连接，不能用通用慢请求阈值告警
  { slowMs: 0 }
);