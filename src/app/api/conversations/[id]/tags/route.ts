import { repo, tagRepo } from "@/lib/db/repo";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 会话与标签的关联（DB13）。
 * GET 返回该会话绑定的标签
 * PUT { tagIds: string[] } 覆盖式绑定
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!repo.getConversation(params.id)) {
    return Response.json({ error: "不存在" }, { status: 404 });
  }
  return Response.json({ tags: tagRepo.getConversationTags(params.id) });
}

export const PUT = withRoute(
  async (req: Request, { params }: { params: { id: string } }) => {
    if (!repo.getConversation(params.id)) {
      return Response.json({ error: "不存在" }, { status: 404 });
    }
    const body = await readJsonBody<{ tagIds?: string[] }>(req);
    if (!body) return badJsonResponse();
    const tagIds = Array.isArray(body.tagIds) ? body.tagIds.filter((x) => typeof x === "string") : [];
    tagRepo.setConversationTags(params.id, tagIds);
    return Response.json({ ok: true, tags: tagRepo.getConversationTags(params.id) });
  }
);