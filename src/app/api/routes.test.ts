import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * API 路由集成测试。
 *
 * 核心目标：任何客户端输入都不能穿透成 500。
 * 畸形 JSON、类型不符、越权取值（原型链键）一律要落在 4xx，
 * 并且在参数不合法时绝不触碰数据库。
 *
 * 每个用例用独立临时数据目录，避免污染开发库。
 */

let tempDir: string;
let sqliteModule: typeof import("@/lib/db/sqlite");

/** 构造一个 POST 请求；body 原样传入，方便塞进畸形字符串 */
function req(url: string, body: BodyInit | null | undefined, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body,
  });
}

const jsonOf = async (res: Response) => (await res.json()) as { error?: string; ok?: boolean };

/** 覆盖所有畸形请求体形态：解析失败 + 合法 JSON 但非对象 */
const MALFORMED: Array<[string, BodyInit | null | undefined]> = [
  ["截断的 JSON", '{"a":'],
  ["纯文本", "not json"],
  ["空请求体", ""],
  ["缺失请求体", undefined],
  ["顶层数组", "[1,2]"],
  ["顶层 null", "null"],
  ["顶层字符串", '"str"'],
  ["顶层数字", "42"],
];

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "oc-api-"));
  process.env.OC_DATA_DIR = tempDir;
  vi.resetModules();
  sqliteModule = await import("@/lib/db/sqlite");
});

