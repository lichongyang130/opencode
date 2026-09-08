import { readFile, stat } from "node:fs/promises";
import { contentTypeOf, resolveImageFile } from "@/lib/db/image-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 读取转存到数据目录的绘图产物（R13）。
 *
 * 只接受 `image-store` 白名单正则校验过的文件名，因此不存在路径穿越：
 * 任何带 `/`、`..` 或非法后缀的请求都会在 resolveImageFile 里直接判死。
 */
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const file = resolveImageFile(params.name);
  if (!file) return new Response("非法的文件名", { status: 400 });

  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("不存在", { status: 404 });
    const bytes = await readFile(file);
    return new Response(bytes, {
      headers: {
        "Content-Type": contentTypeOf(params.name),
        "Content-Length": String(info.size),
        // 文件名带唯一 id，内容永不变，可放心长缓存
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("不存在", { status: 404 });
  }
}