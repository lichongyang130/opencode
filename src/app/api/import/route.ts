import { repo } from "@/lib/db/repo";
import { BackupConflictError, BackupValidationError } from "@/lib/backup";
import { logger } from "@/lib/logger";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Import a complete v1 export. Existing conversation IDs (including messages) are skipped. */
export const POST = withRoute(async (req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "备份不是有效的 JSON；未导入任何数据" }, { status: 400 });
  }
  try {
    return Response.json({ ok: true, ...repo.importBackup(body) });
  } catch (error) {
    if (error instanceof BackupValidationError) {
      return Response.json({ error: `${error.message}；未导入任何数据` }, { status: 400 });
    }
    if (error instanceof BackupConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    logger.error("备份导入失败", { err: error });
    return Response.json({ error: "备份写入失败，本次导入未保存；请稍后重试" }, { status: 500 });
  }
});
