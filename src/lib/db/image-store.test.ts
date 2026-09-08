import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * 图片落盘测试。
 *
 * 起因：绘图产物原先整条 data URI 塞进 conversations.images，一张 DALL·E PNG 就 2~3MB，
 * 而侧栏列表是 SELECT *，几十张之后每次刷新都要把上百兆二进制读出来再 JSON.parse。
 *
 * 因此这里钉四件事：
 *  1) 阈值边界准确（小图仍内联，演示 SVG 不受影响）；
 *  2) 落盘失败必须退回内联 —— 存进库里只是慢，丢掉刚生成的图才是真损失；
 *  3) resolveImageFile 必须挡住路径穿越；
 *  4) normalizeImagesPayload 把畸形输入全部归到 400，不允许冒 500。
 */

/**
 * node:fs 的 ESM 命名空间是只读的，vi.spyOn 会报 Cannot redefine property，
 * 所以整模块 mock 掉：默认全部走真实实现，只在需要复现「磁盘满 / 只读挂载」时
 * 临时给 failing 里塞上要失败的函数名。
 */
const failing = new Set<string>();

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  const wrap = <K extends keyof typeof real>(name: K) =>
    vi.fn((...args: unknown[]) => {
      if (failing.has(name as string)) throw new Error(`模拟失败：${String(name)}`);
      return (real[name] as (...a: unknown[]) => unknown)(...args);
    }) as unknown as (typeof real)[K];

  return {
    ...real,
    mkdirSync: wrap("mkdirSync"),
    writeFileSync: wrap("writeFileSync"),
    rmSync: wrap("rmSync"),
  };
});

let tempDir: string;
type Mod = typeof import("./image-store");
let m: Mod;

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "oc-img-"));
  process.env.OC_DATA_DIR = tempDir;
  // dataDir() 每次调用都读环境变量，但 image-store 会缓存 dirReady，重置模块更稳妥
  vi.resetModules();
  m = await import("./image-store");
});

afterEach(() => {
  failing.clear();
  delete process.env.OC_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** 构造一个指定字节数的 base64 data URI */
function base64Uri(bytes: number, mime = "image/png"): string {
  return `data:${mime};base64,${Buffer.alloc(bytes, 0x61).toString("base64")}`;
}

const img = (id: string, url: string) => ({
  id,
  prompt: "p",
  model: "demo",
  url,
  createdAt: 1,
});

describe("decodeDataUri", () => {
  it("解析 base64 编码的 data URI", () => {
    const d = m.decodeDataUri("data:image/png;base64,aGVsbG8=");
    expect(d?.bytes.toString("utf8")).toBe("hello");
    expect(d?.ext).toBe("png");
  });

  it("解析 percent-encoding 的 data URI（演示绘图的 SVG 走这条）", () => {
    const svg = "<svg><text>你好</text></svg>";
    const d = m.decodeDataUri(`data:image/svg+xml,${encodeURIComponent(svg)}`);
    expect(d?.bytes.toString("utf8")).toBe(svg);
    expect(d?.ext).toBe("svg");
  });

  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/jpg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["image/svg+xml", "svg"],
    ["image/avif", "avif"],
  ])("%s 映射到扩展名 %s", (mime, ext) => {
    expect(m.decodeDataUri(`data:${mime};base64,aGk=`)?.ext).toBe(ext);
  });

  it("未知 mime 回落到 png", () => {
    expect(m.decodeDataUri("data:image/heic;base64,aGk=")?.ext).toBe("png");
  });

  it("mime 大小写不敏感", () => {
    expect(m.decodeDataUri("data:IMAGE/PNG;BASE64,aGk=")?.ext).toBe("png");
  });

  it("缺 mime 时按 png 处理", () => {
    expect(m.decodeDataUri("data:;base64,aGk=")?.ext).toBe("png");
  });

  it("带额外参数（charset）仍能取到 mime", () => {
    const d = m.decodeDataUri("data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E");
    expect(d?.ext).toBe("svg");
  });

  it.each([
    ["非 data URI", "https://cdn/x.png"],
    ["同源相对路径", "/api/files/images/a.png"],
    ["没有逗号", "data:image/png;base64"],
    ["空载荷", "data:image/png;base64,"],
    ["空字符串", ""],
  ])("%s 返回 null", (_label, url) => {
    expect(m.decodeDataUri(url)).toBeNull();
  });

  it("percent-encoding 非法时返回 null 而不抛错", () => {
    expect(m.decodeDataUri("data:image/svg+xml,%E0%A4%A")).toBeNull();
  });
});

