import { tagRepo } from "@/lib/db/repo";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 标签体系（DB13）。
 * GET 列出全部标签
 * POST { name, color? } 新建标签
 * DELETE ?id= 删除标签（解除所有会话关联）
 */
export async function GET() {
  return Response.json({ tags: tagRepo.listTags() });
}

export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<{ name?: string; color?: string }>(req);
  if (!body) return badJsonResponse();
  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ error: "标签名不能为空" }, { status: 400 });
  const tag = tagRepo.createTag(name, body.color ?? null);
  return Response.json({ ok: true, tag });
});

export const DELETE = withRoute(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });
  tagRepo.deleteTag(id);
  return Response.json({ ok: true });
});