afterEach(() => {
  sqliteModule?.closeDb();
  delete process.env.OC_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe("畸形请求体一律 400，不允许 500", () => {
  /** 每个入口：模块路径 -> 导出的处理函数 + 请求 URL */
  const entries: Array<[string, () => Promise<(r: Request) => Promise<Response>>, string]> = [
    ["POST /api/chat", async () => (await import("@/app/api/chat/route")).POST, "https://h/api/chat"],
    [
      "POST /api/slides",
      async () => (await import("@/app/api/slides/route")).POST,
      "https://h/api/slides",
    ],
    [
      "POST /api/slides/export",
      async () => (await import("@/app/api/slides/export/route")).POST,
      "https://h/api/slides/export",
    ],
    [
      "POST /api/research",
      async () => (await import("@/app/api/research/route")).POST,
      "https://h/api/research",
    ],
    [
      "PUT /api/research",
      async () => (await import("@/app/api/research/route")).PUT,
      "https://h/api/research",
    ],
    [
      "POST /api/images",
      async () => (await import("@/app/api/images/route")).POST,
      "https://h/api/images",
    ],
    [
      "POST /api/conversations",
      async () => (await import("@/app/api/conversations/route")).POST,
      "https://h/api/conversations",
    ],
    [
      "POST /api/conversations/batch",
      async () => (await import("@/app/api/conversations/batch/route")).POST,
      "https://h/api/conversations/batch",
    ],
    [
      "POST /api/messages",
      async () => (await import("@/app/api/messages/route")).POST,
      "https://h/api/messages",
    ],
    [
      "POST /api/membership",
      async () => (await import("@/app/api/membership/route")).POST,
      "https://h/api/membership",
    ],
    [
      "POST /api/models/fetch",
      async () => (await import("@/app/api/models/fetch/route")).POST,
      "https://h/api/models/fetch",
    ],
    [
      "POST /api/import",
      async () => (await import("@/app/api/import/route")).POST,
      "https://h/api/import",
    ],
    [
      "POST /api/import/url",
      async () => (await import("@/app/api/import/url/route")).POST,
      "https://h/api/import/url",
    ],
    [
      "POST /api/cases/share",
      async () => (await import("@/app/api/cases/share/route")).POST,
      "https://h/api/cases/share",
    ],
    [
      "POST /api/tools/ocr",
      async () => (await import("@/app/api/tools/ocr/route")).POST,
      "https://h/api/tools/ocr",
    ],
    [
      "POST /api/tools/pdf",
      async () => (await import("@/app/api/tools/pdf/route")).POST,
      "https://h/api/tools/pdf",
    ],
    [
      "POST /api/conversations/[id]/doc-versions",
      async () => (await import("@/app/api/conversations/[id]/doc-versions/route")).POST,
      "https://h/api/conversations/c1/doc-versions",
    ],
    [
      "POST /api/slides/export-pdf",
      async () => (await import("@/app/api/slides/export-pdf/route")).POST,
      "https://h/api/slides/export-pdf",
    ],
  ];

  for (const [label, load, url] of entries) {
    for (const [shape, body] of MALFORMED) {
      it(`${label} ${shape}`, async () => {
        const handler = await load();
        const res = await handler(req(url, body));
        expect(res.status).toBe(400);
        const parsed = await jsonOf(res);
        expect(parsed.error).toBeTruthy();
      });
    }
  }

  it("PATCH /api/messages 畸形体 400", async () => {
    const { PATCH } = await import("@/app/api/messages/route");
    const res = await PATCH(req("https://h/api/messages", "{oops", "PATCH"));
    expect(res.status).toBe(400);
  });

  it("PATCH /api/conversations/[id] 畸形体 400（先于存在性检查）", async () => {
    const { PATCH } = await import("@/app/api/conversations/[id]/route");
    const res = await PATCH(req("https://h/api/conversations/x", "{oops", "PATCH"), {
      params: { id: "x" },
    });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("JSON");
  });
});

describe("POST /api/conversations 参数校验", () => {
  it("缺少 id 返回 400 且不写库", async () => {
    const { POST, GET } = await import("@/app/api/conversations/route");
    const res = await POST(req("https://h/api/conversations", JSON.stringify({ title: "无 id" })));
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("缺少 id");

    const list = (await (
      await GET(new Request("https://h/api/conversations"))
    ).json()) as { conversations: unknown[] };
    expect(list.conversations).toHaveLength(0);
  });

  it("空字符串 id 同样被拒", async () => {
    const { POST } = await import("@/app/api/conversations/route");
    const res = await POST(req("https://h/api/conversations", JSON.stringify({ id: "" })));
    expect(res.status).toBe(400);
  });

  it("只给 id 即可创建，其余字段落默认值", async () => {
    const { POST } = await import("@/app/api/conversations/route");
    const res = await POST(req("https://h/api/conversations", JSON.stringify({ id: "c1" })));
    expect(res.status).toBe(200);

    const { GET } = await import("@/app/api/conversations/[id]/route");
    const detail = (await (
      await GET(new Request("https://h/api/conversations/c1"), { params: { id: "c1" } })
    ).json()) as { conversation: { title: string; mode: string; model: string } };
    expect(detail.conversation).toMatchObject({ title: "新任务", mode: "chat", model: "demo" });
  });

  it("GET 按 archived 过滤", async () => {
    const { POST, GET } = await import("@/app/api/conversations/route");
    await POST(req("https://h/api/conversations", JSON.stringify({ id: "a" })));
    await POST(req("https://h/api/conversations", JSON.stringify({ id: "b" })));
    const { PATCH } = await import("@/app/api/conversations/[id]/route");
    await PATCH(req("https://h/api/conversations/b", JSON.stringify({ archived: true }), "PATCH"), {
      params: { id: "b" },
    });

    const read = async (q: string) =>
      ((await (await GET(new Request(`https://h/api/conversations${q}`))).json()) as {
        conversations: Array<{ id: string }>;
      }).conversations.map((c) => c.id);

    expect(await read("")).toEqual(["a"]);
    expect(await read("?archived=1")).toEqual(["b"]);
    expect((await read("?archived=all")).sort()).toEqual(["a", "b"]);
  });
});

describe("GET / PATCH / DELETE /api/conversations/[id]", () => {
  it("不存在的会话 GET 返回 404", async () => {
    const { GET } = await import("@/app/api/conversations/[id]/route");
    const res = await GET(new Request("https://h/api/conversations/nope"), {
      params: { id: "nope" },
    });
    expect(res.status).toBe(404);
  });

  it("不存在的会话 PATCH 返回 404 而不是静默建新记录", async () => {
    const { PATCH } = await import("@/app/api/conversations/[id]/route");
    const res = await PATCH(
      req("https://h/api/conversations/nope", JSON.stringify({ title: "x" }), "PATCH"),
      { params: { id: "nope" } }
    );
    expect(res.status).toBe(404);

    const { GET } = await import("@/app/api/conversations/route");
    const list = (await (await GET(new Request("https://h/api/conversations?archived=all"))).json()) as {
      conversations: unknown[];
    };
    expect(list.conversations).toHaveLength(0);
  });

  it("删除不存在的会话是幂等的 200", async () => {
    const { DELETE } = await import("@/app/api/conversations/[id]/route");
    const res = await DELETE(new Request("https://h/api/conversations/ghost", { method: "DELETE" }), {
      params: { id: "ghost" },
    });
    expect(res.status).toBe(200);
    expect((await jsonOf(res)).ok).toBe(true);
  });
});

describe("POST /api/messages 参数校验", () => {
  it("缺少任一必填字段都返回 400", async () => {
    const { POST } = await import("@/app/api/messages/route");
    const bodies = [
      { conversationId: "c1", role: "user", content: "x" },
      { id: "m1", role: "user", content: "x" },
      { id: "m1", conversationId: "c1", content: "x" },
      { id: "m1", conversationId: "c1", role: "user" },
    ];
    for (const b of bodies) {
      const res = await POST(req("https://h/api/messages", JSON.stringify(b)));
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("参数不完整");
    }
  });

  it("content 为空串是合法的（模型可能返回空回复）", async () => {
    const conv = await import("@/app/api/conversations/route");
    await conv.POST(req("https://h/api/conversations", JSON.stringify({ id: "c1" })));
    const { POST } = await import("@/app/api/messages/route");
    const res = await POST(
      req(
        "https://h/api/messages",
        JSON.stringify({ id: "m1", conversationId: "c1", role: "assistant", content: "" })
      )
    );
    expect(res.status).toBe(200);
  });

  it("PATCH 缺少 id 或 content 返回 400", async () => {
    const { PATCH } = await import("@/app/api/messages/route");
    for (const b of [{ content: "x" }, { id: "m1" }]) {
      const res = await PATCH(req("https://h/api/messages", JSON.stringify(b), "PATCH"));
      expect(res.status).toBe(400);
    }
  });

  it("DELETE 缺少 id 查询参数返回 400", async () => {
    const { DELETE } = await import("@/app/api/messages/route");
    const res = await DELETE(new Request("https://h/api/messages", { method: "DELETE" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/conversations/batch 参数校验", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/conversations/batch/route");
    return POST(req("https://h/api/conversations/batch", JSON.stringify(body)));
  };

  it("缺少 action 返回 400", async () => {
    expect((await call({ ids: ["a"] })).status).toBe(400);
  });

  it("缺少 ids 返回 400", async () => {
    expect((await call({ action: "delete" })).status).toBe(400);
  });

  it("ids 为空数组返回 400", async () => {
    expect((await call({ action: "delete", ids: [] })).status).toBe(400);
  });

  it("ids 全是非字符串时被过滤成空并返回 400", async () => {
    const res = await call({ action: "delete", ids: [1, 2, null, {}] });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("参数不完整");
  });

  it("ids 不是数组时返回 400", async () => {
    expect((await call({ action: "delete", ids: "a,b" })).status).toBe(400);
  });

  it("未知 action 返回 400 而不是静默成功", async () => {
    const res = await call({ action: "nuke", ids: ["a"] });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("未知操作");
  });

  it("合法批量归档返回处理条数", async () => {
    const conv = await import("@/app/api/conversations/route");
    await conv.POST(req("https://h/api/conversations", JSON.stringify({ id: "a" })));
    await conv.POST(req("https://h/api/conversations", JSON.stringify({ id: "b" })));
    const res = await call({ action: "archive", ids: ["a", "b"] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, count: 2 });
  });

  it("混合类型的 ids 只保留字符串项", async () => {
    const conv = await import("@/app/api/conversations/route");
    await conv.POST(req("https://h/api/conversations", JSON.stringify({ id: "a" })));
    const res = await call({ action: "archive", ids: ["a", 1, null] });
    expect(await res.json()).toMatchObject({ count: 1 });
  });
});

describe("POST /api/membership 套餐白名单", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/membership/route");
    return POST(req("https://h/api/membership", JSON.stringify(body)));
  };

  it("缺少 plan 返回 400", async () => {
    expect((await call({})).status).toBe(400);
  });

  it("未知套餐返回 400", async () => {
    expect((await call({ plan: "gold" })).status).toBe(400);
  });

  it("原型链键不能绕过白名单（hasOwnProperty 校验）", async () => {
    for (const plan of ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]) {
      const res = await call({ plan });
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("未知套餐");
    }
  });

  it("合法套餐生成订单", async () => {
    const res = await call({ plan: "pro" });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; order?: { plan: string; amount: number } };
    expect(data.ok).toBe(true);
    expect(data.order).toMatchObject({ plan: "pro", amount: 39 });
  });

  it("free 套餐金额为 0", async () => {
    const data = (await (await call({ plan: "free" })).json()) as {
      order?: { amount: number };
    };
    expect(data.order?.amount).toBe(0);
  });
});

describe("POST /api/models/fetch 供应商白名单", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/models/fetch/route");
    return POST(req("https://h/api/models/fetch", JSON.stringify(body)));
  };

  it("缺少 provider 返回 400", async () => {
    expect((await call({})).status).toBe(400);
  });

  it("demo 没有远端列表接口，被拒", async () => {
    const res = await call({ provider: "demo" });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("不支持的供应商");
  });

  it("伪造的供应商名被拒，不会走到 adapter 而抛 TypeError", async () => {
    for (const provider of ["evil", "__proto__", "constructor", ""]) {
      const res = await call({ provider });
      expect(res.status).toBe(400);
    }
  });

  it("白名单内但未配置密钥时给出可操作的提示", async () => {
    const res = await call({ provider: "openai", overrides: {} });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("API Key");
  });
});

