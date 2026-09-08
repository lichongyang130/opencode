import { usageRepo, creditRepo } from "@/lib/db/repo";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 用量看板（AI10）：按天 × 模型聚合的调用/token/成本，附当前积分余额。
 * GET /api/usage?days=30 —— days 钳到 1-90，畸形输入返回 400。
 */
export const GET = withRoute(async (req: Request) => {
  const url = new URL(req.url);
  const rawDays = url.searchParams.get("days");
  if (rawDays !== null && !/^\d+$/.test(rawDays)) {
    return Response.json({ error: "days 必须是正整数" }, { status: 400 });
  }
  const days = Math.min(90, Math.max(1, Number(rawDays ?? 30)));

  const [stats, balance] = [usageRepo.dailyStats(days), creditRepo.balance()];
  return Response.json({
    days,
    stats: stats.map((s) => ({
      day: s.day,
      model: s.model,
      provider: s.provider,
      calls: s.calls,
      successCalls: s.successCalls,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      costUsd: s.costUsd,
      credits: s.credits,
    })),
    balance,
  });
});