"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseSseEvent, type SseEvent } from "@/lib/sse-events";

/**
 * SSE 流式读取统一 hook（AI15）。
 *
 * 此前 ChatPanel（提示词优化）/ TemplatesModal（AI 生成提示词）/
 * ToolRunnerModal（AI 工具）/ DocViewerModal（文档总结）四处各自手写
 * getReader 循环 + TextDecoder + 行拆分 + JSON.parse try/catch，
 * 超过 120 行重复代码，且对 error 事件的处理各不相同（有的吞掉、有的漏判）。
 *
 * 收敛为「一次调用 = 一条流」：返回累积文本、完成标记与启动函数，
 * 事件解析复用 AI14 的 parseSseEvent（新旧事件名都归一）。
 *
 * 行为约定：
 * - 收到 error 事件时抛给 onError 并立即终止（已累积文本保留在 text 里）；
 * - 组件卸载自动 cancel 底层流，避免 setState 到已卸载组件；
 * - 不做自动重试：这四处都是「点按钮生成一次」的场景，
 *   store 层的 streamSSE 已覆盖多事件长会话的重试语义，职责不重叠。
 */
export interface UseSseStreamResult {
  /** 已累积的流式文本 */
  text: string;
  /** 流是否已结束（正常 done / error / 中断） */
  finished: boolean;
  /** 正在请求中 */
  busy: boolean;
  /** 启动一次流式请求；同一时刻只允许一条在跑 */
  start: (init: RequestInit & { url: string }) => Promise<string>;
  /** 手动中止（停止生成按钮） */
  stop: () => void;
}

export function useSseStream(onEvent?: (evt: SseEvent) => void): UseSseStreamResult {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const onEventRef = useRef(onEvent);
  // 每次渲染都同步最新回调，避免调用方传闭包导致拿到旧 state
  onEventRef.current = onEvent;

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(
    () => () => {
      // 组件卸载：掐断流，防止后续 setText 打到已卸载组件
      abortRef.current?.abort();
    },
    []
  );

  const start = useCallback(async (init: RequestInit & { url: string }): Promise<string> => {
    if (abortRef.current) return text;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setFinished(false);
    setText("");

    let acc = "";
    let failMessage: string | null = null;
    const { url, ...rest } = init;

    try {
      const res = await fetch(url, { ...rest, signal: controller.signal });
      if (!res.ok || !res.body) throw new Error(`请求失败 ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // SSE 事件以空行分隔；留最后一段防半包
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const evt = parseSseEvent(part);
            if (!evt) continue;
            if (evt.type === "delta") {
              acc += evt.delta;
              setText(acc);
            } else if (evt.type === "error") {
              failMessage = evt.message;
            }
            onEventRef.current?.(evt);
          }
        }
      } finally {
        void reader.cancel().catch(() => {});
      }

      if (failMessage) throw new Error(failMessage);
      return acc;
    } finally {
      abortRef.current = null;
      setBusy(false);
      setFinished(true);
    }
  }, [text]);

  return { text, finished, busy, start, stop };
}