describe("POST /api/chat 与 /api/slides 的业务校验", () => {
  it("chat 的 messages 为空返回 400", async () => {
    const { POST } = await import("@/app/api/chat/route");
    for (const b of [{}, { messages: [] }, { messages: "x" }, { messages: null }]) {
      const res = await POST(req("https://h/api/chat", JSON.stringify(b)));
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("messages");
    }
  });

  it("slides 的 topic 为空返回 400", async () => {
    const { POST } = await import("@/app/api/slides/route");
    for (const b of [{}, { topic: "" }, { topic: "   " }]) {
      const res = await POST(req("https://h/api/slides", JSON.stringify(b)));
      expect(res.status).toBe(400);
    }
  });

  it("research 的 topic 为空返回 400", async () => {
    const { POST } = await import("@/app/api/research/route");
    for (const b of [{}, { topic: "  " }]) {
      const res = await POST(req("https://h/api/research", JSON.stringify(b)));
      expect(res.status).toBe(400);
    }
  });

  it("RS5/RS8: research 的 depth / language 非法枚举返回 400", async () => {
    const { POST } = await import("@/app/api/research/route");
    for (const b of [
      { topic: "测试", depth: "extreme" },
      { topic: "测试", depth: 3 },
      { topic: "测试", language: "fr" },
      { topic: "测试", language: "" },
    ]) {
      const res = await POST(req("https://h/api/research", JSON.stringify(b)));
      expect(res.status).toBe(400);
    }
  });

  it("RS1: research demo 路径产出带 stage 的 SSE 事件（status → done）", async () => {
    const { POST } = await import("@/app/api/research/route");
    const res = await POST(
      req("https://h/api/research", JSON.stringify({ topic: "AI 智能体赛道", depth: "quick", language: "zh" }))
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const events = text
      .split("\n\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("data:"))
      .map(
        (l) =>
          JSON.parse(l.slice(5).trim()) as {
            type: string;
            message?: string;
            stage?: string;
            result?: { topic: string; sections: unknown[]; sources: unknown[]; demo?: boolean };
          }
      );
    // 四阶段 status 按序带 stage 透传
    const statuses = events.filter((e) => e.type === "status");
    expect(statuses.map((e) => e.stage)).toEqual(["plan", "search", "read", "write"]);
    const done = events.find((e) => e.type === "done");
    expect(done?.result?.topic).toBe("AI 智能体赛道");
    expect(done?.result?.sections.length).toBeGreaterThan(0);
    expect(done?.result?.sources.length).toBeGreaterThan(0);
  });

  it("RS4: PUT /api/research 的 sources 校验（空/超限/缺字段一律 400）", async () => {
    const { PUT } = await import("@/app/api/research/route");
    const src = { title: "来源", url: "https://a.com/x", snippet: "摘要" };
    for (const b of [
      { topic: "测试" }, // 缺 sources
      { topic: "测试", sources: [] }, // 空数组
      { topic: "测试", sources: "not-array" },
      { topic: "测试", sources: [{ title: "只有标题" }] }, // 缺 url
      { topic: "测试", sources: [{ url: "https://a.com" }] }, // 缺 title
      { topic: "测试", sources: [{ title: "t", url: 42 }] }, // url 类型错误
      { topic: "测试", sources: Array.from({ length: 31 }, () => src) }, // 超 30 条
      { topic: "", sources: [src] }, // topic 空
    ]) {
      const res = await PUT(req("https://h/api/research", JSON.stringify(b), "PUT"));
      expect(res.status).toBe(400);
    }
  });

  it("RS4: PUT /api/research demo 路径基于给定来源产出报告", async () => {
    const { PUT } = await import("@/app/api/research/route");
    const sources = [
      { title: "来源一", url: "https://a.com/x", snippet: "内容一", score: 0.8 },
      { title: "来源二", url: "https://b.com/y", snippet: "内容二" },
    ];
    const res = await PUT(
      req("https://h/api/research", JSON.stringify({ topic: "测试主题", sources }), "PUT")
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const events = text
      .split("\n\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("data:"))
      .map((l) => JSON.parse(l.slice(5).trim()) as { type: string; result?: { sources: unknown[] } });
    const done = events.find((e) => e.type === "done");
    // demo 综述路径：来源原样带入报告
    expect(done?.result).toHaveProperty("sources");
    expect((done?.result as { sources: unknown[] }).sources).toHaveLength(2);
  });

  it("images 的 prompt 为空返回 400", async () => {
    const { POST } = await import("@/app/api/images/route");
    for (const b of [{}, { prompt: "" }, { prompt: "\n\t" }]) {
      const res = await POST(req("https://h/api/images", JSON.stringify(b)));
      expect(res.status).toBe(400);
    }
  });

  it("IMG: images 的 size 越白名单返回 400", async () => {
    const { POST } = await import("@/app/api/images/route");
    for (const bad of ["512x512", "1024", "", "1024x1024x2", { x: 1 }, null]) {
      const res = await POST(
        req("https://h/api/images", JSON.stringify({ prompt: "猫", size: bad }))
      );
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("size");
    }
  });

  it("IMG2: images 的 n 非 1~4 整数返回 400", async () => {
    const { POST } = await import("@/app/api/images/route");
    for (const bad of [0, -1, 5, 1.5, "3", NaN, null]) {
      const res = await POST(req("https://h/api/images", JSON.stringify({ prompt: "猫", n: bad })));
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("n");
    }
  });

  it("IMG5: images 的 reference 形状非法 / 超大返回 400", async () => {
    const { POST } = await import("@/app/api/images/route");
    for (const bad of [
      "ftp://x/y.png",
      "data:text/html;base64,x",
      "javascript:alert(1)",
      "just-a-string",
    ]) {
      const res = await POST(
        req("https://h/api/images", JSON.stringify({ prompt: "猫", reference: bad }))
      );
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("reference");
    }
    // 合法形状但超过 12M 字符上限
    const huge = `data:image/png;base64,${"A".repeat(12_000_001)}`;
    const res = await POST(
      req("https://h/api/images", JSON.stringify({ prompt: "猫", reference: huge }))
    );
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("参考图");
  });

  it("IMG2: images 的 n=1 与 n>1 返回结构（demo 模型免积分）", async () => {
    const { POST } = await import("@/app/api/images/route");
    // 单张：兼容旧结构 { url, model, credits }
    const single = await POST(
      req("https://h/api/images", JSON.stringify({ prompt: "一只猫", model: "demo-image" }))
    );
    expect(single.status).toBe(200);
    const s = (await single.json()) as { url?: string; model?: string; credits?: number };
    expect(s.url).toMatch(/^data:image\//);
    expect(s.model).toBe("demo-image");
    expect(s.credits).toBe(0);
    // 多张：{ images: [...], credits }
    const multi = await POST(
      req("https://h/api/images", JSON.stringify({ prompt: "一只猫", model: "demo-image", n: 3 }))
    );
    expect(multi.status).toBe(200);
    const m = (await multi.json()) as { images?: Array<{ url: string }>; credits?: number };
    expect(m.images).toHaveLength(3);
    expect(m.images!.every((i) => i.url.startsWith("data:image/"))).toBe(true);
    expect(m.credits).toBe(0);
  });

  it("video/storyboard 的 topic 为空或 targetSec 越界返回 400", async () => {
    const { POST } = await import("@/app/api/video/storyboard/route");
    for (const b of [{}, { topic: "" }, { topic: "  " }]) {
      const res = await POST(req("https://h/api/video/storyboard", JSON.stringify(b)));
      expect(res.status).toBe(400);
    }
    for (const bad of [0, -1, 601, "abc", NaN]) {
      const res = await POST(
        req("https://h/api/video/storyboard", JSON.stringify({ topic: "测试", targetSec: bad }))
      );
      expect(res.status).toBe(400);
    }
  });

  it("video/storyboard demo 路径产出标准 SSE 事件（status → done）", async () => {
    const { POST } = await import("@/app/api/video/storyboard/route");
    const res = await POST(
      req("https://h/api/video/storyboard", JSON.stringify({ topic: "智能咖啡机宣传片" }))
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const events = text
      .split("\n\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("data:"))
      .map((l) => JSON.parse(l.slice(5).trim()) as { type: string; result?: { shots: unknown[] } });
    // AI14 协议：至少包含 status 与 done；done 带完整分镜
    expect(events.some((e) => e.type === "status")).toBe(true);
    const done = events.find((e) => e.type === "done");
    expect(done?.result).toHaveProperty("shots");
    expect((done?.result as { shots: unknown[] }).shots.length).toBeGreaterThan(0);
    expect(events.every((e) => ["status", "usage", "done", "error"].includes(e.type))).toBe(true);
  });

  it("video/tts 的参数校验与未配置提示", async () => {
    const { POST } = await import("@/app/api/video/tts/route");
    // 空 text → 400
    for (const b of [{}, { text: "" }, { text: "   " }]) {
      const res = await POST(req("https://h/api/video/tts", JSON.stringify(b)));
      expect(res.status).toBe(400);
    }
    // 超 600 字 → 400
    const res = await POST(
      req("https://h/api/video/tts", JSON.stringify({ text: "长".repeat(601) }))
    );
    expect(res.status).toBe(400);
    // 未配置密钥：给明确的 400 说明（V6 无密钥禁用并说明）
    const noKey = await POST(req("https://h/api/video/tts", JSON.stringify({ text: "你好" })));
    expect(noKey.status).toBe(400);
    expect((await jsonOf(noKey)).error).toContain("TTS");
  });
});

describe("POST /api/slides/export deck 校验", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/slides/export/route");
    return POST(req("https://h/api/slides/export", JSON.stringify(body)));
  };

  it("缺少 deck / deck 无 slides / slides 为空都返回 400", async () => {
    for (const b of [{}, { deck: null }, { deck: {} }, { deck: { slides: [] } }]) {
      const res = await call(b);
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("deck");
    }
  });

  it("合法 deck 返回 pptx 二进制与安全文件名", async () => {
    const res = await call({
      deck: {
        title: "季度汇报",
        theme: "violet",
        slides: [{ layout: "cover", title: "封面", subtitle: "2026" }],
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("presentationml.presentation");
    expect(res.headers.get("content-disposition")).toContain("filename*=UTF-8''");
  });

  it("标题含路径分隔符时被清洗，不能污染 Content-Disposition", async () => {
    const res = await call({
      deck: {
        title: '../../etc/passwd"; x=y',
        theme: "violet",
        slides: [{ layout: "cover", title: "t" }],
      },
    });
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).not.toContain("/");
    expect(disposition).not.toContain('"');
  });

  it("空 stats 页不会因布局计算越界而 500", async () => {
    const res = await call({
      deck: { title: "t", theme: "violet", slides: [{ layout: "stats", title: "数据", stats: [] }] },
    });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/import 备份校验", () => {
  const call = async (raw: BodyInit) => {
    const { POST } = await import("@/app/api/import/route");
    return POST(req("https://h/api/import", raw));
  };

  it("非对象顶层返回 400", async () => {
    for (const raw of ["[]", "null", '"x"', "5"]) {
      const res = await call(raw);
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("未导入任何数据");
    }
  });

  it("app 标记不对返回 400", async () => {
    const res = await call(JSON.stringify({ app: "other", version: 1, conversations: [] }));
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("OpenCanvas 备份");
  });

  it("exportedAt 不是合法日期返回 400", async () => {
    const res = await call(
      JSON.stringify({ app: "opencanvas", version: 1, exportedAt: "x", conversations: [] })
    );
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("有效日期");
  });

  it("版本号不支持时返回 400", async () => {
    const res = await call(
      JSON.stringify({
        app: "opencanvas",
        version: 2,
        exportedAt: new Date().toISOString(),
        conversations: [],
      })
    );
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("备份版本");
  });

  it("合法空备份导入成功", async () => {
    const res = await call(
      JSON.stringify({
        app: "opencanvas",
        version: 1,
        exportedAt: new Date().toISOString(),
        conversations: [],
      })
    );
    expect(res.status).toBe(200);
    expect((await jsonOf(res)).ok).toBe(true);
  });

  it("导入后可通过 /api/export 完整取回", async () => {
    const backup = {
      app: "opencanvas",
      version: 1,
      exportedAt: new Date().toISOString(),
      conversations: [
        {
          id: "c1",
          title: "导入的会话",
          mode: "chat",
          model: "demo",
          modelProvider: null,
          personaId: null,
          deck: null,
          deckStatus: null,
          report: null,
          doc: null,
          images: [],
          archived: false,
          pinned: false,
          createdAt: 1,
          updatedAt: 2,
          messages: [
            {
              id: "m1",
              conversationId: "c1",
              role: "user",
              content: "你好",
              error: false,
              createdAt: 3,
            },
          ],
        },
      ],
    };
    const res = await call(JSON.stringify(backup));
    expect(res.status).toBe(200);

    const { GET } = await import("@/app/api/export/route");
    const dump = (await (await GET()).json()) as {
      app: string;
      conversations: Array<{ id: string; messages: Array<{ content: string }> }>;
    };
    expect(dump.app).toBe("opencanvas");
    expect(dump.conversations).toHaveLength(1);
    expect(dump.conversations[0].messages[0].content).toBe("你好");
  });

  it("重复导入同一备份是幂等的（跳过而非报错）", async () => {
    const backup = {
      app: "opencanvas",
      version: 1,
      exportedAt: new Date().toISOString(),
      conversations: [
        {
          id: "c1",
          title: "会话",
          mode: "chat",
          model: "demo",
          modelProvider: null,
          personaId: null,
          deck: null,
          deckStatus: null,
          report: null,
          doc: null,
          images: [],
          archived: false,
          pinned: false,
          createdAt: 1,
          updatedAt: 2,
          messages: [],
        },
      ],
    };
    const first = (await (await call(JSON.stringify(backup))).json()) as {
      importedConversations: number;
    };
    const second = (await (await call(JSON.stringify(backup))).json()) as {
      importedConversations: number;
      skippedConversations: number;
    };
    expect(first.importedConversations).toBe(1);
    expect(second.importedConversations).toBe(0);
    expect(second.skippedConversations).toBe(1);
  });

  it("会话内某条记录非法时整份备份都不写入", async () => {
    const res = await call(
      JSON.stringify({
        app: "opencanvas",
        version: 1,
        exportedAt: new Date().toISOString(),
        conversations: [
          {
            id: "c1",
            title: "会话",
            mode: "unknown-mode",
            model: "demo",
            images: [],
            doc: null,
            archived: false,
            pinned: false,
            createdAt: 1,
            updatedAt: 2,
            messages: [],
          },
        ],
      })
    );
    expect(res.status).toBe(400);

    const { GET } = await import("@/app/api/export/route");
    const dump = (await (await GET()).json()) as { conversations: unknown[] };
    expect(dump.conversations).toHaveLength(0);
  });
});

describe("POST /api/import/url SSRF 防护", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/import/url/route");
    return POST(req("https://h/api/import/url", JSON.stringify(body)));
  };

  it("缺少 / 空白 / 非字符串 url 都返回 400", async () => {
    for (const b of [{}, { url: "" }, { url: "   " }, { url: 123 }, { url: null }]) {
      const res = await call(b);
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("http/https");
    }
  });

  it("非 http(s) 协议被拒", async () => {
    for (const url of ["file:///etc/passwd", "ftp://x/y", "gopher://x", "data:text/plain,hi"]) {
      const res = await call({ url });
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("只支持 http/https");
    }
  });

  it("指向内网与云元数据地址被拒", async () => {
    for (const url of [
      "http://127.0.0.1/x",
      "http://localhost/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://[::1]/",
    ]) {
      const res = await call({ url });
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toBeTruthy();
    }
  });

  it("拦截发生在发起请求之前（没有真的 fetch 出去）", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await call({ url: "http://127.0.0.1:8080/admin" });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("POST /api/cases/share 参数校验", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/cases/share/route");
    return POST(req("https://h/api/cases/share", JSON.stringify(body)));
  };

  it("缺少 templateId 或 prompt 返回 400", async () => {
    for (const b of [{}, { templateId: "t" }, { prompt: "p" }]) {
      const res = await call(b);
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toContain("必填");
    }
  });

  it("合法分享返回短码与访问路径，且可读回", async () => {
    const res = await call({ templateId: "t1", prompt: "写点什么", label: "示例" });
    expect(res.status).toBe(200);
    const { code, url } = (await res.json()) as { code: string; url: string };
    expect(code).toBeTruthy();
    expect(url).toBe(`/s/${code}`);

    const { GET } = await import("@/app/api/cases/share/[code]/route");
    const got = await GET(new Request(`https://h/api/cases/share/${code}`), { params: { code } });
    expect(got.status).toBe(200);
    expect(await got.json()).toMatchObject({ templateId: "t1", prompt: "写点什么" });
  });

  it("不存在的短码返回 404", async () => {
    const { GET } = await import("@/app/api/cases/share/[code]/route");
    const res = await GET(new Request("https://h/api/cases/share/zzzz"), {
      params: { code: "zzzz" },
    });
    expect(res.status).toBe(404);
  });
});

describe("工具类接口的输入校验", () => {
  it("OCR 缺少图片返回 400", async () => {
    const { POST } = await import("@/app/api/tools/ocr/route");
    const res = await POST(req("https://h/api/tools/ocr", JSON.stringify({})));
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("图片");
  });

  it("OCR 非图片 MIME 被拒", async () => {
    const { POST } = await import("@/app/api/tools/ocr/route");
    const res = await POST(
      req(
        "https://h/api/tools/ocr",
        JSON.stringify({ image: "data:application/pdf;base64,JVBERi0=" })
      )
    );
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("只支持图片");
  });

  it("PDF 缺少 action / 文件返回 400", async () => {
    const { POST } = await import("@/app/api/tools/pdf/route");
    expect((await POST(req("https://h/api/tools/pdf", JSON.stringify({})))).status).toBe(400);
    expect(
      (await POST(req("https://h/api/tools/pdf", JSON.stringify({ action: "info", files: [] }))))
        .status
    ).toBe(400);
  });

  it("PDF 内容不是合法 base64 时给出文件名提示", async () => {
    const { POST } = await import("@/app/api/tools/pdf/route");
    const res = await POST(
      req(
        "https://h/api/tools/pdf",
        JSON.stringify({ action: "info", files: [{ name: "a.pdf", data: "!!!" }] })
      )
    );
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("a.pdf");
  });

  it("PDF 能力清单是只读的 GET", async () => {
    const { GET } = await import("@/app/api/tools/pdf/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as { actions: string[] };
    expect(data.actions).toContain("merge");
  });
});

describe("PATCH /api/conversations/[id] 的 images 校验（R13）", () => {
  const patch = async (body: unknown) => {
    const { POST } = await import("@/app/api/conversations/route");
    await POST(req("https://h/api/conversations", JSON.stringify({ id: "c1" })));
    const { PATCH } = await import("@/app/api/conversations/[id]/route");
    return PATCH(req("https://h/api/conversations/c1", JSON.stringify(body), "PATCH"), {
      params: { id: "c1" },
    });
  };

  const image = (patchImg: Record<string, unknown> = {}) => ({
    id: "i1",
    prompt: "夕阳",
    model: "demo",
    url: "https://cdn/a.png",
    createdAt: 1,
    ...patchImg,
  });

  it("合法 images 正常入库并能读回", async () => {
    expect((await patch({ images: [image()] })).status).toBe(200);
    const { GET } = await import("@/app/api/conversations/[id]/route");
    const detail = (await (
      await GET(new Request("https://h/api/conversations/c1"), { params: { id: "c1" } })
    ).json()) as { conversation: { images: Array<{ id: string }> } };
    expect(detail.conversation.images.map((i) => i.id)).toEqual(["i1"]);
  });

  it("空数组合法", async () => {
    expect((await patch({ images: [] })).status).toBe(200);
  });

  it.each([
    ["对象", {}],
    ["字符串", "x"],
    ["数字", 1],
  ])("images 是 %s 时 400 而不是 500", async (_label, value) => {
    const res = await patch({ images: value });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("数组");
  });

  it.each(["id", "prompt", "model", "url"])("images 缺 %s 字段时 400", async (field) => {
    const bad: Record<string, unknown> = image();
    delete bad[field];
    const res = await patch({ images: [bad] });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain(field);
  });

  it("images 元素不是对象时 400", async () => {
    const res = await patch({ images: ["not-an-object"] });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("images[0]");
  });

  it("单张图超过 16MB 上限时 400，绝不撑爆数据库", async () => {
    const huge = `data:image/png;base64,${Buffer.alloc(17 * 1024 * 1024, 0x61).toString("base64")}`;
    const res = await patch({ images: [image({ url: huge })] });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("超过上限");
  });

  it("不传 images 时不触碰该字段", async () => {
    await patch({ images: [image()] });
    const { PATCH, GET } = await import("@/app/api/conversations/[id]/route");
    await PATCH(req("https://h/api/conversations/c1", JSON.stringify({ title: "新标题" }), "PATCH"), {
      params: { id: "c1" },
    });
    const detail = (await (
      await GET(new Request("https://h/api/conversations/c1"), { params: { id: "c1" } })
    ).json()) as { conversation: { title: string; images: unknown[] } };
    expect(detail.conversation.title).toBe("新标题");
    expect(detail.conversation.images).toHaveLength(1);
  });
});

describe("GET /api/files/images/[name]（R13 读图路由）", () => {
  const get = async (name: string) => {
    const { GET } = await import("@/app/api/files/images/[name]/route");
    return GET(new Request(`https://h/api/files/images/${name}`), { params: { name } });
  };

  /** 直接往数据目录里放一张图，绕开生成链路 */
  async function seedImage(name: string, bytes = Buffer.from([1, 2, 3])) {
    const { imagesDir } = await import("@/lib/db/image-store");
    const fs = await import("node:fs");
    fs.mkdirSync(imagesDir(), { recursive: true });
    fs.writeFileSync(path.join(imagesDir(), name), bytes);
  }

  it("存在的图片返回 200 与正确的 Content-Type", async () => {
    await seedImage("a1.png");
    const res = await get("a1.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from([1, 2, 3]));
  });

  it("带上不可变长缓存头（文件名含唯一 id，内容永不变）", async () => {
    await seedImage("a2.png");
    const cc = (await get("a2.png")).headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("immutable");
  });

  it("Content-Length 与真实体积一致", async () => {
    await seedImage("a3.webp", Buffer.alloc(64));
    const res = await get("a3.webp");
    expect(res.headers.get("Content-Length")).toBe("64");
    expect(res.headers.get("Content-Type")).toBe("image/webp");
  });

  it("不存在的图片返回 404", async () => {
    expect((await get("nope.png")).status).toBe(404);
  });

  it("路径指向目录时返回 404", async () => {
    const { imagesDir } = await import("@/lib/db/image-store");
    const fs = await import("node:fs");
    fs.mkdirSync(path.join(imagesDir(), "dir.png"), { recursive: true });
    expect((await get("dir.png")).status).toBe(404);
  });

  it.each([
    ["上跳一级", "../dev.db"],
    ["深层上跳", "../../etc/passwd"],
    ["带子目录", "sub/a.png"],
    ["无扩展名", "abc"],
    ["非白名单扩展名", "a.exe"],
    ["空字节截断", "a.png\u0000.txt"],
  ])("非法文件名 %s 返回 400", async (_label, name) => {
    expect((await get(name)).status).toBe(400);
  });

  it("穿越请求不会读到数据库文件", async () => {
    const fs = await import("node:fs");
    fs.writeFileSync(path.join(tempDir, "secret.db"), "机密");
    const res = await get("../secret.db");
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("机密");
  });
});
describe("DB 章新增路由：search / folders / maintenance/compact", () => {
  it("GET /api/search 空参数返回空结果而非报错", async () => {
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(new Request("http://localhost/api/search"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hits: [] });
  });

  it("GET /api/search?q= 命中消息并返回片段", async () => {
    const { repo } = await import("@/lib/db/repo");
    repo.upsertConversation({ id: "c1", title: "搜索" });
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "user", content: "苹果新品上市" });

    const { GET } = await import("@/app/api/search/route");
    const res = await GET(new Request("http://localhost/api/search?q=苹果"));
    const data = (await res.json()) as { hits: Array<{ messageId: string; conversationId: string }> };
    expect(res.status).toBe(200);
    expect(data.hits).toHaveLength(1);
    expect(data.hits[0].messageId).toBe("m1");
    expect(data.hits[0].conversationId).toBe("c1");
  });

  it("POST /api/folders 建/改名/删的参数校验", async () => {
    const foldersRoute = await import("@/app/api/folders/route");

    // 空 name → 400
    const bad = await foldersRoute.POST(req("http://localhost/api/folders", JSON.stringify({ name: "" })));
    expect(bad.status).toBe(400);
    // 超 name 长度 → 400
    const long = await foldersRoute.POST(
      req("http://localhost/api/folders", JSON.stringify({ name: "x".repeat(51) }))
    );
    expect(long.status).toBe(400);

    // 正常创建 → 200 且能列出
    const ok = await foldersRoute.POST(
      req("http://localhost/api/folders", JSON.stringify({ name: "项目 A" }))
    );
    expect(ok.status).toBe(200);
    const folder = (await ok.json()) as { id: string; name: string };
    const list = await foldersRoute.GET(new Request("http://localhost/api/folders"));
    const { folders } = (await list.json()) as { folders: Array<{ id: string; name: string }> };
    expect(folders).toHaveLength(1);

    // 改名缺 id → 400
    const badPatch = await foldersRoute.PATCH(
      req("http://localhost/api/folders", JSON.stringify({ id: "", name: "新名" }), "PATCH")
    );
    expect(badPatch.status).toBe(400);
    // 改名不存在 → 404
    const missPatch = await foldersRoute.PATCH(
      req("http://localhost/api/folders", JSON.stringify({ id: "nope", name: "新名" }), "PATCH")
    );
    expect(missPatch.status).toBe(404);

    // 删除缺 id → 400；删除成功 → ok
    const badDel = await foldersRoute.DELETE(new Request("http://localhost/api/folders"));
    expect(badDel.status).toBe(400);
    const del = await foldersRoute.DELETE(
      new Request(`http://localhost/api/folders?id=${folder.id}`)
    );
    expect(del.status).toBe(200);
  });

  it("POST /api/maintenance/compact 成功压缩", async () => {
    const { repo } = await import("@/lib/db/repo");
    repo.upsertConversation({ id: "c1", title: "压缩测试" });

    const { POST } = await import("@/app/api/maintenance/compact/route");
    const res = await POST(new Request("http://localhost/api/maintenance/compact"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; compactedAt: number };
    expect(data.ok).toBe(true);
    expect(data.compactedAt).toBeGreaterThan(0);
  });

  it("GET /api/conversations/[id]?limit= 返回最近 N 条与 hasMore", async () => {
    const { repo } = await import("@/lib/db/repo");
    repo.upsertConversation({ id: "c1", title: "分页" });
    for (let i = 0; i < 7; i++) {
      repo.insertMessage({
        id: `m${i}`,
        conversationId: "c1",
        role: "user",
        content: `消息 ${i}`,
      });
    }

    const { GET } = await import("@/app/api/conversations/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/conversations/c1?limit=5"),
      { params: { id: "c1" } }
    );
    const data = (await res.json()) as {
      messages: Array<{ id: string }>;
      hasMore: boolean;
    };
    expect(data.messages).toHaveLength(5);
    expect(data.hasMore).toBe(true);
    // 最近 5 条 = m2..m6（时间正序）
    expect(data.messages.map((m) => m.id)).toEqual(["m2", "m3", "m4", "m5", "m6"]);
  });
});

describe("AI10 用量看板路由 /api/usage", () => {
  it("days 畸形值返回 400", async () => {
    const { GET } = await import("@/app/api/usage/route");
    const res = await GET(new Request("http://localhost/api/usage?days=abc"));
    expect(res.status).toBe(400);
  });

  it("空数据返回空 stats 与零余额", async () => {
    const { GET } = await import("@/app/api/usage/route");
    const res = await GET(new Request("http://localhost/api/usage"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      days: number;
      stats: unknown[];
      balance: { granted: number; available: number };
    };
    expect(data.days).toBe(30);
    expect(data.stats).toEqual([]);
    expect(data.balance).toMatchObject({ granted: 0, available: 0 });
  });

  it("落库的用量按天 × 模型聚合返回", async () => {
    const { usageRepo, creditRepo } = await import("@/lib/db/repo");
    creditRepo.grant(500, "注册赠送");
    usageRepo.record({
      conversationId: "c1",
      model: "qwen-plus",
      provider: "dashscope",
      inputTokens: 100,
      outputTokens: 200,
      costUsd: 0.01,
      credits: 1,
      success: true,
      durationMs: 800,
    });
    usageRepo.record({
      conversationId: null,
      model: "gpt-4o-mini",
      provider: "openai",
      inputTokens: 50,
      outputTokens: 0,
      costUsd: 0,
      credits: 0,
      success: false,
      durationMs: 100,
    });

    const { GET } = await import("@/app/api/usage/route");
    const res = await GET(new Request("http://localhost/api/usage?days=7"));
    const data = (await res.json()) as {
      days: number;
      stats: Array<{ model: string; provider: string; calls: number; successCalls: number }>;
      balance: { granted: number; available: number };
    };
    expect(res.status).toBe(200);
    expect(data.days).toBe(7);
    expect(data.stats).toHaveLength(2);
    const qwen = data.stats.find((s) => s.model === "qwen-plus")!;
    expect(qwen.provider).toBe("dashscope");
    expect(qwen.successCalls).toBe(1);
    const gpt = data.stats.find((s) => s.model === "gpt-4o-mini")!;
    expect(gpt.successCalls).toBe(0);
    expect(data.balance.available).toBe(500);
  });

  it("days 超上限被钳到 90", async () => {
    const { GET } = await import("@/app/api/usage/route");
    const res = await GET(new Request("http://localhost/api/usage?days=3650"));
    const data = (await res.json()) as { days: number };
    expect(data.days).toBe(90);
  });
});

describe("DOC5 文档版本历史 /api/conversations/[id]/doc-versions", () => {
  const post = (id: string, body: unknown) =>
    (async () => {
      const mod = await import("@/app/api/conversations/[id]/doc-versions/route");
      return mod.POST(
        new Request(`https://h/api/conversations/${id}/doc-versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        { params: { id } }
      );
    })();

  it("会话不存在返回 404", async () => {
    const res = await post("ghost", { doc: { title: "t", content: "c" } });
    expect(res.status).toBe(404);
  });

  it("doc 缺字段 / 非法类型返回 400", async () => {
    const { repo } = await import("@/lib/db/repo");
    repo.upsertConversation({ id: "c-doc", mode: "docs", model: "demo", title: "文档会话" });
    for (const bad of [
      {},
      { doc: {} },
      { doc: { title: 42, content: "c" } },
      { doc: { title: "t", content: null } },
    ]) {
      const res = await post("c-doc", bad);
      expect(res.status).toBe(400);
    }
  });

  it("保存 → 列表 → 封顶裁剪的完整链路", async () => {
    const { repo, docVersionRepo, DOC_VERSION_CAP } = await import("@/lib/db/repo");
    repo.upsertConversation({ id: "c-doc2", mode: "docs", model: "demo", title: "会话二" });

    const save = (content: string) => post("c-doc2", { doc: { title: "版本", content } });
    for (let i = 0; i < DOC_VERSION_CAP + 5; i++) {
      const res = await save(`第 ${i} 版`);
      expect(res.status).toBe(200);
    }
    // list 默认只取最近 20 份，验证封顶需显式给 limit
    const list = docVersionRepo.list("c-doc2", DOC_VERSION_CAP);
    expect(list).toHaveLength(DOC_VERSION_CAP);
    // 新→旧排序，最新一份在最前
    expect(list[0].content).toBe(`第 ${DOC_VERSION_CAP + 4} 版`);
    expect(list[list.length - 1].content).toBe("第 5 版");

    const { GET } = await import("@/app/api/conversations/[id]/doc-versions/route");
    const res = await GET(new Request("https://h/api/conversations/c-doc2/doc-versions"), {
      params: { id: "c-doc2" },
    });
    const data = (await res.json()) as { versions: Array<{ content: string }> };
    expect(res.status).toBe(200);
    expect(data.versions).toHaveLength(DOC_VERSION_CAP);
  });

  it("超长内容返回 400", async () => {
    const { repo } = await import("@/lib/db/repo");
    repo.upsertConversation({ id: "c-doc3", mode: "docs", model: "demo", title: "会话三" });
    const res = await post("c-doc3", { doc: { title: "t", content: "x".repeat(2_000_001) } });
    expect(res.status).toBe(400);
  });

  it("purgeConversation 级联清理版本快照", async () => {
    const { repo, docVersionRepo } = await import("@/lib/db/repo");
    repo.upsertConversation({ id: "c-doc4", mode: "docs", model: "demo", title: "会话四" });
    await post("c-doc4", { doc: { title: "t", content: "c" } });
    expect(docVersionRepo.list("c-doc4")).toHaveLength(1);
    repo.purgeConversation("c-doc4");
    expect(docVersionRepo.list("c-doc4")).toHaveLength(0);
  });
});

describe("PPT7 打印样式导出 /api/slides/export-pdf", () => {
  it("合法 deck 产出打印 HTML（含分页样式与主题色）", async () => {
    const { POST } = await import("@/app/api/slides/export-pdf/route");
    const res = await POST(
      new Request("https://h/api/slides/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deck: {
            title: "测试演示",
            theme: "ocean",
            slides: [
              { layout: "cover", title: "封面" },
              { layout: "timeline", title: "路线图", steps: [{ item: "Q1", detail: "起步" }] },
              { layout: "quote", title: "金句", quote: "大道至简", quoteBy: "佚名" },
              { layout: "content", title: "要点", bullets: ["一", "二"], note: "讲重点" },
              { layout: "end", title: "谢谢" },
            ],
          },
        }),
      })
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("page-break-after");
    expect(html).toContain("#0c4a6e"); // ocean 主题色
    expect(html).toContain("封面");
    expect(html).toContain("Q1");
    expect(html).toContain("大道至简");
    expect(html).toContain("备注：讲重点");
  });

  it("deck 缺 slides 返回 400", async () => {
    const { POST } = await import("@/app/api/slides/export-pdf/route");
    const res = await POST(
      new Request("https://h/api/slides/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck: { title: "x" } }),
      })
    );
    expect(res.status).toBe(400);
  });
});
