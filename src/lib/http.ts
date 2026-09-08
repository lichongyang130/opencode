/**
 * API 路由公共请求解析工具。
 *
 * 直接 `await req.json()` 在请求体为空或畸形 JSON 时会抛异常，
 * Next.js 会将其转成 500；对客户端错误应当返回 400。
 */

/** 解析 JSON 请求体；非法 JSON 或非对象时返回 null */
export async function readJsonBody<T>(req: Request): Promise<T | null> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as T;
  } catch {
    return null;
  }
}

/** 请求体非法时的统一响应 */
export function badJsonResponse(): Response {
  return Response.json({ error: "请求体不是有效的 JSON 对象" }, { status: 400 });
}