import { folderRepo } from "@/lib/db/repo";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 文件夹分组（DB14）：
 * GET    列出全部文件夹
 * POST   新建文件夹 { name }
 * PATCH  重命名 { id, name }
 * DELETE 删除文件夹 ?id=（其中会话回到未分组）
 */
export const GET = withRoute(async () => {
  return Response.json({ folders: folderRepo.listFolders() });
});

export const POST = withRoute(async (req: Request) => {
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "name 不能为空" }, { status: 400 });
  if (name.length > 50) return Response.json({ error: "name 过长（≤50）" }, { status: 400 });
  return Response.json(folderRepo.createFolder(name));
});

export const PATCH = withRoute(async (req: Request) => {
  const body = (await req.json().catch(() => null)) as { id?: unknown; name?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!id || !name) return Response.json({ error: "id 与 name 均不能为空" }, { status: 400 });
  const existing = folderRepo.listFolders().find((f) => f.id === id);
  if (!existing) return Response.json({ error: "文件夹不存在" }, { status: 404 });
  folderRepo.renameFolder(id, name);
  return Response.json({ ok: true });
});

export const DELETE = withRoute(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!id) return Response.json({ error: "id 不能为空" }, { status: 400 });
  const existing = folderRepo.listFolders().find((f) => f.id === id);
  if (!existing) return Response.json({ error: "文件夹不存在" }, { status: 404 });
  folderRepo.deleteFolder(id);
  return Response.json({ ok: true });
});