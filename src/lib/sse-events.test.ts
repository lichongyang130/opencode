import { describe, expect, it } from "vitest";
import { parseSseEvent, sseFrame, type SseEvent } from "./sse-events";

/** AI14：SSE 事件协议编解码唯一入口的行为锁定 */

function roundtrip(evt: SseEvent): SseEvent | null {
  const frame = sseFrame(evt);
  const text = new TextDecoder().decode(frame);
  const line = text.split("\n")[0];
  return parseSseEvent(line);
}

describe("AI14 SSE 事件协议", () => {
  it("四类基础事件编解码往返保持一致", () => {
    const cases: SseEvent[] = [
      { type: "delta", delta: "你好" },
      { type: "status", message: "正在检索…" },
      { type: "usage", credits: 3, costUsd: 0.03, inputTokens: 100, outputTokens: 200 },
      { type: "error", message: "上游超时" },
      { type: "done", result: { foo: 1 } },
    ];
    for (const evt of cases) {
      expect(roundtrip(evt)).toEqual(evt);
    }
  });

  it("帧格式固定为 data: {...}\\n\\n（两处换行缺一不可）", () => {
    const frame = new TextDecoder().decode(sseFrame({ type: "delta", delta: "x" }));
    expect(frame.startsWith("data: ")).toBe(true);
    expect(frame.endsWith("\n\n")).toBe(true);
  });

  it("旧事件名 token/report/deck 归一为新协议", () => {
    expect(parseSseEvent('data: {"type":"token","delta":"旧"}')).toEqual({ type: "delta", delta: "旧" });
    const report = { sections: [] };
    expect(parseSseEvent(`data: ${JSON.stringify({ type: "report", report })}`)).toEqual({
      type: "done",
      result: report,
    });
    expect(parseSseEvent('data: {"type":"deck","deck":{"title":"t"}}')).toEqual({
      type: "done",
      result: { title: "t" },
    });
  });

  it("半包 / 脏行 / [DONE] / 未知类型返回 null 而非抛错", () => {
    expect(parseSseEvent('data: {"type":"del')).toBeNull();
    expect(parseSseEvent("not-data")).toBeNull();
    expect(parseSseEvent("data: [DONE]")).toBeNull();
    expect(parseSseEvent('data: {"type":"future","x":1}')).toBeNull();
  });

  it("字段缺失或类型不符时按安全默认值降级", () => {
    // delta 缺失：无法构造合法事件，返回 null（调用方跳过该行）
    expect(parseSseEvent('data: {"type":"delta"}')).toBeNull();
    // usage 缺 credits：按 0 处理，不炸流
    expect(parseSseEvent('data: {"type":"usage"}')).toEqual({ type: "usage", credits: 0 });
    // error 缺 message：给个兜底文案
    expect(parseSseEvent('data: {"type":"error"}')).toEqual({ type: "error", message: "未知错误" });
  });

  it("RS1: status 事件带合法 stage 时往返透传", () => {
    const stages = ["plan", "search", "read", "write"] as const;
    for (const stage of stages) {
      expect(roundtrip({ type: "status", message: "进行中", stage })).toEqual({
        type: "status",
        message: "进行中",
        stage,
      });
    }
  });

  it("RS1: stage 非法或缺失时丢弃 stage 只留文本（向后兼容）", () => {
    // 旧客户端/旧路由发的 status 不带 stage：解析结果不含该键
    expect(parseSseEvent('data: {"type":"status","message":"旧格式"}')).toEqual({
      type: "status",
      message: "旧格式",
    });
    // 非法 stage 值直接丢弃，不冒充任何阶段
    expect(parseSseEvent('data: {"type":"status","message":"x","stage":"deploy"}')).toEqual({
      type: "status",
      message: "x",
    });
    // stage 类型错误（数字）同样丢弃
    expect(parseSseEvent('data: {"type":"status","message":"x","stage":3}')).toEqual({
      type: "status",
      message: "x",
    });
  });
});