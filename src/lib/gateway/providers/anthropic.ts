import type { ChatCompletionParams, ProviderAdapter } from "../types";
import { GatewayError, parseRetryAfter } from "../retry";

/**
 * Anthropic Messages API 适配器（Claude 系列，海外）。
 * 协议与 OpenAI 不同：system 消息需单独传字段，SSE 事件类型为 content_block_delta。
 * 支持自定义 baseUrl（用于兼容 Anthropic 协议的中转服务）。
 *
 * 错误分类与 TTFT 与 openai-compatible 保持同一套语义（AI2/AI3/AI6）。
 */
export function createAnthropicProvider(
  apiKey?: string,
  baseUrl?: string,
  ttftMs = 20_000
): ProviderAdapter {
  const root = (baseUrl || "https://api.anthropic.com").replace(/\/+$/, "");
  return {
    id: "anthropic",
    isConfigured() {
      return Boolean(apiKey);
    },
    async *streamChat({ model, messages, signal }: ChatCompletionParams) {
      if (!apiKey) throw new Error("anthropic: 未配置 API 密钥");

      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
      const turns = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${root}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: system || undefined,
          messages: turns,
          stream: true,
        }),
        signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new GatewayError(`anthropic API 错误 ${res.status}: ${text.slice(0, 300)}`, {
          statusCode: res.status,
          fatal: res.status >= 400 && res.status < 500 && res.status !== 429,
          retryAfterMs: parseRetryAfter(res.headers.get("retry-after")),
        });
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let firstTokenSeen = false;

      // AI6: TTFT 看门狗（与 openai-compatible 同款模式）
      let ttftReject: ((err: Error) => void) | null = null;
      let ttftTimer: ReturnType<typeof setTimeout> | null = null;
      const armTtft = () => {
        if (firstTokenSeen || ttftMs <= 0 || ttftTimer) return;
        ttftTimer = setTimeout(() => {
          ttftReject?.(new GatewayError(`anthropic 首字节超时（${ttftMs}ms 无响应）`));
        }, ttftMs);
      };
      const disarmTtft = () => {
        if (ttftTimer) clearTimeout(ttftTimer);
        ttftTimer = null;
      };

      try {
        while (true) {
          armTtft();
          const { done, value } = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => {
              ttftReject = reject;
            }),
          ]);
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            try {
              const json = JSON.parse(trimmed.slice(5).trim()) as {
                type?: string;
                delta?: { text?: string };
                usage?: { output_tokens?: number; input_tokens?: number };
              };
              // AI9: Anthropic 在 message_start / message_delta 回带 usage
              if (json.usage) {
                yield {
                  __upstreamUsage: true,
                  inputTokens: json.usage.input_tokens,
                  outputTokens: json.usage.output_tokens,
                };
              }
              if (json.type === "content_block_delta" && json.delta?.text) {
                if (!firstTokenSeen) {
                  firstTokenSeen = true;
                  disarmTtft();
                }
                yield json.delta.text;
              }
            } catch {
              // 忽略不完整分片
            }
          }
        }
      } finally {
        disarmTtft();
        reader.cancel().catch(() => {});
      }
    },
  };
}
