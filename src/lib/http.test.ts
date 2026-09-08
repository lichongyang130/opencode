import { describe, expect, it } from "vitest";
import { badJsonResponse, readJsonBody } from "./http";

/**
 * readJsonBody 是所有 POST 路由的第一道防线：
 * 它必须把「客户端发了垃圾」全部收敛成 null，绝不允许异常穿透成 500。
 */

function post(body: BodyInit | null | undefined): Request {
  return new Request("https://example.com/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("readJsonBody 合法输入", () => {
  it("解析普通对象", async () => {
    const r = await readJsonBody<{ a: number }>(post(JSON.stringify({ a: 1 })));
    expect(r).toEqual({ a: 1 });
  });

  it("解析空对象", async () => {
    expect(await readJsonBody(post("{}"))).toEqual({});
  });

  it("保留嵌套结构与数组字段", async () => {
    const input = { list: [1, 2], nested: { deep: { flag: true } }, nil: null };
    const r = await readJsonBody<typeof input>(post(JSON.stringify(input)));
    expect(r).toEqual(input);
  });

  it("忽略 content-type，只看请求体本身", async () => {
    const req = new Request("https://example.com/api/x", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ ok: 1 }),
    });
    expect(await readJsonBody(req)).toEqual({ ok: 1 });
  });
});

describe("readJsonBody 非法输入统一返回 null", () => {
  it("空请求体", async () => {
    expect(await readJsonBody(post(""))).toBeNull();
  });

  it("缺失请求体", async () => {
    expect(await readJsonBody(post(undefined))).toBeNull();
  });

  it("截断的 JSON", async () => {
    expect(await readJsonBody(post('{"a":'))).toBeNull();
  });

  it("完全不是 JSON 的纯文本", async () => {
    expect(await readJsonBody(post("not json at all"))).toBeNull();
  });

  it("单引号等非标准 JSON", async () => {
    expect(await readJsonBody(post("{'a':1}"))).toBeNull();
  });

  it("尾随逗号", async () => {
    expect(await readJsonBody(post('{"a":1,}'))).toBeNull();
  });

  // 下面几种是「合法 JSON 但不是对象」，路由代码统一按对象取字段，必须一起拒掉
  it("顶层数组", async () => {
    expect(await readJsonBody(post("[1,2,3]"))).toBeNull();
  });

  it("顶层 null", async () => {
    expect(await readJsonBody(post("null"))).toBeNull();
  });

  it("顶层字符串", async () => {
    expect(await readJsonBody(post('"hello"'))).toBeNull();
  });

  it("顶层数字", async () => {
    expect(await readJsonBody(post("123"))).toBeNull();
  });

  it("顶层布尔", async () => {
    expect(await readJsonBody(post("true"))).toBeNull();
  });

  it("只有空白字符", async () => {
    expect(await readJsonBody(post("   \n\t "))).toBeNull();
  });
});

describe("badJsonResponse", () => {
  it("返回 400 且带中文错误说明", async () => {
    const res = badJsonResponse();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("JSON");
  });

  it("每次调用返回全新响应，body 未被消费", async () => {
    const a = badJsonResponse();
    const b = badJsonResponse();
    expect(a).not.toBe(b);
    expect(a.bodyUsed).toBe(false);
    await expect(b.json()).resolves.toBeTruthy();
  });
});