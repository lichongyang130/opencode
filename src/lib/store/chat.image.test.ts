import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useChatStore as StoreType } from "./chat";

/**
 * IMG 章的 store 侧行为锁定：
 *  1) generateImage 新签名（opts 携带 model/n/style/negative/reference）与
 *     服务端请求体一一对应（IMG1~IMG5）；
 *  2) 多张返回 images 数组时批量入库、单张保持旧结构（IMG2）；
 *  3) 成功生成后记录提示词历史（IMG6）；
 *  4) deleteImages / clearImages / insertImageToDoc / applyImageToSlide（IMG8/IMG11）。
 */

type Store = typeof StoreType;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-type": "application/json" } });

interface Harness {
  store: Store;
  bodies: Array<{ url: string; method: string; body: unknown }>;

}

/**
 * 与 chat.doc.test 同款打桩骨架，只是会话列表换成 image 模式种子 + /api/images 通道。
 * imageHandler 可替换成多张/失败返回。
 */
async function harness(imageHandler: () => Response = imageDemoSingle): Promise<Harness> {
  vi.resetModules();
  const bodies: Harness["bodies"] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      let parsed: unknown = undefined;
      if (typeof init?.body === "string") {
        try {
          parsed = JSON.parse(init.body);
        } catch {
          parsed = init.body;
        }
      }
      bodies.push({ url, method: init?.method ?? "GET", body: parsed });
      if (url.includes("archived=all"))
        return json({
          conversations: [{ id: "c1", mode: "image", model: "demo", images: [] }],
        });
      if (url.includes("/api/images")) return imageHandler();
      if (url.includes("/api/models")) return json({ status: {} });
      return json({ ok: true });
    })
  );
  const mod = await import("./chat");
  await mod.useChatStore.getState().hydrate();
  return { store: mod.useChatStore, bodies };
}

const imageDemoSingle = () =>
  json({ url: "data:image/png;base64,iVBOR", model: "demo-image", credits: 0 });

const imageDemoTriple = () =>
  json({
    images: [
      { url: "data:image/png;base64,AAA", model: "demo-image" },
      { url: "data:image/png;base64,BBB", model: "demo-image" },
      { url: "data:image/png;base64,CCC", model: "demo-image" },
    ],
    credits: 0,
  });

const convoOf = (store: Store) => store.getState().conversations.find((c) => c.id === "c1");

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("IMG1~5 generateImage 参数透传", () => {
  it("opts 完整透传到 /api/images 请求体", async () => {
    const { store, bodies } = await harness();
    await store.getState().generateImage("一只猫", {
      model: "wan2.7-t2i-flash",
      size: "1792x1024",
      n: 2,
      style: "cinematic",
      negative: "文字，水印",
      reference: "data:image/png;base64,xxx",
    });
    const call = bodies.find((b) => b.url.includes("/api/images"));
    expect(call).toBeTruthy();
    const body = call!.body as Record<string, unknown>;
    // 风格词前置拼进 prompt（buildImagePrompt 的契约）
    expect(body.prompt).toBe("cinematic movie poster, dramatic lighting, 一只猫");
    expect(body.model).toBe("wan2.7-t2i-flash");
    expect(body.size).toBe("1792x1024");
    expect(body.n).toBe(2);
    expect(body.negative).toBe("文字，水印");
    expect(body.reference).toBe("data:image/png;base64,xxx");
  });

  it("不传 opts 时保持旧行为：默认尺寸、demo 模型、原样提示词", async () => {
    const { store, bodies } = await harness();
    await store.getState().generateImage("一只猫");
    const body = bodies.find((b) => b.url.includes("/api/images"))!.body as Record<string, unknown>;
    expect(body.prompt).toBe("一只猫");
    expect(body.model).toBe("demo-image");
    expect(body.size).toBe("1024x1024");
    expect(body.n).toBe(1);
  });
});

describe("IMG2 多张生成", () => {
  it("images 数组返回时批量入库、助手气泡报张数", async () => {
    const { store } = await harness(imageDemoTriple);
    await store.getState().generateImage("一只猫", { n: 3 });
    const images = convoOf(store)?.images ?? [];
    expect(images).toHaveLength(3);
    expect(images.every((i) => i.url.startsWith("data:image/"))).toBe(true);
    const last = convoOf(store)?.messages.at(-1);
    expect(last?.content).toContain("3 张");
  });

  it("单张 url 返回时保持旧结构入库一张", async () => {
    const { store } = await harness();
    await store.getState().generateImage("一只猫");
    const images = convoOf(store)?.images ?? [];
    expect(images).toHaveLength(1);
    expect(images[0].model).toBe("demo-image");
  });
});

describe("IMG6 提示词历史记录", () => {
  it("生成成功后按原样 prompt（不含风格词）记录一条", async () => {
    const { store } = await harness();
    await store.getState().generateImage("一只猫", { style: "3d", model: "demo-image" });
    const { loadPromptHistory } = await import("@/lib/image/history");
    const list = loadPromptHistory();
    expect(list).toHaveLength(1);
    expect(list[0].prompt).toBe("一只猫");
    expect(list[0].style).toBe("3d");
  });

  it("生成失败不记录历史", async () => {
    const { store } = await harness(() => json({ error: "boomed" }, 500));
    await store.getState().generateImage("一只猫");
    const { loadPromptHistory } = await import("@/lib/image/history");
    expect(loadPromptHistory()).toHaveLength(0);
    // 失败气泡标红
    const last = convoOf(store)?.messages.at(-1);
    expect(last?.error).toBe(true);
  });
});

describe("IMG8 删除与清空", () => {
  it("deleteImages 按 id 剔除，未命中的保留", async () => {
    const { store } = await harness();
    await store.getState().generateImage("第一张");
    await store.getState().generateImage("第二张");
    const all = convoOf(store)?.images ?? [];
    expect(all).toHaveLength(2);
    store.getState().deleteImages([all[0].id]);
    const rest = convoOf(store)?.images ?? [];
    expect(rest).toHaveLength(1);
    expect(rest[0].prompt).toBe("第二张");
  });

  it("clearImages 清空全部", async () => {
    const { store } = await harness();
    await store.getState().generateImage("第一张");
    await store.getState().generateImage("第二张");
    store.getState().clearImages();
    expect(convoOf(store)?.images).toHaveLength(0);
  });

  it("非激活会话时静默跳过（会话可能已被删除）", async () => {
    const { store } = await harness();
    store.setState({ activeId: "nope" });
    expect(() => store.getState().clearImages()).not.toThrow();
    expect(() => store.getState().deleteImages(["x"])).not.toThrow();
  });
});

describe("IMG11 插入文档 / 设为 PPT 配图", () => {
  it("insertImageToDoc 无 docs 会话时新建并写入图片 Markdown", async () => {
    const { store, bodies } = await harness();
    await store.getState().insertImageToDoc("data:image/png;base64,Z", "封面图");
    const created = store
      .getState()
      .conversations.find((c) => c.mode === "docs" && c.doc?.content.includes("封面图"));
    expect(created).toBeTruthy();
    expect(created?.doc?.content).toContain("![封面图](data:image/png;base64,Z)");
    // 新建会话有 POST /api/conversations 落库动作
    expect(bodies.some((b) => b.url.includes("/api/conversations") && b.method === "POST")).toBe(true);
  });

  it("applyImageToSlide 无 deck 时只提示不写入", async () => {
    const { store } = await harness();
    store.getState().applyImageToSlide("data:image/png;base64,Z");
    expect(store.getState().conversations.find((c) => c.mode === "slides")).toBeUndefined();
  });
});