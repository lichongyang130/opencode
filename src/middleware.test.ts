import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

/**
 * API 来源守卫测试。
 *
 * 判定「放行」的依据是 NextResponse.next() 产生的 `x-middleware-next: 1` 响应头；
 * 直接看 status 不行——放行与拦截都可能是 200/401 之外的组合，而这个头是 Next
 * 内部标记「继续走后续处理」的唯一可靠信号。
 */

const HOST = "app.example.com";
const ORIGIN = `https://${HOST}`;

/** 构造一个带指定方法与请求头的中间件入参 */
function request(
  method: string,
  pathname: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`${ORIGIN}${pathname}`, {
    method,
    headers: { host: HOST, ...headers },
  });
}

/** 是否被放行 */
function passed(res: Response): boolean {
  return res.headers.get("x-middleware-next") === "1";
}

/** 断言被拦截，并返回错误响应体 */
async function blockedBody(res: Response) {
  expect(passed(res)).toBe(false);
  expect(res.status).toBe(401);
  return (await res.json()) as { error: string };
}

const originalToken = process.env.OC_API_TOKEN;

beforeEach(() => {
  delete process.env.OC_API_TOKEN;
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.OC_API_TOKEN;
  else process.env.OC_API_TOKEN = originalToken;
});

describe("安全方法直接放行", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    it(`${method} 无任何来源头也放行`, () => {
      expect(passed(middleware(request(method, "/api/conversations")))).toBe(true);
    });
  }

  it("方法名小写也按安全方法处理（Node 不会替我们大写化）", () => {
    const req = new NextRequest(`${ORIGIN}/api/conversations`, {
      method: "get",
      headers: { host: HOST },
    });
    expect(passed(middleware(req))).toBe(true);
  });
});

describe("写操作的来源校验", () => {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];

  for (const method of writeMethods) {
    it(`${method} 无来源头时拒绝（挡住 curl 直连）`, async () => {
      const body = await blockedBody(middleware(request(method, "/api/conversations")));
      expect(body.error).toMatch(/请求来源不被信任/);
    });
  }

  for (const method of writeMethods) {
    it(`${method} 同源 Origin 放行`, () => {
      const res = middleware(request(method, "/api/conversations", { origin: ORIGIN }));
      expect(passed(res)).toBe(true);
    });
  }

  it("跨站 Origin 拒绝（CSRF）", async () => {
    const res = middleware(
      request("POST", "/api/conversations", { origin: "https://evil.example" })
    );
    await blockedBody(res);
  });

  it("Origin 主机名相似但不相同时拒绝（前缀/后缀混淆）", async () => {
    for (const origin of [
      "https://app.example.com.evil.com",
      "https://evil-app.example.com",
      "https://appexample.com",
    ]) {
      await blockedBody(middleware(request("POST", "/api/conversations", { origin })));
    }
  });

  it("Origin 端口不同时拒绝（host 比较含端口）", async () => {
    const res = middleware(
      request("POST", "/api/conversations", { origin: `https://${HOST}:8443` })
    );
    await blockedBody(res);
  });

  it("Origin 协议不同但 host 相同时放行（只比较 host，http/https 混用属可接受范围）", () => {
    const res = middleware(
      request("POST", "/api/conversations", { origin: `http://${HOST}` })
    );
    expect(passed(res)).toBe(true);
  });

  it("Origin 为字面量 null 时拒绝（沙箱 iframe 提交）", async () => {
    await blockedBody(middleware(request("POST", "/api/conversations", { origin: "null" })));
  });

  it("Origin 非法格式时拒绝，不因解析异常放行", async () => {
    // HTTP 头只能是 ByteString，这里用纯 ASCII 的非法 URL 形式
    for (const origin of ["not-a-url", "https://", "://x", "https://[bad"]) {
      await blockedBody(middleware(request("POST", "/api/conversations", { origin })));
    }
  });
});

