import { resolveModel } from "./models";
import { calcUsageCost, estimateTokens } from "./credits";
import { buildProviders, getProviders } from "./providers";
import { withRetry, GatewayError, isAbortError, type RetryOptions } from "./retry";
import { usageRepo, creditRepo } from "@/lib/db/repo";
import { isUpstreamUsage, type ChatMessage, type ProviderId, type ProviderOverrides, type ProviderAdapter } from "./types";
import type { ModelInfo } from "./types";

export * from "./types";
export * from "./models";
export * from "./credits";
export * from "./retry";
export { getProviders, getProviderConfigStatus, buildProviders, getEnvApiKey } from "./providers";

export interface StreamHandlers {
  onToken: (delta: string) => void;
  signal?: AbortSignal;
  /** 首个 token 到达时的回调（TTFT 指标，AI10 观测用） */
  onFirstToken?: () => void;
}

export interface StreamResult {
  credits: number;
  costUsd: number;
  outputTokens: number;
  inputTokens: number;
  durationMs: number;
  /** AI9：usage 值来自上游真实回执（true）还是 estimateTokens 估算 */
  usageFromUpstream: boolean;
}

/**
 * 服务端 AI 调用统一超时（AI4）。
 * 分两层：TTFT 短超时管「首字节」（providers 内实现），这里管整体——
 * 生成再慢也该有个上限，否则客户端早就走了服务端还在白烧 token。
 */
const OVERALL_TIMEOUT_MS = 120_000;

/** AI13 响应缓存：短 TTL 复用相同 prompt + 模型的结果（demo 与流式场景关闭） */
const responseCache = new Map<string, { text: string; result: Omit<StreamResult, "durationMs">; at: number }>();
const CACHE_TTL_MS = 60_000;
let cacheEnabled = process.env.OC_RESPONSE_CACHE !== "off";

export function setResponseCacheEnabled(v: boolean): void {
  cacheEnabled = v;
  if (!v) responseCache.clear();
}

/** AI12 单次请求成本上限（积分）：超限直接拒绝，防止超长会话一次烧穿余额 */
const MAX_CREDITS_PER_REQUEST = Number(process.env.OC_MAX_CREDITS_PER_REQUEST ?? 500);

function cacheKey(modelId: string, messages: ChatMessage[]): string {
  return `${modelId}::${messages.map((m) => `${m.role}:${m.content}`).join("\n")}`;
}

/**
 * 多供应商故障转移（AI7）：
 * 主供应商连续失败达到阈值后，在内存里熔断一段时间；网关层调用时
 * 若主供应商被熔断且存在可用的 OpenAI 兼容备胎，则自动换用。
 */
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60_000;
const circuit = new Map<ProviderId, { fails: number; openUntil: number }>();

function recordProviderResult(id: ProviderId, ok: boolean): void {
  const s = circuit.get(id) ?? { fails: 0, openUntil: 0 };
  s.fails = ok ? 0 : s.fails + 1;
  if (s.fails >= CIRCUIT_THRESHOLD) {
    s.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    s.fails = 0;
  }
  circuit.set(id, s);
}

function isCircuitOpen(id: ProviderId): boolean {
  const s = circuit.get(id);
  return Boolean(s && s.openUntil > Date.now());
}

/** 熔断状态下挑选降级供应商：同协议（OpenAI 兼容）且已配置密钥的优先 */
function pickFallback(
  providers: Record<ProviderId, ProviderAdapter>,
  primaryId: ProviderId,
  model: ModelInfo
): ProviderAdapter | null {
  if (!isCircuitOpen(primaryId)) return null;
  // 备选顺序：同协议兼容家 → 其他已配置的；demo 永远最后兜底
  const order: ProviderId[] = ["openai", "deepseek", "dashscope", "anthropic", "demo"];
  for (const id of order) {
    if (id === primaryId) continue;
    const p = providers[id];
    if (p.isConfigured()) return p;
  }
  return null;
}

/**
 * 网关统一入口：按 model id 路由到对应供应商，流式回调 token，
 * 结束后返回用量与应扣积分。overrides 为前台传入的 BYOK 配置。
 *
 * 韧性链路（AI1-AI9 全在这条链上）：
 *   成本上限预检(AI12) → 缓存命中(AI13) → 积分预扣(AI11) →
 *   重试包装(AI1-AI3) → 故障转移(AI7) → 流式产出（TTFT 由 provider 保证，AI6）→
 *   真实 usage 优先(AI9) → 结算/回滚(AI11) → 用量落库(AI8)
 */
