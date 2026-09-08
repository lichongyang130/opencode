import {
  buildProviders,
  getProviders,
  resolveModel,
  streamChatCompletion,
  type ChatMessage,
  type ProviderId,
  type ProviderOverrides,
} from "@/lib/gateway";
import { buildSlidesPrompt, themeOrDefault } from "@/lib/slides/prompt";
import { parseSlideDeck } from "@/lib/slides/parse";
import { buildSampleDeck } from "@/lib/slides/sample";
import { readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";
import { acquireSseSlot } from "@/lib/sse-registry";
import { sseFrame, type SseEvent } from "@/lib/sse-events";
import type { SlideDeck } from "@/lib/slides/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * PPT 生成接口 —— SSE。
 * 请求: { topic: string, model: string, theme?: ThemeId }
 * 事件协议（AI14）: status（进度） → usage（计费） → done（result=deck）| error
 * 演示模型/未配置密钥时返回内置示例 PPT，保证零配置可体验。
 */
export const POST = withRoute(
  async (req: Request) => {
    const body = await readJsonBody<{
      topic?: string;
      model?: string;
      provider?: ProviderId | null;
      theme?: string;
      overrides?: ProviderOverrides;
      context?: string;
    }>(req);
    if (!body) {
      return new Response(JSON.stringify({ error: "请求体不是有效的 JSON 对象" }), { status: 400 });
    }
    const topic = (body.topic ?? "").trim();
    const context = (body.context ?? "").trim();
    const modelId = body.model ?? "demo";
    const theme = themeOrDefault(body.theme);
    const overrides = body.overrides;

    if (!topic) {
      return new Response(JSON.stringify({ error: "topic 不能为空" }), { status: 400 });
    }

    const { providerId } = resolveModel(modelId, body.provider ?? null);
    const providers = overrides ? buildProviders(overrides) : getProviders();
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
          let deck: SlideDeck;

          if (!providerReady || modelId === "demo") {
            // 演示路径：模拟生成进度；基于研究报告时标题体现来源
            const steps = [
              "正在规划幻灯片结构…",
              "正在撰写各页内容…",
              "正在排版与配图…",
            ];
            for (const s of steps) {
              send({ type: "status", message: s });
              await sleep(450);
            }
            deck = buildSampleDeck(context ? `${topic}·研究汇报` : topic, theme);
          } else {
            // 真实模型路径
            const { system, user } = buildSlidesPrompt(topic, context);
            const messages: ChatMessage[] = [
              { role: "system", content: system },
              { role: "user", content: user },
            ];

            let raw = "";
            let lastProgress = 0;
            send({ type: "status", message: "AI 正在生成幻灯片大纲与内容…" });

            const usage = await streamChatCompletion(
              modelId,
              messages,
              {
                onToken: (delta) => {
                  raw += delta;
                  // 每累积约 400 字符推送一次进度
                  const pages = Math.min(12, 2 + Math.floor(raw.length / 400));
                  if (raw.length - lastProgress > 400) {
                    lastProgress = raw.length;
                    send({ type: "status", message: `正在撰写第 ${pages} 页内容…` });
                  }
                },
                signal: AbortSignal.any([req.signal, slot.signal]),
              },
              overrides,
              providerId
            );

            send({ type: "status", message: "正在解析与排版…" });
            const parsed = parseSlideDeck(raw, topic);
            deck = parsed.deck;
            // 解析降级不算失败：PPT 已经能用，只是提醒用户内容可能需要人工校对（R10）
            if (parsed.degraded) {
              send({
                type: "status",
                message: "模型未按结构化格式输出，已按文本大纲自动分页，建议检查内容",
              });
            } else if (parsed.repaired) {
              send({ type: "status", message: "模型输出被截断，已自动修复，末页内容可能不完整" });
            }
            send({ type: "usage", credits: usage.credits });
          }

          deck.theme = theme;
          send({ type: "done", result: deck });
        } catch (err) {
          send({
            type: "error",
            message: err instanceof Error ? err.message : "幻灯片生成失败",
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