"use client";

import type { ProviderId, ProviderOverrides } from "@/lib/gateway";
import { readJSON, writeJSON } from "@/lib/safe-storage";

const STORAGE_KEY = "opencanvas.provider.settings.v1";
const MODELS_KEY = "opencanvas.dynamic.models.v1";

export interface DynamicModel {
  id: string;
  provider: ProviderId;
}

/** 读取各供应商动态获取的模型列表 */
export function loadDynamicModels(): Partial<Record<ProviderId, string[]>> {
  return readJSON<Partial<Record<ProviderId, string[]>>>(MODELS_KEY, {});
}

export function saveDynamicModels(m: Partial<Record<ProviderId, string[]>>): void {
  writeJSON(MODELS_KEY, m);
  window.dispatchEvent(new CustomEvent("opencanvas:settings-changed"));
}

export interface ProviderSetting {
  apiKey: string;
  baseUrl: string;
}
export type ProviderSettings = Partial<Record<ProviderId, ProviderSetting>>;

export const TAVILY_KEY = "tavily";

/** 联网搜索（深度研究用）密钥 */
export function loadTavilyKey(): string {
  const parsed = readJSON<Record<string, ProviderSetting>>(STORAGE_KEY, {});
  return parsed[TAVILY_KEY]?.apiKey?.trim() ?? "";
}

export const PROVIDER_META: {
  id: ProviderId;
  label: string;
  region: string;
  defaultBaseUrl: string;
  models: string;
  note: string;
}[] = [
  {
    id: "openai",
    label: "OpenAI（GPT / DALL·E）",
    region: "海外",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: "GPT 对话 + DALL·E 3 绘图",
    note: "国内可用中转服务，把 Base URL 换成中转地址",
  },
  {
    id: "anthropic",
    label: "Anthropic（Claude）",
    region: "海外",
    defaultBaseUrl: "https://api.anthropic.com",
    models: "Claude 对话",
    note: "Base URL 只填根地址，无需 /v1",
  },
  {
    id: "deepseek",
    label: "DeepSeek（深度求索）",
    region: "国内",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: "DeepSeek 对话（高性价比）",
    note: "国内直连，无需中转",
  },
  {
    id: "dashscope",
    label: "阿里云百炼（通义千问 / 万相）",
    region: "国内",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: "Qwen 对话 + 通义万相绘图",
    note: "用 OpenAI 兼容模式 Base URL",
  },
];

export function loadSettings(): ProviderSettings {
  const parsed = readJSON<Record<string, ProviderSetting>>(STORAGE_KEY, {});
  const out: ProviderSettings = {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  for (const [k, v] of Object.entries(parsed)) {
    if (v && typeof v === "object") {
      out[k as ProviderId] = {
        apiKey: typeof v.apiKey === "string" ? v.apiKey.trim() : "",
        baseUrl: typeof v.baseUrl === "string" ? v.baseUrl.trim() : "",
      };
    }
  }
  return out;
}

export function saveSettings(s: ProviderSettings): void {
  writeJSON(STORAGE_KEY, s);
  window.dispatchEvent(new CustomEvent("opencanvas:settings-changed"));
}

/** 转成请求体里的 overrides（只含有 key 的供应商） */
export function toOverrides(s: ProviderSettings): ProviderOverrides {
  const out: ProviderOverrides = {};
  for (const [id, v] of Object.entries(s)) {
    if (v?.apiKey) {
      out[id as ProviderId] = { apiKey: v.apiKey, baseUrl: v.baseUrl || undefined };
    }
  }
  return out;
}

export function getOverrides(): ProviderOverrides {
  return toOverrides(loadSettings());
}

/**
 * 服务端（.env / .env.local）配置状态，带内存缓存。
 * 用于前端判断「密钥只配在服务端」的场景 —— localStorage 里没有不代表没配。
 */
let serverStatusCache: Record<string, boolean> | null = null;
export async function serverProviderStatus(): Promise<Record<string, boolean>> {
  if (serverStatusCache) return serverStatusCache;
  try {
    const res = await fetch("/api/models");
    const data = (await res.json()) as { status?: Record<string, boolean> };
    serverStatusCache = data.status ?? {};
  } catch {
    serverStatusCache = {};
  }
  return serverStatusCache;
}

/** 本地已配置密钥的供应商集合 */
export function localConfiguredProviders(): Record<string, boolean> {
  const s = loadSettings();
  const out: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(s)) if (v?.apiKey) out[id] = true;
  out.demo = true;
  return out;
}

/* ────────── 默认模型偏好 ────────── */

const DEFAULT_MODEL_KEY = "opencanvas.default-model.v1";

/** 新建对话时默认使用的模型（未设置过时为演示模型） */
export function loadDefaultModel(): string {
  const parsed = readJSON<{ model?: string } | null>(DEFAULT_MODEL_KEY, null);
  return parsed?.model ?? "demo";
}

export function saveDefaultModel(id: string): void {
  writeJSON(DEFAULT_MODEL_KEY, { model: id });
  window.dispatchEvent(new CustomEvent("opencanvas:settings-changed"));
}

const DEFAULT_MODEL_MODE_KEY = "oc:default-model-mode.v1";

/** 按工作台模式各自的默认模型（未设置的回落到全局默认） */
export function loadDefaultModelByMode(): Record<string, string> {
  return readJSON<Record<string, string>>(DEFAULT_MODEL_MODE_KEY, {});
}

export function saveDefaultModelByMode(map: Record<string, string>): void {
  writeJSON(DEFAULT_MODEL_MODE_KEY, map);
  window.dispatchEvent(new CustomEvent("opencanvas:settings-changed"));
}

/** 某个模式应使用的默认模型：先看模式级偏好，再回落全局默认 */
export function defaultModelForMode(mode: string): string {
  const byMode = loadDefaultModelByMode()[mode];
  return byMode || loadDefaultModel();
}

/* ────────── 密钥健康状态 ────────── */

const HEALTH_KEY = "oc:provider-health.v1";

export interface ProviderHealth {
  /** 最近一次验证是否成功 */
  ok: boolean;
  /** 验证时获取到的模型数量 */
  models: number;
  /** 验证时间戳 */
  at: number;
}

export function loadProviderHealth(): Record<string, ProviderHealth> {
  return readJSON<Record<string, ProviderHealth>>(HEALTH_KEY, {});
}

export function saveProviderHealth(map: Record<string, ProviderHealth>): void {
  writeJSON(HEALTH_KEY, map);
}