describe("Referer 与 Sec-Fetch-Site 退化判定", () => {
  it("无 Origin 但有同源 Referer 时放行", () => {
    const res = middleware(
      request("POST", "/api/conversations", { referer: `${ORIGIN}/chat` })
    );
    expect(passed(res)).toBe(true);
  });

  it("无 Origin 但 Referer 跨站时拒绝", async () => {
    await blockedBody(
      middleware(request("POST", "/api/conversations", { referer: "https://evil.example/x" }))
    );
  });

  it("Origin 存在时以 Origin 为准，不被同源 Referer 兜底救回", async () => {
    const res = middleware(
      request("POST", "/api/conversations", {
        origin: "https://evil.example",
        referer: `${ORIGIN}/chat`,
      })
    );
    await blockedBody(res);
  });

  it("仅有 sec-fetch-site: same-origin 时放行", () => {
    const res = middleware(
      request("POST", "/api/conversations", { "sec-fetch-site": "same-origin" })
    );
    expect(passed(res)).toBe(true);
  });

  it("sec-fetch-site 为 cross-site / same-site / none 时拒绝", async () => {
    for (const value of ["cross-site", "same-site", "none"]) {
      await blockedBody(
        middleware(request("POST", "/api/conversations", { "sec-fetch-site": value }))
      );
    }
  });
});

describe("/api/export 只读但受守卫", () => {
  it("GET 无来源头时也拒绝（会吐全量数据）", async () => {
    const body = await blockedBody(middleware(request("GET", "/api/export")));
    expect(body.error).toMatch(/请求来源不被信任/);
  });

  it("GET 同源时放行", () => {
    expect(passed(middleware(request("GET", "/api/export", { origin: ORIGIN })))).toBe(true);
  });

  it("其它 GET 接口不受此限制", () => {
    for (const path of ["/api/conversations", "/api/models", "/api/membership"]) {
      expect(passed(middleware(request("GET", path)))).toBe(true);
    }
  });
});

describe("Bearer 令牌通道", () => {
  it("配置令牌后携带正确 Bearer 放行，无需来源头", () => {
    process.env.OC_API_TOKEN = "s3cret";
    const res = middleware(
      request("POST", "/api/conversations", { authorization: "Bearer s3cret" })
    );
    expect(passed(res)).toBe(true);
  });

  it("令牌错误时拒绝", async () => {
    process.env.OC_API_TOKEN = "s3cret";
    await blockedBody(
      middleware(request("POST", "/api/conversations", { authorization: "Bearer wrong" }))
    );
  });

  it("令牌大小写与前缀必须完全匹配", async () => {
    process.env.OC_API_TOKEN = "s3cret";
    for (const value of ["bearer s3cret", "Bearer  s3cret", "s3cret", "Basic s3cret"]) {
      await blockedBody(
        middleware(request("POST", "/api/conversations", { authorization: value }))
      );
    }
  });

  it("未配置 OC_API_TOKEN 时任意 Bearer 都不能放行（防止空令牌绕过）", async () => {
    await blockedBody(
      middleware(request("POST", "/api/conversations", { authorization: "Bearer " }))
    );
    await blockedBody(
      middleware(request("POST", "/api/conversations", { authorization: "Bearer undefined" }))
    );
  });

  it("OC_API_TOKEN 为空字符串时不启用令牌通道", async () => {
    process.env.OC_API_TOKEN = "";
    await blockedBody(
      middleware(request("POST", "/api/conversations", { authorization: "Bearer " }))
    );
  });

  it("令牌正确时即使 Origin 跨站也放行（脚本调用场景）", () => {
    process.env.OC_API_TOKEN = "s3cret";
    const res = middleware(
      request("POST", "/api/conversations", {
        authorization: "Bearer s3cret",
        origin: "https://evil.example",
      })
    );
    expect(passed(res)).toBe(true);
  });
});

describe("受守卫路径覆盖面", () => {
  const guarded = [
    "/api/chat",
    "/api/messages",
    "/api/conversations/abc",
    "/api/conversations/batch",
    "/api/images",
    "/api/research",
    "/api/slides",
    "/api/slides/export",
    "/api/import",
    "/api/import/url",
    "/api/models/fetch",
    "/api/cases/share",
    "/api/tools/pdf",
    "/api/tools/ocr",
    "/api/membership",
  ];

  for (const path of guarded) {
    it(`POST ${path} 无来源头时拒绝`, async () => {
      await blockedBody(middleware(request("POST", path)));
    });
  }

  it("DELETE /api/membership 无来源头时拒绝", async () => {
    await blockedBody(middleware(request("DELETE", "/api/membership")));
  });
});

describe("缺少 host 头的异常请求", () => {
  it("无 host 时即使带 Origin 也拒绝（无法判定同源）", async () => {
    const req = new NextRequest(`${ORIGIN}/api/conversations`, {
      method: "POST",
      headers: { origin: ORIGIN },
    });
    // NextRequest 会依据 URL 兜出 host，这里显式删掉以模拟异常代理
    req.headers.delete("host");
    await blockedBody(middleware(req));
  });
});