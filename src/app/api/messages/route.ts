import { repo } from "@/lib/db/repo";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 新增一条消息（流式结束后保存最终内容） */
export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<{
    id?: string;
    conversationId?: string;
    role?: string;
    content?: string;
    error?: boolean;
  }>(req);
  if (!body) return badJsonResponse();
  if (!body.id || !body.conversationId || !body.role || body.content === undefined) {
    return Response.json({ error: "参数不完整" }, { status: 400 });
  }
  repo.insertMessage({
    id: body.id,
    conversationId: body.conversationId,
    role: body.role,
    content: body.content,
    error: body.error ?? false,
  });
  return Response.json({ ok: true });
});

/** 覆盖已有消息内容（「重新生成」用：同一条消息就地更新，不新增历史版本） */
export const PATCH = withRoute(async (req: Request) => {
  const body = await readJsonBody<{ id?: string; content?: string; error?: boolean }>(req);
  if (!body) return badJsonResponse();
  if (!body.id || body.content === undefined) {
    return Response.json({ error: "参数不完整" }, { status: 400 });
  }
  repo.updateMessage(body.id, body.content, body.error ?? false);
  return Response.json({ ok: true });
});

/** 删除单条消息（「编辑后重发」移除被替换的对话片段） */
export const DELETE = withRoute(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "参数不完整" }, { status: 400 });
  }
  repo.deleteMessage(id);
  return Response.json({ ok: true });
});
