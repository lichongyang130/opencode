import {
  buildProviders,
  getProviders,
  resolveModel,
  streamChatCompletion,
  type ChatMessage,
  type ProviderId,
  type ProviderOverrides,
} from "@/lib/gateway";
import { buildStoryboardPrompt } from "@/lib/video/prompt";
import { parseStoryboard } from "@/lib/video/parse";
import { readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";
import { acquireSseSlot } from "@/lib/sse-registry";
import { sseFrame, type SseEvent } from "@/lib/sse-events";
import { buildSampleStoryboard } from "@/lib/video/sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 分镜生成（V2）—— SSE。
 * 请求: { topic, model, targetSec?, style?, overrides?, provider? }
 * 事件协议（AI14）: status → usage → done（result=Storyboard）| error
 * 演示模型/未配置密钥时返回内置示例分镜，保证零配置可体验。
 */
export const POST = withRoute(
  async (req: Request) => {
    const body = await readJsonBody<{
      topic?: string;
      model?: string;
      provider?: ProviderId | null;
      targetSec?: number;
      style?: string;
      overrides?: ProviderOverrides;
    }>(req);
    if (!body) {
      return new Response(JSON.stringify({ error: "请求体不是有效的 JSON 对象" }), { status: 400 });
    }
    const topic = (body.topic ?? "").trim();
    if (!topic) {
      return new Response(JSON.stringify({ error: "topic 不能为空" }), { status: 400 });
    }
    if (body.targetSec !== undefined && (!Number.isFinite(body.targetSec) || body.targetSec < 5 || body.targetSec > 600)) {
      return new Response(JSON.stringify({ error: "targetSec 需在 5~600 秒之间" }), { status: 400 });
    }

    const modelId = body.model ?? "demo";
    const { providerId } = resolveModel(modelId, body.provider ?? null);
    const providers = body.overrides ? buildProviders(body.overrides) : getProviders();
    const providerReady = modelId === "demo" ? false : providers[providerId].isConfigured();

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
          let storyboard;

          if (!providerReady || modelId === "demo") {
            const steps = ["正在规划叙事结构…", "正在拆分镜头…", "正在撰写旁白与字幕…"];
            for (const s of steps) {
              send({ type: "status", message: s });
              await sleep(450);
            }
            storyboard = buildSampleStoryboard(topic, body.targetSec, body.style);
          } else {
            const { system, user } = buildStoryboardPrompt(topic, {
              targetSec: body.targetSec,
              style: body.style,
            });
            const messages: ChatMessage[] = [
              { role: "system", content: system },
              { role: "user", content: user },
            ];

            let raw = "";
            let lastProgress = 0;
            send({ type: "status", message: "AI 正在编排分镜脚本…" });

            const usage = await streamChatCompletion(
              modelId,
              messages,
              {
                onToken: (delta) => {
                  raw += delta;
                  const shots = Math.min(12, 2 + Math.floor(raw.length / 300));
                  if (raw.length - lastProgress > 300) {
                    lastProgress = raw.length;
                    send({ type: "status", message: `正在撰写第 ${shots} 个镜头…` });
                  }
                },
                signal: AbortSignal.any([req.signal, slot.signal]),
              },
              body.overrides,
              providerId
            );

            send({ type: "status", message: "正在校验分镜结构…" });
            const parsed = parseStoryboard(raw, topic.slice(0, 40));
            storyboard = parsed.storyboard;
            // 解析降级不算失败（与 slides R10 同一取舍）：能编辑的草稿好过一句「失败」
            if (parsed.degraded) {
              send({ type: "status", message: "模型未按结构化格式输出，已按文本自动分镜，建议检查内容" });
            } else if (parsed.repaired) {
              send({ type: "status", message: "模型输出被截断，已自动修复，末尾镜头可能不完整" });
            }
            send({ type: "usage", credits: usage.credits });
          }

          send({ type: "done", result: storyboard });
        } catch (err) {
          send({
            type: "error",
            message: err instanceof Error ? err.message : "分镜生成失败",
          });
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