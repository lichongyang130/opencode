import { membershipRepo, type MembershipPlan } from "@/lib/db/repo";
import { badJsonResponse, readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_AMOUNT: Record<MembershipPlan, number> = {
  free: 0,
  pro: 39,
  team: 99,
};

/** 读取当前会员、统计数据与订单列表 */
export async function GET() {
  const m = membershipRepo.get();
  return Response.json({
    membership: m,
    stats: membershipRepo.stats(),
    orders: membershipRepo.listOrders(),
  });
}

/** 升级 / 续费：body = { plan } */
export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<{ plan?: MembershipPlan }>(req);
  if (!body) return badJsonResponse();
  const plan = body.plan;
  // in 运算符对 __proto__ 之类的原型链键也会返回 true，改用显式白名单
  if (!plan || !Object.prototype.hasOwnProperty.call(PLAN_AMOUNT, plan)) {
    return Response.json({ error: "未知套餐" }, { status: 400 });
  }
  const amount = PLAN_AMOUNT[plan];
  const result = membershipRepo.upgrade(plan, amount);
  return Response.json({ ok: true, ...result });
});

/** 取消自动续费 */
export const DELETE = withRoute(async () => {
  const membership = membershipRepo.cancelAutoRenew();
  return Response.json({ ok: true, membership });
});
