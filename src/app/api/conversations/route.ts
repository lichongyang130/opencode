import { repo, conversationPageCursor } from "@/lib/db/repo";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 列出会话（不含消息，用于侧栏）。
 * ?archived=0（默认，活跃） | 1（归档） | all（全部）
 * ?limit=&cursor= 游标分页（DB2），响应带 nextCursor 供无限滚动续拉。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const archivedParam = url.searchParams.get("archived");
  const filter = archivedParam === "1" ? 1 : archivedParam === "all" ? undefined : 0;

  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;

  const conversations = repo.listConversations(filter, limit !== undefined ? { limit, cursor } : undefined);
  const nextCursor =
    limit !== undefined ? conversationPageCursor(conversations, limit) : null;

  return Response.json({ conversations, ...(nextCursor ? { nextCursor } : {}) });
}

/** 创建会话 */
export const POST = withRoute(async (req: Request) => {
  // 畸形请求体此前会被当成空对象，报出误导性的「缺少 id」；改为明确的 400
  const body = await readJsonBody<{
    id?: string;
    title?: string;
    mode?: string;
    model?: string;
  }>(req);
  if (!body) return badJsonResponse();
  if (!body.id) {
    return Response.json({ error: "缺少 id" }, { status: 400 });
  }
  repo.upsertConversation({
    id: body.id,
    title: body.title ?? "新任务",
    mode: body.mode ?? "chat",
    model: body.model ?? "demo",
  });
  return Response.json({ ok: true });
});
