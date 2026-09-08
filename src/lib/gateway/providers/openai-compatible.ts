import type { ChatCompletionParams, ProviderAdapter, ProviderId } from "../types";
import { GatewayError, parseRetryAfter } from "../retry";

interface OpenAICompatibleConfig {
  id: ProviderId;
  baseUrl: string;
  apiKey?: string;
  /** 首字节超时毫秒（AI6）：建连后迟迟没有第一个 delta 就快速失败；0 = 关闭 */
  ttftMs?: number;
}

/**
 * OpenAI Chat Completions 兼容协议适配器。
 * DeepSeek、阿里云百炼（Qwen，OpenAI 兼容模式）、OpenAI 官方均走此协议。
 *
 * 错误必须分类（AI2）：429/5xx 带状态码抛 GatewayError 供网关重试，
 * 4xx 参数错误标 fatal 直接失败；同时透传 Retry-After（AI3）。
 */
export function createOpenAICompatibleProvider(cfg: OpenAICompatibleConfig): ProviderAdapter {
  return {
    id: cfg.id,
    isConfigured() {
      return Boolean(cfg.apiKey);
    },
    async *streamChat({ model, messages, signal }: ChatCompletionParams) {
      if (!cfg.apiKey) throw new Error(`${cfg.id}: 未配置 API 密钥`);

      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: true }),
        signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new GatewayError(`${cfg.id} API 错误 ${res.status}: ${text.slice(0, 300)}`, {
          statusCode: res.status,
          // 4xx 是请求本身的问题，重试只会原样失败
          fatal: res.status >= 400 && res.status < 500 && res.status !== 429,
          retryAfterMs: parseRetryAfter(res.headers.get("retry-after")),
        });
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let firstTokenSeen = false;

      // AI6: TTFT 看门狗。reader.read() 不接受 signal，用「到点 reject 的
      // promise」参与 race 抢占——首块内容一到立即解除，全程只有未超时
      // 才挂着。卡死流比报错更伤体验：用户干等，服务端白烧 token。
      const ttftMs = cfg.ttftMs ?? 20_000;
      let ttftReject: ((err: Error) => void) | null = null;
      let ttftTimer: ReturnType<typeof setTimeout> | null = null;
      const armTtft = () => {
        // 首块内容已到或已超时后就不再武装：TTFT 只管「等第一个字」
        if (firstTokenSeen || ttftMs <= 0 || ttftTimer) return;
        ttftTimer = setTimeout(() => {
          ttftReject?.(
            new GatewayError(`${cfg.id} 首字节超时（${ttftMs}ms 无响应）`, {
              // 供应商偶发卡流常见，值得网关层重试
            })
          );
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
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") return;
            try {
              const json = JSON.parse(data) as {
                choices?: { delta?: { content?: string } }[];
                usage?: { prompt_tokens?: number; completion_tokens?: number };
              };
              // AI9: 部分兼容家在最后的 chunk 回带真实 usage，作为哨兵产出
              if (json.usage) {
                yield {
                  __upstreamUsage: true,
                  inputTokens: json.usage.prompt_tokens,
                  outputTokens: json.usage.completion_tokens,
                };
              }
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                if (!firstTokenSeen) {
                  firstTokenSeen = true;
                  disarmTtft();
                }
                yield delta;
              }
            } catch {
              // 忽略不完整的分片
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
