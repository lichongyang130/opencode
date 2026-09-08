import { repo } from "@/lib/db/repo";
import { normalizeImagesPayload, type ImagePayload } from "@/lib/db/image-store";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 取单个会话 + 消息（DB4：?limit= 只拉最近 N 条，?before= 向上补拉更早历史） */
export const GET = withRoute(
  async (req: Request, { params }: { params: { id: string } } = { params: { id: "" } }) => {
    const convo = repo.getConversation(params.id);
    if (!convo) return Response.json({ error: "不存在" }, { status: 404 });
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") ?? "");
    const beforeParam = Number(url.searchParams.get("before") ?? "");
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(500, Math.floor(limitParam)) : undefined;
    // before 传最早一条消息的 createdAt（毫秒），拉严格早于它的历史
    const before = Number.isFinite(beforeParam) && beforeParam > 0 ? beforeParam : undefined;
    const messages = repo.getMessages(params.id, limit ? { limit, before } : undefined);
    // hasMore 告诉前端还有更早的历史可以补拉
    const hasMore = limit !== undefined && messages.length === limit;
    return Response.json({ conversation: convo, messages, hasMore: Boolean(hasMore) });
  }
);

/** 更新会话（标题/模式/模型/PPT 产物/归档/置顶） */
export const PATCH = withRoute(
  async (req: Request, { params }: { params: { id: string } } = { params: { id: "" } }) => {
    const body = await readJsonBody<{
      title?: string;
      mode?: string;
      model?: string;
      modelProvider?: string | null;
      deck?: unknown;
      deckStatus?: string | null;
      images?: unknown;
      report?: unknown;
      doc?: unknown;
      personaId?: string | null;
      archived?: boolean;
      pinned?: boolean;
    }>(req);
    if (!body) return badJsonResponse();
    if (!repo.getConversation(params.id)) {
      return Response.json({ error: "不存在" }, { status: 404 });
    }

    // images 是唯一可能夹带巨量二进制的字段，先校验形状与体积再决定要不要落库
    let images: ImagePayload[] | undefined;
    if (body.images !== undefined) {
      const parsed = normalizeImagesPayload(body.images);
      if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
      images = parsed.images;
    }

    // 标记类字段（归档/置顶/重命名）单独处理，避免覆盖
    if (body.archived !== undefined || body.pinned !== undefined || body.title !== undefined) {
      repo.patchFlags(params.id, {
        archived: body.archived,
        pinned: body.pinned,
        title: body.title,
      });
    }

    // 产物类字段
    if (
      body.mode !== undefined ||
      body.model !== undefined ||
      body.modelProvider !== undefined ||
      body.deck !== undefined ||
      body.deckStatus !== undefined ||
      body.images !== undefined ||
      body.report !== undefined ||
      body.doc !== undefined ||
      body.personaId !== undefined
    ) {
      repo.upsertConversation({
        id: params.id,
        mode: body.mode,
        model: body.model,
        modelProvider: body.modelProvider,
        deck: body.deck,
        deckStatus: body.deckStatus,
        images,
        report: body.report,
        doc: body.doc,
        personaId: body.personaId,
      });
    }
    return Response.json({ ok: true });
  }
);

/** 删除会话（级联删消息） */
export const DELETE = withRoute(
  async (_req: Request, { params }: { params: { id: string } } = { params: { id: "" } }) => {
    repo.deleteConversation(params.id);
    return Response.json({ ok: true });
  }
);