describe("dataUriByteLength", () => {
  it("返回解码后的真实体积", () => {
    expect(m.dataUriByteLength(base64Uri(1024))).toBe(1024);
  });

  it("外链返回 0（不占库）", () => {
    expect(m.dataUriByteLength("https://cdn/x.png")).toBe(0);
  });
});

describe("resolveImageFile 路径穿越防护", () => {
  it("合法文件名解析到 images 目录下", () => {
    const f = m.resolveImageFile("abc-1_2.png");
    expect(f).toBe(path.join(tempDir, "images", "abc-1_2.png"));
  });

  it.each(["png", "jpg", "webp", "gif", "svg", "avif"])("接受 .%s 扩展名", (ext) => {
    expect(m.resolveImageFile(`a.${ext}`)).not.toBeNull();
  });

  it.each([
    ["上跳一级", "../dev.db"],
    ["深层上跳", "../../etc/passwd"],
    ["带子目录", "sub/a.png"],
    ["反斜杠子目录", "sub\\a.png"],
    ["绝对路径", "/etc/passwd"],
    ["URL 编码的上跳", "%2e%2e%2fdev.db"],
    ["空字节截断", "a.png\u0000.txt"],
    ["无扩展名", "abc"],
    ["非白名单扩展名", "a.exe"],
    ["双扩展名", "a.png.exe"],
    ["点开头", ".png"],
    ["空字符串", ""],
    ["带空格", "a b.png"],
    ["中文名", "图.png"],
  ])("拒绝 %s", (_label, name) => {
    expect(m.resolveImageFile(name)).toBeNull();
  });

  it("扩展名大写不被接受（避免大小写不敏感文件系统上产生歧义）", () => {
    expect(m.resolveImageFile("a.PNG")).toBeNull();
  });
});

describe("contentTypeOf", () => {
  it.each([
    ["a.png", "image/png"],
    ["a.jpg", "image/jpeg"],
    ["a.webp", "image/webp"],
    ["a.gif", "image/gif"],
    ["a.svg", "image/svg+xml"],
    ["a.avif", "image/avif"],
  ])("%s -> %s", (name, type) => {
    expect(m.contentTypeOf(name)).toBe(type);
  });

  it("扩展名大小写不敏感", () => {
    expect(m.contentTypeOf("a.PNG")).toBe("image/png");
  });

  it("未知扩展名回落到二进制流", () => {
    expect(m.contentTypeOf("a.bin")).toBe("application/octet-stream");
    expect(m.contentTypeOf("noext")).toBe("application/octet-stream");
  });
});

