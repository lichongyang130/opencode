import { repo } from "@/lib/db/repo";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 批量操作。
 * POST { action: "archive" | "unarchive" | "delete" | "reorder", ids?, entries? }
 *   - reorder（UX3）：按 entries [{id, sortIndex}] 批量写手动排序
 */
export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<{ action?: string; ids?: string[]; entries?: unknown }>(req);
  if (!body) return badJsonResponse();
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  if (!body.action || (ids.length === 0 && body.action !== "reorder")) {
    return Response.json({ error: "参数不完整" }, { status: 400 });
  }

  if (body.action === "archive") repo.setArchivedBatch(ids, true);
  else if (body.action === "unarchive") repo.setArchivedBatch(ids, false);
  else if (body.action === "delete") repo.deleteConversations(ids);
  else if (body.action === "reorder") {
    // 形状校验：[{id: string, sortIndex: number|null}]；非法条目 400 而非静默丢
    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return Response.json({ error: "entries 不能为空" }, { status: 400 });
    }
    const entries: Array<{ id: string; sortIndex: number | null }> = [];
    for (const [i, e] of body.entries.entries()) {
      const rec = e as Record<string, unknown> | null;
      if (!rec || typeof rec.id !== "string" || !rec.id || !("sortIndex" in rec)) {
        return Response.json({ error: `entries[${i}] 形状不合法` }, { status: 400 });
      }
      const si = rec.sortIndex;
      if (si !== null && (typeof si !== "number" || !Number.isInteger(si))) {
        return Response.json({ error: `entries[${i}].sortIndex 必须是整数或 null` }, { status: 400 });
      }
      entries.push({ id: rec.id, sortIndex: si as number | null });
    }
    repo.setSortIndexes(entries);
    return Response.json({ ok: true, count: entries.length });
  } else return Response.json({ error: "未知操作" }, { status: 400 });

  return Response.json({ ok: true, count: ids.length });
});
