import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./sqlite";

/**
 * 图片落盘（R13）。
 *
 * 绘图产物原先整条 data URI 塞进 conversations.images 的 JSON 列里：
 * DALL·E 的 base64 PNG 一张就有 2~3 MB，几十张之后单行记录膨胀到上百兆，
 * 而侧栏列表（listConversations）是 `SELECT *`，每次刷新都要把这些二进制
 * 连同标题一起读出来再 JSON.parse，界面直接卡死。
 *
 * 所以：小图（SVG 占位图之类）继续内联，超过阈值的转存到数据目录，
 * 库里只留一条 `/api/files/images/xxx.png` 的相对路径。
 */

/** 超过这个体积就转存文件；演示用的 SVG 占位图只有几 KB，仍走内联 */
export const INLINE_IMAGE_LIMIT = 256 * 1024;

/** 单张图片的硬上限：超过直接判定为畸形输入，由路由层回 400 */
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;

/** 落盘图片的访问前缀，与 app/api/files/images/[name] 路由一致 */
export const IMAGE_URL_PREFIX = "/api/files/images/";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
};

/** 文件名只允许这一种形态，从根上排除 `../` 穿越与绝对路径 */
const SAFE_NAME = /^[A-Za-z0-9_-]+\.(png|jpg|webp|gif|svg|avif)$/;

export function imagesDir(): string {
  return path.join(dataDir(), "images");
}

interface DecodedDataUri {
  bytes: Buffer;
  ext: string;
}

/**
 * 解析 data URI。
 * 兼容两种编码：`;base64,` 与直接 percent-encoding（演示绘图的 SVG 用后者）。
 * 不是 data URI 或解析失败都返回 null，交给调用方按「原样保留」处理。
 */
export function decodeDataUri(url: string): DecodedDataUri | null {
  if (!url.startsWith("data:")) return null;
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  const meta = url.slice(5, comma);
  const payload = url.slice(comma + 1);
  const isBase64 = /;base64$/i.test(meta);
  const mime = meta.replace(/;.*$/, "").toLowerCase() || "image/png";
  try {
    const bytes = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    if (bytes.length === 0) return null;
    return { bytes, ext: MIME_EXT[mime] ?? "png" };
  } catch {
    return null;
  }
}

/** data URI 的解码后体积；非 data URI 返回 0（外链不占库） */
export function dataUriByteLength(url: string): number {
  return decodeDataUri(url)?.bytes.length ?? 0;
}

/** 落盘文件名对应的绝对路径；名字不合规返回 null */
export function resolveImageFile(name: string): string | null {
  if (!SAFE_NAME.test(name)) return null;
  const dir = imagesDir();
  const full = path.join(dir, name);
  // 正则已经挡住了穿越，这里再确认一次落点仍在目录内，避免日后放宽正则时留坑
  if (path.dirname(full) !== dir) return null;
  return full;
}

export function contentTypeOf(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return EXT_MIME[ext] ?? "application/octet-stream";
}

/**
 * 把超过阈值的内联图片转存到磁盘，返回替换过 url 的新数组。
 *
 * 落盘失败（磁盘满 / 只读挂载）时保留原始 data URI：
 * 存进库里只是慢，丢掉用户刚生成的图才是真正的数据损失。
 */
export function externalizeImages<T extends { id: string; url: string }>(images: T[]): T[] {
  if (!Array.isArray(images) || images.length === 0) return images;
  let dirReady = false;
  return images.map((img) => {
    if (typeof img?.url !== "string" || !img.url.startsWith("data:")) return img;
    const decoded = decodeDataUri(img.url);
    if (!decoded || decoded.bytes.length <= INLINE_IMAGE_LIMIT) return img;

    // 文件名只用 id 的安全字符，避免 nextId() 之外的来源（导入的备份）带进奇怪字符
    const safeId = String(img.id).replace(/[^A-Za-z0-9_-]/g, "") || `img-${Date.now()}`;
    const name = `${safeId}.${decoded.ext}`;
    try {
      if (!dirReady) {
        mkdirSync(imagesDir(), { recursive: true });
        dirReady = true;
      }
      writeFileSync(path.join(imagesDir(), name), decoded.bytes);
      return { ...img, url: `${IMAGE_URL_PREFIX}${name}` };
    } catch (err) {
      console.error(`[images] 转存失败，退回内联存储：${name}`, err);
      return img;
    }
  });
}

/** 删除会话时顺手清掉它转存过的图片文件，否则磁盘只增不减 */
export function removeExternalImages(images: { url?: unknown }[]): void {
  for (const img of images) {
    const url = typeof img?.url === "string" ? img.url : "";
    if (!url.startsWith(IMAGE_URL_PREFIX)) continue;
    const file = resolveImageFile(url.slice(IMAGE_URL_PREFIX.length));
    if (!file) continue;
    try {
      rmSync(file, { force: true });
    } catch {
      /* 清理是尽力而为：删不掉也不该阻塞会话删除 */
    }
  }
}

export interface ImagePayload {
  id: string;
  prompt: string;
  model: string;
  url: string;
  createdAt: number;
}

/**
 * 校验来自 HTTP 的 images 字段（R13 的「入库前体积校验」）。
 *
 * 之前 PATCH /api/conversations/[id] 把 body.images 直接 `as never` 塞给 repo：
 * 客户端传个字符串就能把整列写成非法 JSON，传一张 100MB 的 base64 也照收不误。
 * 这里把畸形输入与超限体积都归到 400，绝不让它变成 500 或撑爆数据库。
 */
export function normalizeImagesPayload(
  value: unknown
): { ok: true; images: ImagePayload[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: "images 必须是数组" };
  const images: ImagePayload[] = [];
  for (const [i, raw] of value.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: `images[${i}] 必须是对象` };
    }
    const item = raw as Record<string, unknown>;
    for (const field of ["id", "prompt", "model", "url"]) {
      // 必须查自有属性：`Object.create({url:"x"})` 这类原型链取值也能让 typeof 过关，
      // 等于把校验绕过去（其它路由已统一按「原型链键一律 4xx」处理）
      if (!Object.prototype.hasOwnProperty.call(item, field) || typeof item[field] !== "string") {
        return { ok: false, error: `images[${i}].${field} 必须是字符串` };
      }
    }
    const url = item.url as string;
    if (!url) return { ok: false, error: `images[${i}].url 不能为空` };
    const size = dataUriByteLength(url);
    if (size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        error: `images[${i}] 体积 ${Math.round(size / 1024 / 1024)}MB 超过上限 ${MAX_IMAGE_BYTES / 1024 / 1024}MB`,
      };
    }
    const createdAt = item.createdAt;
    images.push({
      id: item.id as string,
      prompt: item.prompt as string,
      model: item.model as string,
      url,
      createdAt: typeof createdAt === "number" && Number.isFinite(createdAt) ? createdAt : Date.now(),
    });
  }
  return { ok: true, images };
}
