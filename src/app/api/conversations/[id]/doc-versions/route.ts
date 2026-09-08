import { repo, docVersionRepo, DOC_VERSION_CAP } from "@/lib/db/repo";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isDocShape = (v: unknown): v is { title: string; content: string } => {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  return typeof d.title === "string" && typeof d.content === "string";
};

/** DOC5: 某会话的文档版本列表（新→旧）。软删除中的会话照样能看，恢复后历史仍在 */
export const GET = withRoute(
  async (_req: Request, { params }: { params: { id: string } } = { params: { id: "" } }) => {
    // 拉满封顶数：前端版本抽屉要展示完整历史（save 已保证不会超过封顶）
    const versions = docVersionRepo.list(params.id, DOC_VERSION_CAP);
    return Response.json({ versions });
  }
);

/** 存一份快照。节流由前端控制（30 分钟窗口），这里只做形状与大小校验 */
export const POST = withRoute(
  async (req: Request, { params }: { params: { id: string } } = { params: { id: "" } }) => {
    // 形状校验先于存在性校验：畸形请求体必须一律 400（与全路由畸形清单约定一致），
    // 不能因为会话不存在漏成 404
    const body = await readJsonBody<{ doc?: unknown }>(req);
    if (!body) return badJsonResponse();
    if (!isDocShape(body.doc)) {
      return Response.json({ error: "doc 必须含 title 与 content 字符串" }, { status: 400 });
    }
    if (!repo.getConversation(params.id)) {
      return Response.json({ error: "会话不存在" }, { status: 404 });
    }
    // 与 images 体积防护同思路：超长内容直接拒绝，防超大 payload 打爆 SQLite
    if (body.doc.content.length > 2_000_000) {
      return Response.json({ error: "文档内容过长" }, { status: 400 });
    }
    const id = docVersionRepo.save({
      conversationId: params.id,
      title: body.doc.title,
      content: body.doc.content,
    });
    return Response.json({ ok: true, id });
  }
);