describe("externalizeImages 阈值与落盘", () => {
  it("小于阈值的图片保持内联", () => {
    const small = base64Uri(1024);
    const out = m.externalizeImages([img("i1", small)]);
    expect(out[0].url).toBe(small);
    expect(existsSync(m.imagesDir())).toBe(false);
  });

  it("正好等于阈值仍保持内联（边界取等号不落盘）", () => {
    const exact = base64Uri(m.INLINE_IMAGE_LIMIT);
    expect(m.externalizeImages([img("i1", exact)])[0].url).toBe(exact);
  });

  it("超过阈值 1 字节即落盘", () => {
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 1);
    const out = m.externalizeImages([img("i1", big)]);
    expect(out[0].url).toBe(`${m.IMAGE_URL_PREFIX}i1.png`);
    const file = path.join(m.imagesDir(), "i1.png");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file).length).toBe(m.INLINE_IMAGE_LIMIT + 1);
  });

  it("落盘文件名带上正确扩展名", () => {
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 10, "image/webp");
    expect(m.externalizeImages([img("i9", big)])[0].url).toBe(`${m.IMAGE_URL_PREFIX}i9.webp`);
  });

  it("id 里的不安全字符被剔除，绝不参与拼路径", () => {
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 1);
    const out = m.externalizeImages([img("../../evil id!", big)]);
    expect(out[0].url).toBe(`${m.IMAGE_URL_PREFIX}evilid.png`);
    expect(existsSync(path.join(m.imagesDir(), "evilid.png"))).toBe(true);
  });

  it("id 被清理后为空时用时间戳兜底", () => {
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 1);
    const out = m.externalizeImages([img("！！！", big)]);
    expect(out[0].url).toMatch(new RegExp(`^${m.IMAGE_URL_PREFIX}img-\\d+\\.png$`));
  });

  it("外链与已落盘的相对路径原样保留", () => {
    const list = [img("i1", "https://cdn/x.png"), img("i2", "/api/files/images/old.png")];
    expect(m.externalizeImages(list)).toEqual(list);
  });

  it("混合数组里只转存超阈值的那些", () => {
    const small = base64Uri(512);
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 1);
    const out = m.externalizeImages([img("s", small), img("b", big)]);
    expect(out[0].url).toBe(small);
    expect(out[1].url).toBe(`${m.IMAGE_URL_PREFIX}b.png`);
  });

  it("保留除 url 以外的其他字段", () => {
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 1);
    const out = m.externalizeImages([{ ...img("i1", big), prompt: "夕阳", createdAt: 42 }]);
    expect(out[0]).toMatchObject({ id: "i1", prompt: "夕阳", createdAt: 42 });
  });

  it("空数组与非数组原样返回", () => {
    expect(m.externalizeImages([])).toEqual([]);
    expect(m.externalizeImages(null as never)).toBeNull();
  });

  it("url 不是字符串的条目被跳过而不是抛错", () => {
    const list = [{ id: "i1", url: 123 as never }];
    expect(() => m.externalizeImages(list)).not.toThrow();
    expect(m.externalizeImages(list)).toEqual(list);
  });

  it("落盘失败时退回内联，绝不丢数据", () => {
    failing.add("writeFileSync");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 1);
    const out = m.externalizeImages([img("i1", big)]);
    expect(out[0].url).toBe(big);
    expect(errSpy).toHaveBeenCalled();
  });

  it("建目录失败时同样退回内联", () => {
    failing.add("mkdirSync");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 1);
    expect(m.externalizeImages([img("i1", big)])[0].url).toBe(big);
  });

  it("多张图只建一次目录", async () => {
    const fs = await import("node:fs");
    const spy = fs.mkdirSync as unknown as ReturnType<typeof vi.fn>;
    spy.mockClear();
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 1);
    m.externalizeImages([img("a", big), img("b", big), img("c", big)]);
    // dirReady 标记生效：三张图只应触发一次 mkdirSync
    expect(spy).toHaveBeenCalledTimes(1);
    for (const name of ["a.png", "b.png", "c.png"]) {
      expect(existsSync(path.join(m.imagesDir(), name))).toBe(true);
    }
  });
});

describe("removeExternalImages", () => {
  it("删掉落盘文件", () => {
    const big = base64Uri(m.INLINE_IMAGE_LIMIT + 1);
    const out = m.externalizeImages([img("i1", big)]);
    const file = path.join(m.imagesDir(), "i1.png");
    expect(existsSync(file)).toBe(true);
    m.removeExternalImages(out);
    expect(existsSync(file)).toBe(false);
  });

  it("跳过内联与外链，不误删", () => {
    expect(() =>
      m.removeExternalImages([{ url: base64Uri(10) }, { url: "https://cdn/x.png" }, {}])
    ).not.toThrow();
  });

  it("文件不存在时静默返回", () => {
    expect(() =>
      m.removeExternalImages([{ url: `${m.IMAGE_URL_PREFIX}nope.png` }])
    ).not.toThrow();
  });

  it("url 里带穿越路径时不删任何文件", () => {
    const guard = path.join(tempDir, "dev.db");
    writeFileSync(guard, "x");
    m.removeExternalImages([{ url: `${m.IMAGE_URL_PREFIX}../dev.db` }]);
    expect(existsSync(guard)).toBe(true);
  });

  it("删除失败不抛错（清理是尽力而为，不能阻塞会话删除）", () => {
    failing.add("rmSync");
    expect(() => m.removeExternalImages([{ url: `${m.IMAGE_URL_PREFIX}a.png` }])).not.toThrow();
  });
});

