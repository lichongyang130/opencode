import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  clearRateLimitBuckets,
  isAiRoute,
  defaultPolicyFor,
  extractIp,
} from "./rate-limit";

describe("rate-limit (O9/O10)", () => {
  beforeEach(() => {
    clearRateLimitBuckets();
  });

  it("识别 AI 路由并应用更严策略", () => {
    expect(isAiRoute("/api/chat")).toBe(true);
    expect(isAiRoute("/api/research")).toBe(true);
    expect(isAiRoute("/api/conversations")).toBe(false);

    const aiPolicy = defaultPolicyFor("/api/chat");
    const normalPolicy = defaultPolicyFor("/api/conversations");
    expect(aiPolicy.limit).toBeLessThan(normalPolicy.limit);
  });

  it("从 Headers 提取真实 IP", () => {
    const req1 = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(extractIp(req1)).toBe("1.2.3.4");

    const req2 = new Request("http://localhost", {
      headers: { "cf-connecting-ip": "9.9.9.9" },
    });
    expect(extractIp(req2)).toBe("9.9.9.9");

    const req3 = new Request("http://localhost");
    expect(extractIp(req3)).toBe("unknown");
  });

  it("窗口内计数并拒绝超额请求", () => {
    const policy = { limit: 3, windowMs: 10_000 };
    const ip = "127.0.0.1";
    const route = "/api/test";

    expect(checkRateLimit(route, ip, policy).allowed).toBe(true);
    expect(checkRateLimit(route, ip, policy).allowed).toBe(true);
    expect(checkRateLimit(route, ip, policy).allowed).toBe(true);

    const blocked = checkRateLimit(route, ip, policy);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});