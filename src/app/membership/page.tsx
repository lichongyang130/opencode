"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Check,
  Cloud,
  Copy,
  Cpu,
  FileText,
  Gauge,
  Gift,
  Loader2,
  Minus,
  Sparkles,
  Zap,
} from "lucide-react";
import { ShellSidebar } from "@/components/mockup/ShellSidebar";
import { UsageDashboard } from "@/components/membership/UsageDashboard";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";
import { readRaw, writeRaw } from "@/lib/safe-storage";

type Plan = "free" | "pro" | "team";

interface Membership {
  id: string;
  plan: Plan;
  autoRenew: boolean;
  renewAt: number | null;
  createdAt: number;
  updatedAt: number;
}
interface Order {
  id: string;
  plan: Plan;
  amount: number;
  status: "paid" | "pending" | "cancelled";
  createdAt: number;
}
interface Stats {
  conversations: number;
  messages: number;
  exports: number;
}

const PLAN_LABEL: Record<Plan, string> = { free: "免费版", pro: "专业版", team: "团队版" };
const PLAN_AMOUNT: Record<Plan, number> = { free: 0, pro: 39, team: 99 };

const PLANS: Array<{ id: Plan; name: string; price: string; period: string; highlight: boolean; features: string[] }> = [
  {
    id: "free",
    name: "免费版",
    price: "¥0",
    period: "永久免费",
    highlight: false,
    features: ["每日 10 次对话", "基础模型", "文档 / PPT 导出带水印", "社区支持"],
  },
  {
    id: "pro",
    name: "专业版",
    price: "¥39",
    period: "每月",
    highlight: true,
    features: ["无限对话", "全部高级模型", "文档 / PPT 无水印导出", "深度思考 + 联网搜索", "优先体验新功能"],
  },
  {
    id: "team",
    name: "团队版",
    price: "¥99",
    period: "每月 / 席位",
    highlight: false,
    features: ["包含专业版全部权益", "团队成员协作", "共享知识库", "统一账单与权限管理"],
  },
];

const FEATURES = [
  { icon: Cpu, color: "from-orange-400 to-red-500", title: "解锁全部模型", desc: "OpenAI / Claude / DeepSeek / 通义 随心切换" },
  { icon: Gauge, color: "from-violet-400 to-purple-500", title: "深度思考", desc: "复杂推理任务获得更高质量回答" },
  { icon: Zap, color: "from-sky-400 to-blue-500", title: "联网搜索", desc: "检索互联网最新信息，答案更实时" },
  { icon: FileText, color: "from-emerald-400 to-teal-500", title: "无水印导出", desc: "文档 / PPT / 报告导出更专业" },
  { icon: Cloud, color: "from-pink-400 to-rose-500", title: "云同步", desc: "多设备同步会话与知识库" },
  { icon: Bot, color: "from-amber-400 to-orange-500", title: "智能体生态", desc: "使用全部进阶智能体与工具" },
];

/** 套餐对比表：string 直接展示；true=包含（✓），false=不包含（—） */
const COMPARE_ROWS: Array<{ label: string; free: string | boolean; pro: string | boolean; team: string | boolean }> = [
  { label: "每日对话次数", free: "10 次", pro: "不限量", team: "不限量" },
  { label: "对话模型", free: "演示模型", pro: "全部高级模型", team: "全部高级模型" },
  { label: "深度思考 / 联网搜索", free: false, pro: true, team: true },
  { label: "文档 / PPT 导出", free: "带水印", pro: "无水印", team: "无水印" },
  { label: "知识库数量", free: "3 个", pro: "不限量", team: "不限量 + 团队共享" },
  { label: "进阶智能体与工具", free: "基础工具", pro: "全部解锁", team: "全部解锁" },
  { label: "支持渠道", free: "社区", pro: "优先工单", team: "专属客户成功" },
];

function CompareCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-emerald-500" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-stone-300" />;
  return <span className="text-[12.5px] text-stone-600">{value}</span>;
}

function fmtDate(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("zh-CN");
}

