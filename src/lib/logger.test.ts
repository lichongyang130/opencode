import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, sanitizeForLog } from "./logger";
import { runWithRequestContext } from "./request-context";

describe("logger & sanitizeForLog (O1/O2/O6)", () => {
  beforeEach(() => {
    delete process.env.OC_LOG_LEVEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sanitizeForLog", () => {
    it("原样保留基础类型", () => {
      expect(sanitizeForLog(123)).toBe(123);
      expect(sanitizeForLog(true)).toBe(true);
      expect(sanitizeForLog(null)).toBe(null);
      expect(sanitizeForLog(undefined)).toBe(undefined);
    });

    it("脱敏精确命中的敏感键（apiKey/authorization/token）", () => {
      const sanitized = sanitizeForLog({
        apiKey: "sk-123456",
        authorization: "Bearer secret-token",
        userToken: "token-999",
        safeField: "ok",
      }) as Record<string, unknown>;

      expect(sanitized.apiKey).toBe("[redacted]");
      expect(sanitized.authorization).toBe("[redacted]");
      expect(sanitized.userToken).toBe("[redacted]");
      expect(sanitized.safeField).toBe("ok");
    });

    it("脱敏 URL 中的密钥/签名参数", () => {
      const url = "https://api.example.com/v1?apikey=secret123&other=1";
      const sanitized = sanitizeForLog(url);
      expect(sanitized).toBe("https://api.example.com/v1?apikey=[redacted]&other=1");
    });

    it("省略 base64 data URI", () => {
      const uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const sanitized = sanitizeForLog(uri) as string;
      expect(sanitized).toContain("[base64 内容已省略]");
    });

    it("截断超长字符串", () => {
      const longStr = "a".repeat(600);
      const sanitized = sanitizeForLog(longStr) as string;
      expect(sanitized.length).toBeLessThan(600);
      expect(sanitized).toContain("截断 100 字符");
    });

    it("序列化 Error 对象并脱敏堆栈", () => {
      const err = new Error("something went wrong");
      const sanitized = sanitizeForLog(err) as Record<string, unknown>;
      expect(sanitized.name).toBe("Error");
      expect(sanitized.message).toBe("something went wrong");
      expect(typeof sanitized.stack).toBe("string");
    });
  });

  describe("logger emit 与分级", () => {
    it("测试环境下默认 silent，不打印日志", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.info("test message");
      logger.error("test error");

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("设置 OC_LOG_LEVEL=debug 时输出 JSON 并自动附加 AsyncLocalStorage 中的 requestId", () => {
      process.env.OC_LOG_LEVEL = "debug";
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      runWithRequestContext({ requestId: "req-abc-123", route: "/api/chat" }, () => {
        logger.info("用户请求到达", { model: "gpt-4o" });
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed.level).toBe("info");
      expect(parsed.msg).toBe("用户请求到达");
      expect(parsed.requestId).toBe("req-abc-123");
      expect(parsed.route).toBe("/api/chat");
      expect(parsed.fields.model).toBe("gpt-4o");
    });

    it("warn/error 走 console.error，低于级别的被过滤", () => {
      process.env.OC_LOG_LEVEL = "warn";
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.info("会被忽略");
      logger.warn("警告信息");
      logger.error("错误信息");

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(2);
    });
  });
});