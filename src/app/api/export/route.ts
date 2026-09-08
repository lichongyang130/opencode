import { repo } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 导出全部数据（会话 + 消息）为 JSON 备份 */
export async function GET() {
  const conversations = repo.listConversations(undefined).map((c) => ({
    ...c,
    messages: repo.getMessages(c.id),
  }));
  const payload = {
    app: "opencanvas",
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="opencanvas-backup-${Date.now()}.json"`,
    },
  });
}
