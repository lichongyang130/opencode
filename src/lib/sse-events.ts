import { encoder } from "./internal/encoder";

/**
 * SSE 事件协议统一（AI14）。
 *
 * 此前 3 条 SSE 路由各自手写 `data: ${JSON.stringify(...)}`，前端 4 处又各自手写
 * 解析循环，事件字段全靠约定漂移（token/delta、status/message、usage/credits 各一套）。
 * 这里把「四类基础事件 + 两条业务终态事件」收敛成唯一的类型定义与编解码：
 *
 *   delta  —— 流式文本增量（聊天逐块输出）
 *   status —— 进度播报（研究/PPT 的阶段提示，非最终产物）
 *   usage  —— 一次调用的计费回执（模型侧统一在流结束时发）
 *   error  —— 失败终态（发完即可关流）
 *   done   —— 显式收尾标记（负载型路由用 result 带最终产物）
 *
 * 兼容性取舍：旧事件名 token/report/deck 仍出现在历史会话与三个前端组件里，
 * parseSseEvent 对它们做映射归一，路由侧逐步迁移，避免一次性大改炸全链路。
 */

export type SseEvent =
  | { type: "delta"; delta: string }
  /** RS1: research 进度带结构化阶段标记（其余路由不带 stage，可选字段向后兼容） */
  | { type: "status"; message: string; stage?: "plan" | "search" | "read" | "write" }
  | { type: "usage"; credits: number; costUsd?: number; inputTokens?: number; outputTokens?: number }
  | { type: "error"; message: string }
  | { type: "done"; result?: unknown };

export type SseEventType = SseEvent["type"];

/** 服务端：事件 → `data: {...}\n\n` 帧（唯一出口，路由里不再手拼 JSON） */
export function sseFrame(evt: SseEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(evt)}\n\n`);
}

/**
 * 客户端：一行 `data: {...}` → 事件；半包/脏行/未知类型返回 null。
 * 对旧事件名（token/report/deck）做归一映射，保证过渡期新旧并存都能被消费。
 */
export function parseSseEvent(line: string): SseEvent | null {
  const t = line.trim();
  if (!t.startsWith("data:")) return null;
  const payload = t.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
  const type = raw.type;
  switch (type) {
    case "delta":
    case "token": // 旧名归一
      return typeof raw.delta === "string" ? { type: "delta", delta: raw.delta } : null;
    case "status": {
      if (typeof raw.message !== "string") return null;
      // RS1: stage 可选透传（research 时间线用），非法值丢弃只留文本
      const stage = ["plan", "search", "read", "write"].includes(String(raw.stage))
        ? (raw.stage as "plan" | "search" | "read" | "write")
        : undefined;
      return stage ? { type: "status", message: raw.message, stage } : { type: "status", message: raw.message };
    }
    case "usage": {
      const credits = typeof raw.credits === "number" ? raw.credits : 0;
      return {
        type: "usage",
        credits,
        costUsd: typeof raw.costUsd === "number" ? raw.costUsd : undefined,
        inputTokens: typeof raw.inputTokens === "number" ? raw.inputTokens : undefined,
        outputTokens: typeof raw.outputTokens === "number" ? raw.outputTokens : undefined,
      };
    }
    case "error":
      return {
        type: "error",
        message: typeof raw.message === "string" ? raw.message : "未知错误",
      };
    case "done":
    case "report": // 旧名归一：研究报告负载
      return { type: "done", result: raw.report ?? raw.result ?? raw.deck ?? null };
    case "deck": // 旧名归一：PPT deck 负载
      return { type: "done", result: raw.deck ?? null };
    default:
      return null;
  }
}