export default function MembershipPage() {
  const router = useRouter();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/membership");
      const data = (await res.json()) as { membership: Membership; stats: Stats; orders: Order[] };
      setMembership(data.membership);
      setStats(data.stats);
      setOrders(data.orders);
    } catch {
      toast("加载会员数据失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upgrade = async (plan: Plan) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "操作失败");
      toast(`已购买 ${PLAN_LABEL[plan]}，订单已生成`, "success");
      await refresh();
    } catch (e) {
      toast(`操作失败：${e instanceof Error ? e.message : ""}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const cancelRenew = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/membership", { method: "DELETE" });
      if (!res.ok) throw new Error("取消失败");
      toast("已关闭自动续费", "info");
      await refresh();
    } catch (e) {
      toast(`操作失败：${e instanceof Error ? e.message : ""}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const plan = membership?.plan ?? "pro";
  const currentPlan = PLANS.find((p) => p.id === plan)!;
  const upgradeTarget: Plan = plan === "free" ? "pro" : plan === "pro" ? "team" : "pro";

  /* 今日用量（免费版展示额度进度条；专业/团队不限量） */
  const [todayCount, setTodayCount] = useState(0);
  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(
        (d: { conversations?: Array<{ updatedAt?: number; archived?: boolean; messages?: unknown[] }> }) => {
          const today = new Date().toDateString();
          const n = (d.conversations ?? []).filter(
            (c) => !c.archived && c.updatedAt && new Date(c.updatedAt).toDateString() === today,
          ).length;
          setTodayCount(n);
        },
      )
      .catch(() => {});
  }, []);

  /* 邀请返佣：本机生成稳定邀请码 */
  const [refCode, setRefCode] = useState("");
  useEffect(() => {
    let code = readRaw("oc:referral.v1");
    if (!code) {
      code = `OC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      writeRaw("oc:referral.v1", code);
    }
    setRefCode(code);
  }, []);

  const copyRefLink = async () => {
    const link = `${window.location.origin}/?ref=${refCode}`;
    await navigator.clipboard?.writeText(link).catch(() => {});
    toast("邀请链接已复制", "success");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fdfaf6] text-stone-800">
      <ShellSidebar active="membership" />

      {/* 主区域 */}
      <main className="relative flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,183,148,0.18),rgba(244,114,182,0.07)_55%,transparent_100%)]" />

        <div className="relative z-10 mx-auto max-w-[860px] px-6 pb-16 pt-10 sm:px-8">
          {/* 会员头 */}
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-orange-500">
                <Sparkles className="h-3.5 w-3.5" />
                会员中心
              </div>
              <h1 className="mt-2 text-[26px] font-bold tracking-tight text-stone-900">开启你的专业创作体验</h1>
              <p className="mt-1.5 text-[14px] text-stone-500">解锁全部模型能力、无水印导出与更快的创作速度</p>
            </div>
          </div>

          {/* 当前套餐卡 */}
          <div className="mt-8 overflow-hidden rounded-3xl border border-orange-200/80 bg-gradient-to-r from-orange-50 via-amber-50/70 to-white shadow-[0_10px_40px_rgba(249,115,22,0.12)]">
            <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <Image
                  src="/avatar.png"
                  alt="Alex Chen"
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-2xl border-2 border-white object-cover shadow"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-semibold text-stone-800">Alex Chen</span>
                    <button
                      onClick={() => void upgrade(plan === "free" ? "pro" : plan)}
                      title={plan === "free" ? "升级专业版" : "点击续费 / 升级"}
                      className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600"
                    >
                      <BadgeCheck className="h-3 w-3" /> {PLAN_LABEL[plan]}
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-stone-500">
                    到期：{fmtDate(membership?.renewAt ?? null)} · {membership?.autoRenew ? "自动续费" : "已关闭自动续费"}
                    {membership?.autoRenew && (
                      <button
                        onClick={() => void cancelRenew()}
                        disabled={busy}
                        className="text-[11px] text-orange-500 transition hover:text-orange-600 disabled:opacity-40"
                      >
                        关闭
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void upgrade(upgradeTarget)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-orange-200 transition hover:brightness-105 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {plan === "pro" ? "续费专业版" : plan === "free" ? "升级专业版" : "续费团队版"}
                </button>
                <button
                  onClick={() => router.push("/chat")}
                  className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-600 transition hover:bg-orange-50"
                >
                  继续创作
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-orange-100 border-t border-orange-100 bg-white/60">
              {[
                { label: "当前套餐", value: PLAN_LABEL[plan], note: plan === "free" ? "每日限额" : "不限量" },
                { label: "对话消息", value: stats ? `${stats.messages.toLocaleString()} 条` : "—", note: "累计" },
                { label: "已导出文档", value: stats ? `${stats.exports} 份` : "—", note: plan === "free" ? "带水印" : "无水印" },
              ].map((s) => (
                <div key={s.label} className="px-4 py-3.5 text-center">
                  <div className="text-[15px] font-semibold text-stone-800">{s.value}</div>
                  <div className="mt-0.5 text-[11px] text-stone-400">{s.label}</div>
                  <div className="mt-0.5 text-[10px] text-orange-500">{s.note}</div>
                </div>
              ))}
            </div>
            {/* 免费版今日额度进度 */}
            {plan === "free" && (
              <div className="border-t border-orange-100 bg-white/60 px-6 py-3">
                <div className="flex items-center justify-between text-[11.5px] text-stone-500">
                  <span>今日对话额度</span>
                  <span className={todayCount >= 10 ? "font-medium text-red-500" : ""}>
                    {Math.min(todayCount, 10)} / 10 次
                    {todayCount >= 10 && " · 已达上限，升级专业版不限量"}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      todayCount >= 10 ? "bg-red-400" : "bg-orange-400",
                    )}
                    style={{ width: `${Math.min(100, (todayCount / 10) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 用量看板（AI10） */}
          <div className="mt-10">
            <UsageDashboard />
          </div>

          {/* 权益 */}
          <div className="mt-10">
            <h2 className="text-[16px] font-semibold text-stone-800">专业权益</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm", f.color)}>
                    <f.icon className="h-4 w-4" />
                  </span>
                  <div className="mt-3 text-[13.5px] font-semibold text-stone-800">{f.title}</div>
                  <div className="mt-1 text-[11.5px] leading-relaxed text-stone-400">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 套餐 */}
          <div className="mt-10">
            <h2 className="text-[16px] font-semibold text-stone-800">选择你的方案</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {PLANS.map((p) => {
                const isCurrent = plan === p.id;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm",
                      p.highlight ? "border-orange-300 shadow-lg shadow-orange-100" : "border-stone-200/80"
                    )}
                  >
                    {p.highlight && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2.5 py-0.5 text-[10px] font-medium text-white shadow">
                        最受欢迎
                      </span>
                    )}
                    <div className="text-[13px] font-medium text-stone-500">{p.name}</div>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="text-[28px] font-bold text-stone-900">{p.price}</span>
                      <span className="mb-1 text-[11px] text-stone-400">{p.period}</span>
                    </div>
                    <ul className="mt-4 flex-1 space-y-2">
                      {p.features.map((ft) => (
                        <li key={ft} className="flex items-center gap-2 text-[12.5px] text-stone-600">
                          <Check className={cn("h-3.5 w-3.5 shrink-0", p.highlight ? "text-orange-500" : "text-stone-300")} />
                          {ft}
                        </li>
                      ))}
                    </ul>
                    <button
                      disabled={isCurrent || busy}
                      onClick={() => void upgrade(p.id as Plan)}
                      className={cn(
                        "mt-5 rounded-xl px-4 py-2.5 text-[12.5px] font-medium transition",
                        p.highlight
                          ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-200 hover:brightness-105"
                          : "border border-stone-200 bg-white text-stone-600 hover:border-orange-300 hover:text-orange-600",
                        isCurrent && "cursor-default bg-stone-100 text-stone-400"
                      )}
                    >
                      {isCurrent ? "当前方案" : `升级 ${p.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 邀请返佣 */}
          <div className="mt-10">
            <h2 className="text-[16px] font-semibold text-stone-800">邀请返佣</h2>
            <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border border-stone-200/80 bg-gradient-to-r from-amber-50 via-orange-50/60 to-white p-5 shadow-sm sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
                  <Gift className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-stone-800">
                    每邀请 1 位好友开通专业版，获得 <span className="text-orange-600">20% 返佣</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-stone-400">
                    你的专属邀请码：<span className="font-mono font-medium text-stone-700">{refCode || "…"}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => void copyRefLink()}
                disabled={!refCode}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-[13px] font-medium text-white shadow-md shadow-orange-200 transition hover:brightness-105 disabled:opacity-60"
              >
                <Copy className="h-4 w-4" /> 复制邀请链接
              </button>
            </div>
          </div>

          {/* 套餐对比 */}
          <div className="mt-10">
            <h2 className="text-[16px] font-semibold text-stone-800">套餐对比</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/70 text-[11.5px] text-stone-400">
                      <th className="px-4 py-3 font-medium">功能</th>
                      {PLANS.map((p) => (
                        <th
                          key={p.id}
                          className={cn(
                            "w-[150px] px-4 py-3 text-center font-medium",
                            p.id === plan && "bg-orange-50/70 text-[#c05f3c]",
                          )}
                        >
                          <span className="inline-flex items-center gap-1">
                            {p.name}
                            {p.id === plan && (
                              <span className="rounded-full bg-orange-500 px-1.5 py-px text-[9.5px] font-medium text-white">
                                当前
                              </span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((row) => (
                      <tr key={row.label} className="border-b border-stone-50 last:border-0">
                        <td className="px-4 py-3 font-medium text-stone-700">{row.label}</td>
                        {(["free", "pro", "team"] as Plan[]).map((pid) => (
                          <td
                            key={pid}
                            className={cn(
                              "px-4 py-3 text-center",
                              pid === plan && "bg-orange-50/50",
                            )}
                          >
                            <CompareCell value={row[pid]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 订单记录 */}
          <div className="mt-10">
            <h2 className="text-[16px] font-semibold text-stone-800">订单记录</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
              {orders.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] text-stone-400">
                  {loading ? "加载中…" : "暂无订单"}
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-stone-800">{PLAN_LABEL[o.plan]}</div>
                        <div className="mt-0.5 truncate text-[11px] text-stone-400">
                          订单 {o.id.slice(0, 8)} · {fmtDate(o.createdAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[13px] font-semibold text-stone-700">¥{o.amount}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            o.status === "paid" && "bg-emerald-50 text-emerald-600",
                            o.status === "pending" && "bg-amber-50 text-amber-600",
                            o.status === "cancelled" && "bg-stone-100 text-stone-400"
                          )}
                        >
                          {o.status === "paid" ? "已支付" : o.status === "pending" ? "待支付" : "已取消"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="mt-10 text-center text-[11px] text-stone-400">
            订单与会员数据已接入本地数据库，实际支付渠道将在上线时接入。
          </p>
        </div>
      </main>
    </div>
  );
}
