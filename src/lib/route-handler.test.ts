import { describe, it, expect, vi } from "vitest";
import { withRoute } from "./route-handler";
import { currentRequestId, currentRoute } from "./request-context";

describe("route-handler & request-context (O4/O11)", () => {
  it("贯穿 requestId 并注入响应头", async () => {
    let capturedReqId = "";
    let capturedRoute = "";

    const handler = withRoute(async (req) => {
      capturedReqId = currentRequestId() ?? "";
      capturedRoute = currentRoute() ?? "";
      return Response.json({ ok: true });
    }, { name: "/test-route" });

    const req = new Request("http://localhost/test-route", {
      headers: { "x-request-id": "custom-trace-id-12345" },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("custom-trace-id-12345");
    expect(capturedReqId).toBe("custom-trace-id-12345");
    expect(capturedRoute).toBe("/test-route");
  });

  it("自动生成合法的 requestId", async () => {
    const handler = withRoute(async () => Response.json({ ok: true }));
    const req = new Request("http://localhost/api/auto-id");
    const res = await handler(req);
    const id = res.headers.get("x-request-id");
    expect(id).toBeDefined();
    expect(id?.length).toBeGreaterThan(10);
  });

  it("捕获未处理异常并返回 500", async () => {
    const handler = withRoute(async () => {
      throw new Error("handler explosion");
    });
    const req = new Request("http://localhost/api/crash");
    const res = await handler(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("服务器内部错误");
    expect(res.headers.get("x-request-id")).toBeDefined();
  });
});