export async function streamChatCompletion(
  modelId: string,
  messages: ChatMessage[],
  handlers: StreamHandlers,
  overrides?: ProviderOverrides,
  providerHint?: ProviderId | null,
  opts?: {
    conversationId?: string;
    retry?: RetryOptions;
    useCache?: boolean;
  }
): Promise<StreamResult> {
  const startedAt = Date.now();
  const { model, providerId } = resolveModel(modelId, providerHint);
  const providers = overrides ? buildProviders(overrides) : getProviders();
  const primary = providers[providerId];

  if (!primary.isConfigured()) {
    throw new Error(`模型「${model.label}」的供应商未配置密钥，请在模型设置中配置或切换演示模型`);
  }

  const inputText = messages.map((m) => m.content).join("\n");
  const inputTokensEst = estimateTokens(inputText);

  // AI12：按「输入 × 预估最大输出」先算一个保守上限，超限拒绝。
  // 用输出上限 4096 做保守估算；真实结算按实际输出算，通常远低于此。
  const worstCase = calcUsageCost(inputTokensEst, 4096, model.inputPricePerMtok, model.outputPricePerMtok);
  if (worstCase.credits > MAX_CREDITS_PER_REQUEST) {
    throw new GatewayError(
      `该请求预估消耗 ${worstCase.credits} 积分，超过单次上限 ${MAX_CREDITS_PER_REQUEST}，请缩短输入或换更便宜的模型`,
      { fatal: true }
    );
  }

  // AI13 缓存：只缓存非流式关心的最终文本；命中后仍逐块回放保持调用方无感
  const key = cacheKey(modelId, messages);
  const useCache = (opts?.useCache ?? true) && cacheEnabled && providerId !== "demo";
  if (useCache) {
    const hit = responseCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      for (const chunk of hit.text.match(/[\s\S]{1,24}/g) ?? []) {
        handlers.onToken(chunk);
      }
      return { ...hit.result, durationMs: Date.now() - startedAt };
    }
  }

  // AI11：预扣积分（保守按 worstCase 的下限——输入成本 + 512 token 输出）；
  // demo 免费。预扣失败直接抛给上层提示用户。
  const reservedCredits = calcUsageCost(
    inputTokensEst,
    512,
    model.inputPricePerMtok,
    model.outputPricePerMtok
  ).credits;
  const reserveId = creditRepo.reserve(reservedCredits, `模型调用 ${modelId}`);

  let output = "";
  let firstTokenAt = 0;
  let usageFromUpstream = false;
  // TS 的流分析不会跟踪闭包内赋值，这里必须用 ref 对象而非裸 let，
  // 否则外层读取处会被收窄成 null 导致编译不过
  const upstreamUsage: { current: { inputTokens?: number; outputTokens?: number } | null } = { current: null };

  // signal 要下传给 provider 的 fetch（AI4 整体超时 + 用户主动停止共用一个通道）；
  // 哨兵 chunk（上游真实 usage）被剥离出 output（AI9）
  const runStream = async (provider: ProviderAdapter, providerModelId: string, signal: AbortSignal) => {
    for await (const chunk of provider.streamChat({
      model: providerModelId,
      messages,
      signal,
    })) {
      if (isUpstreamUsage(chunk)) {
        // 后到的 usage 覆盖先到的（Anthropic 的 message_delta 在结尾更准）
        upstreamUsage.current = { inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens };
        continue;
      }
      if (!firstTokenAt) {
        firstTokenAt = Date.now();
        handlers.onFirstToken?.();
      }
      output += chunk;
      handlers.onToken(chunk);
    }
  };

  try {
    const chosen = pickFallback(providers, providerId, model) ?? primary;

    // AI1-AI4 + AI7：整体超时与用户停止合成一个 signal 下传；
    // withRetry 管可重试错误的退避重发，AbortError 不重试直接透传
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(), OVERALL_TIMEOUT_MS);
    const signals: AbortSignal[] = [timeoutCtrl.signal];
    if (handlers.signal) signals.push(handlers.signal);
    const combined = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

    try {
      await withRetry(
        async () => {
          output = "";
          firstTokenAt = 0;
          upstreamUsage.current = null;
          await runStream(chosen, model.id, combined);
          recordProviderResult(chosen.id, true);
        },
        {
          ...opts?.retry,
        }
      );
    } catch (err) {
      // AI7：失败计入熔断计数（用户主动停止不计失败）
      if (!isAbortError(err)) recordProviderResult(chosen.id, false);
      throw err;
    } finally {
      clearTimeout(timer);
    }

    // AI9：优先用上游真实 usage（部分供应商在最后一个 SSE chunk 回带）。
    // 注意不能依赖流分析：upstreamUsage 在闭包里赋值，外层不会收窄
    const upstreamIn = upstreamUsage.current?.inputTokens;
    const upstreamOut = upstreamUsage.current?.outputTokens;
    usageFromUpstream =
      typeof upstreamIn === "number" &&
      upstreamIn > 0 &&
      typeof upstreamOut === "number" &&
      upstreamOut > 0;
    const inputTokens = usageFromUpstream ? (upstreamIn as number) : inputTokensEst;
    const outputTokens = usageFromUpstream ? (upstreamOut as number) : estimateTokens(output);

    const usage = calcUsageCost(
      inputTokens,
      outputTokens,
      model.inputPricePerMtok,
      model.outputPricePerMtok
    );

    // AI11：结算（实际消耗 ≤ 预扣时差额自动退还）
    creditRepo.settle(reserveId, usage.credits);

    const result: Omit<StreamResult, "durationMs"> = {
      credits: usage.credits,
      costUsd: usage.costUsd,
      outputTokens: usage.outputTokens,
      inputTokens: usage.inputTokens,
      usageFromUpstream,
    };

    // AI8：用量落库（成功）
    usageRepo.record({
      conversationId: opts?.conversationId ?? null,
      model: modelId,
      provider: chosen.id,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: usage.costUsd,
      credits: usage.credits,
      success: true,
      durationMs: Date.now() - startedAt,
    });

    // AI13：写缓存
    if (useCache && output) {
      responseCache.set(key, { text: output, result, at: Date.now() });
    }

    return { ...result, durationMs: Date.now() - startedAt };
  } catch (err) {
    // AI11：失败回滚预扣（用户停止也算「未完成」，一并回滚）
    creditRepo.refund(reserveId);
    // AI8：失败也落库（credits 0，用于排障与成功率看板）
    usageRepo.record({
      conversationId: opts?.conversationId ?? null,
      model: modelId,
      provider: providerId,
      inputTokens: inputTokensEst,
      outputTokens: estimateTokens(output),
      costUsd: 0,
      credits: 0,
      success: false,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}
