import type { ResearchSource } from "./types";

/**
 * RS9: URL 归一化与域名工具。
 *
 * 独立成文件的原因：ReportView（客户端组件）要用 domainOf/domainCounts 做
 * favicon 与同源提示，而 engine.ts 顶层 import 了模型网关（连带 node:sqlite），
 * 客户端 bundle 一旦引用 engine 就会把服务端模块拖进浏览器导致构建失败。
 * 这里保持零依赖，客户端与服务端（engine）都可安全引用。
 */

/** URL 归一化——去协议差异、尾斜杠、www 前缀与锚点，取域名+路径做同源判定 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return url;
  }
}

/** 取归一化域名（favicon 与可信度提示也用它） */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 同域名来源统计（来源列表按域名分组提示用） */
export function domainCounts(sources: ResearchSource[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of sources) {
    const d = s.domain || domainOf(s.url);
    if (d) counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
}