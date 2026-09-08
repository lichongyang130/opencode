import { repo } from "@/lib/db/repo";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 数据库维护入口（DB16）：手动「压缩数据库」。
 * VACUUM 重建文件消除删除留下的空洞，wal_checkpoint(TRUNCATE) 把 WAL
 * 合并回主文件并截断，两者配合才真正回收磁盘。POST 幂等，随时可调。
 */
export const POST = withRoute(async () => {
  try {
    repo.vacuum();
    return Response.json({ ok: true, compactedAt: Date.now() });
  } catch (err) {
    return Response.json(
      { error: `压缩失败：${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
});