"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 用量看板（AI10）：按天 × 模型聚合的调用量 / token / 成本。
 * 数据来自 GET /api/usage（usageRepo.dailyStats + creditRepo.balance）。
 * 零依赖原则：不引图表库，用纯 div 条形图表现「最近 N 天每日积分消耗」。
 */

interface UsageStat {
  day: string;
  model: string;
  provider: string;
  calls: number;
  successCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  credits: number;
}

interface Balance {
  granted: number;
  reserved: number;
  settled: number;
  available: number;
}

export function UsageDashboard() {
  const [stats, setStats] = useState<UsageStat[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/usage?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`请求失败 ${res.status}`);
        return (await res.json()) as { stats: UsageStat[]; balance: Balance };
      })
      .then((data) => {
        if (!alive) return;
        setStats(data.stats);
        setBalance(data.balance);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [days]);

  // 按天汇总积分（多模型同日合并）+ 找峰值画条形图
  const daily = useMemo(() => {
    if (!stats) return [];
    const map = new Map<string, { credits: number; calls: number }>();
    for (const s of stats) {
      const cur = map.get(s.day) ?? { credits: 0, calls: 0 };
      cur.credits += s.credits;
      cur.calls += s.calls;
      map.set(s.day, cur);
    }
    return [...map.entries()]
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-days);
  }, [stats, days]);

  const maxCredits = Math.max(1, ...daily.map((d) => d.credits));

  // 按模型汇总（表格维度）
  const byModel = useMemo(() => {
    if (!stats) return [];
    const map = new Map<string, UsageStat & { total: number }>();
    for (const s of stats) {
      const cur = map.get(s.model);
      if (cur) {
        cur.calls += s.calls;
        cur.successCalls += s.successCalls;
        cur.inputTokens += s.inputTokens;
        cur.outputTokens += s.outputTokens;
        cur.costUsd += s.costUsd;
        cur.credits += s.credits;
        cur.total += s.calls;
      } else {
        map.set(s.model, { ...s, total: s.calls });
      }
    }
    return [...map.values()].sort((a, b) => b.credits - a.credits);
  }, [stats]);

  const fmtUsd = (n: number) => `$${n.toFixed(n < 0.01 && n > 0 ? 4 : 2)}`;

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-stone-800">用量看板</h2>
          <p className="mt-0.5 text-[11.5px] text-stone-400">模型调用、token 消耗与积分账单</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                "rounded-lg px-3 py-1 text-[12px] font-medium transition",
                days === d ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700",
              )}
            >
              {d === 7 ? "近 7 天" : d === 30 ? "近 30 天" : "近 90 天"}
            </button>
          ))}
        </div>
      </div>

      {balance && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "可用积分", value: balance.available },
            { label: "预扣中", value: balance.reserved },
            { label: "已消耗", value: balance.settled },
            { label: "累计授予", value: balance.granted },
          ].map((b) => (
            <div key={b.label} className="rounded-xl bg-stone-50 px-3 py-2.5">
              <div className="text-[15px] font-semibold text-stone-800">{b.value.toLocaleString()}</div>
              <div className="text-[11px] text-stone-400">{b.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-stone-300">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="py-8 text-center text-[12.5px] text-red-400">⚠️ {error}</div>
      ) : (
        <>
          {/* 每日积分消耗条形图 */}
          <div className="mt-5">
            <div className="text-[12px] font-medium text-stone-500">每日积分消耗</div>
            {daily.length === 0 ? (
              <div className="py-6 text-center text-[12.5px] text-stone-300">
                还没有模型调用记录，去发起一次对话吧
              </div>
            ) : (
              <div className="mt-2 flex h-28 items-end gap-1">
                {daily.map((d) => (
                  <div key={d.day} className="group relative flex-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-orange-200 to-orange-400 transition-all group-hover:from-orange-300 group-hover:to-orange-500"
                      style={{ height: `${Math.max(4, (d.credits / maxCredits) * 100)}%` }}
                    />
                    <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-stone-800 px-2 py-1 text-[10.5px] text-white shadow group-hover:block">
                      {d.day} · {d.credits} 积分 / {d.calls} 次
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 按模型明细 */}
          {byModel.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-stone-100 text-[11px] text-stone-400">
                    <th className="py-2 pr-3 font-medium">模型</th>
                    <th className="py-2 pr-3 font-medium">调用</th>
                    <th className="py-2 pr-3 font-medium">成功率</th>
                    <th className="py-2 pr-3 font-medium">输入 tok</th>
                    <th className="py-2 pr-3 font-medium">输出 tok</th>
                    <th className="py-2 pr-3 font-medium">成本</th>
                    <th className="py-2 font-medium">积分</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((m) => (
                    <tr key={m.model} className="border-b border-stone-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-stone-700">{m.model}</td>
                      <td className="py-2 pr-3 text-stone-500">{m.calls}</td>
                      <td className="py-2 pr-3 text-stone-500">
                        {m.calls === 0 ? "—" : `${Math.round((m.successCalls / m.calls) * 100)}%`}
                      </td>
                      <td className="py-2 pr-3 text-stone-500">{m.inputTokens.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-stone-500">{m.outputTokens.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-stone-500">{fmtUsd(m.costUsd)}</td>
                      <td className="py-2 font-semibold text-orange-600">{m.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}