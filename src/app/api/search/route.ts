import { repo } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 全文搜索（DB9/DB10）：检索消息正文，返回命中片段与所属会话。
 * ?q=关键词&limit=20
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(100, Math.floor(limitParam)) : 20;

  if (!q) return Response.json({ hits: [] });

  const hits = repo.searchMessages(q, limit);
  return Response.json({ hits });
}