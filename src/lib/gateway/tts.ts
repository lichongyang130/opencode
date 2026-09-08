import type { ProviderOverrides } from "./types";
import { safeFetch } from "@/lib/net-guard";

/**
 * 旁白转 TTS（V6）：供应商适配位。
 *
 * 与 image gateway 同一套取舍：
 * - 支持 OpenAI 兼容的 /audio/speech（openai / dashscope 同构）；
 * - 未配置任何密钥时 isTtsConfigured() 返回 false，前端禁用按钮并说明，
 *   绝不偷偷走「假音频」让用户误以为拿到了成品。
 * 音频产物是 data: URI（mp3），直接挂到分镜的 audioUrl。
 */

const DEFAULT_OPENAI = "https://api.openai.com/v1";

export function ttsApiKey(overrides?: ProviderOverrides): string | undefined {
  const openai = overrides?.openai?.apiKey || process.env.OPENAI_API_KEY;
  if (openai) return openai;
  return overrides?.dashscope?.apiKey || process.env.DASHSCOPE_API_KEY;
}

export function isTtsConfigured(overrides?: ProviderOverrides): boolean {
  return Boolean(ttsApiKey(overrides));
}

export class TtsError extends Error {}

/** 单镜旁白转语音；返回 mp3 的 data URI */
export async function synthesizeNarration(
  text: string,
  opts?: { overrides?: ProviderOverrides; signal?: AbortSignal }
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) throw new TtsError("旁白为空，无需合成");
  if (trimmed.length > 600) throw new TtsError("旁白过长（超过 600 字），请拆分镜头");

  const openaiKey = opts?.overrides?.openai?.apiKey || process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return synthesizeOpenAiCompatible(
      openaiKey,
      opts?.overrides?.openai?.baseUrl || DEFAULT_OPENAI,
      trimmed,
      opts?.signal
    );
  }
  const dashKey = opts?.overrides?.dashscope?.apiKey || process.env.DASHSCOPE_API_KEY;
  if (dashKey) {
    // DashScope 的 OpenAI 兼容端点同样暴露 /audio/speech
    return synthesizeOpenAiCompatible(
      dashKey,
      opts?.overrides?.dashscope?.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      trimmed,
      opts?.signal
    );
  }
  throw new TtsError("未配置 TTS 供应商密钥（支持 OpenAI / 通义千问），请先在模型设置中配置");
}

async function synthesizeOpenAiCompatible(
  apiKey: string,
  baseUrl: string,
  text: string,
  signal?: AbortSignal
): Promise<string> {
  const res = await safeFetch(`${baseUrl.replace(/\/$/, "")}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "mp3",
    }),
    signal,
  });
  if (!res.ok) {
    throw new TtsError(`TTS 请求失败 ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new TtsError("TTS 返回空音频");
  // base64 → data URI，前端 <audio> 直接可播；V6 产物不入库（音频列体积风险），仅会话内使用
  let binary = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return `data:audio/mpeg;base64,${btoa(binary)}`;
}