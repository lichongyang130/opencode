import { repo } from "@/lib/db/repo";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 回收站（DB12）。
 * GET  返回软删除的会话列表
 * POST { action: "restore" | "purge", ids: string[] }
 * DELETE 清理软删除超过 30 天的会话
 */
export async function GET() {
  return Response.json({ conversations: repo.listDeletedConversations() });
}

export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<{ action?: string; ids?: string[] }>(req);
  if (!body) return badJsonResponse();
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  if (ids.length === 0 || !body.action) {
    return Response.json({ error: "参数不完整" }, { status: 400 });
  }
  if (body.action === "restore") {
    repo.restoreConversations(ids);
  } else if (body.action === "purge") {
    repo.purgeConversations(ids);
  } else {
    return Response.json({ error: "未知操作" }, { status: 400 });
  }
  return Response.json({ ok: true, count: ids.length });
});

export const DELETE = withRoute(async () => {
  const purged = repo.purgeExpiredConversations(30 * 24 * 60 * 60 * 1000);
  return Response.json({ ok: true, purged });
});