describe("normalizeImagesPayload", () => {
  const good = { id: "i1", prompt: "p", model: "demo", url: "https://cdn/a.png", createdAt: 5 };

  it("合法数组原样通过", () => {
    const r = m.normalizeImagesPayload([good]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.images[0]).toEqual(good);
  });

  it("空数组合法", () => {
    const r = m.normalizeImagesPayload([]);
    expect(r).toEqual({ ok: true, images: [] });
  });

  it("createdAt 缺失时补当前时间", () => {
    const r = m.normalizeImagesPayload([{ ...good, createdAt: undefined }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.images[0].createdAt).toBe("number");
  });

  it.each([["字符串"], [NaN], [Infinity]])("createdAt 为 %s 时补当前时间", (bad) => {
    const r = m.normalizeImagesPayload([{ ...good, createdAt: bad }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Number.isFinite(r.images[0].createdAt)).toBe(true);
  });

  it.each([
    ["对象", {}],
    ["字符串", "x"],
    ["数字", 1],
    ["null", null],
    ["undefined", undefined],
  ])("顶层是 %s 时报错", (_label, value) => {
    const r = m.normalizeImagesPayload(value);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("必须是数组");
  });

  it.each([
    ["null", null],
    ["字符串", "x"],
    ["数字", 1],
    ["数组", []],
  ])("元素是 %s 时报错并带下标", (_label, item) => {
    const r = m.normalizeImagesPayload([item]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("images[0]");
  });

  it.each(["id", "prompt", "model", "url"])("缺少 %s 字段时报错", (field) => {
    const bad: Record<string, unknown> = { ...good };
    delete bad[field];
    const r = m.normalizeImagesPayload([bad]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(field);
  });

  it.each(["id", "prompt", "model", "url"])("%s 类型不对时报错", (field) => {
    const r = m.normalizeImagesPayload([{ ...good, [field]: 123 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("必须是字符串");
  });

  it("url 为空串时报错", () => {
    const r = m.normalizeImagesPayload([{ ...good, url: "" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("不能为空");
  });

  it("原型链上的键不算自有字段，照样被拒", () => {
    const bad = Object.create({ id: "x", prompt: "p", model: "m", url: "u" }) as object;
    const r = m.normalizeImagesPayload([bad]);
    expect(r.ok).toBe(false);
  });

  it("超过体积上限时报错并带出实际体积", () => {
    const r = m.normalizeImagesPayload([
      { ...good, url: base64Uri(m.MAX_IMAGE_BYTES + 1024) },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("超过上限");
      expect(r.error).toContain("16MB");
    }
  });

  it("正好等于上限时放行", () => {
    const r = m.normalizeImagesPayload([{ ...good, url: base64Uri(m.MAX_IMAGE_BYTES) }]);
    expect(r.ok).toBe(true);
  });

  it("报错时指出出问题的下标", () => {
    const r = m.normalizeImagesPayload([good, good, { ...good, id: 1 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("images[2]");
  });

  it("多余字段被剥掉，只保留白名单字段", () => {
    const r = m.normalizeImagesPayload([{ ...good, evil: "<script>" }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.images[0]).not.toHaveProperty("evil");
  });
});

describe("常量约定", () => {
  it("内联阈值 256KB、硬上限 16MB", () => {
    expect(m.INLINE_IMAGE_LIMIT).toBe(256 * 1024);
    expect(m.MAX_IMAGE_BYTES).toBe(16 * 1024 * 1024);
  });

  it("URL 前缀与读图路由保持一致", () => {
    expect(m.IMAGE_URL_PREFIX).toBe("/api/files/images/");
  });

  it("图片目录跟着 OC_DATA_DIR 走，测试不会碰到开发库目录", () => {
    expect(m.imagesDir()).toBe(path.join(tempDir, "images"));
  });
});