/**
 * 图像 MIME 与扩展名推断（IMG9）。
 *
 * 此前下载图固定 `.png`，但演示模型产出的是 SVG data URI、万相返回图床外链可能
 * 是 jpg/webp，全按 PNG 下载名字对不上内容、打开还可能被系统误判。这里按真实
 * MIME 推断扩展名，下载名与文件类型保持一致。
 */

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** 从 URL 推断 MIME：data URI 直接解析声明，http(s) 按路径扩展名反查 */
export function mimeFromUrl(url: string): string {
  const data = url.match(/^data:([^;,]+)/);
  if (data) return data[1].toLowerCase();

  const extMatch = url.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
  const ext = extMatch?.[1]?.toLowerCase();
  if (ext) {
    const mime = Object.keys(EXT_BY_MIME).find((m) => EXT_BY_MIME[m] === ext);
    if (mime) return mime;
  }
  // 无法判断时保守按 PNG（数据 URI 最常见的图像格式）
  return "image/png";
}

/** MIME → 扩展名；未知 MIME 回落 png */
export function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime.toLowerCase()] ?? "png";
}

/** 从 URL 直接推断扩展名（下载命名用），未知回落 png */
export function extensionFromUrl(url: string): string {
  return extensionForMime(mimeFromUrl(url));
}

/** 生成下载文件名：安全标题 + 正确扩展名 */
export function downloadImageName(base: string, url: string): string {
  const safe = (base || "image").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "image";
  return `${safe}.${extensionFromUrl(url)}`;
}