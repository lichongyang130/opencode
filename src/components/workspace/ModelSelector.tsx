"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, KeyRound, Loader2, RefreshCw, Search, Sparkles, Zap } from "lucide-react";
import { MODELS, inferProvider } from "@/lib/gateway/models";
import type { ModelInfo, ProviderId as ProviderIdType } from "@/lib/gateway";
import {
  localConfiguredProviders,
  loadDynamicModels,
  saveDynamicModels,
  getOverrides,
} from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/store/chat";
import { ProviderLogo } from "./ProviderLogo";
type ProviderId = ProviderIdType;

interface StatusMap {
  [provider: string]: boolean;
}

const REGION_LABEL: Record<string, string> = {
  global: "海外",
  china: "国内",
  builtin: "内置",
};

const PROVIDER_ORDER: ProviderId[] = ["openai", "anthropic", "deepseek", "dashscope"];
/** UX8: 导出给切换 toast 用 —— 单一事实源，避免两处各自维护供应商名 */
export const PROVIDER_NAME: Record<string, string> = {
  openai: "OpenAI / GPT",
  anthropic: "Anthropic / Claude",
  deepseek: "DeepSeek",
  dashscope: "阿里百炼 / 通义",
  demo: "内置",
};
/** 按钮上显示的简短模型名 */
function shortLabel(label: string) {
  return label
    .replace("（免费）", "")
    .replace(" / GPT", "")
    .replace(" / Claude", "")
    .replace("Chat (V3)", "")
    .replace("(V3)", "")
    .trim();
}

export function ModelSelector({ value, onChange }: { value: string; onChange: (id: string, provider?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StatusMap | null>(null);
  const [local, setLocal] = useState<StatusMap>({ demo: true });
  const [dynamic, setDynamic] = useState<Partial<Record<ProviderId, string[]>>>({});
  const [fetching, setFetching] = useState<ProviderId | null>(null);
  const [fetchError, setFetchError] = useState<string>("");
  const [q, setQ] = useState("");
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const reload = () => {
    setLocal(localConfiguredProviders());
    setDynamic(loadDynamicModels());
  };

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d: { status: StatusMap }) => setStatus(d.status))
      .catch(() => setStatus({}));
    reload();
    const onChanged = () => reload();
    window.addEventListener("opencanvas:settings-changed", onChanged);
    return () => window.removeEventListener("opencanvas:settings-changed", onChanged);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // 可用 = 服务端 env 或 本地密钥
  const providerAvailable = (p: string) =>
    p === "demo" || Boolean(local[p]) || status === null || Boolean(status?.[p]);

  // 合并静态 + 动态模型，按供应商分组
  const groups = useMemo(() => {
    const map = new Map<ProviderId, { info: ModelInfo; dynamic: boolean }[]>();
    const push = (p: ProviderId, info: ModelInfo, dynamic: boolean) => {
      if (!map.has(p)) map.set(p, []);
      const arr = map.get(p)!;
      if (!arr.some((x) => x.info.id === info.id)) arr.push({ info, dynamic });
    };
    for (const m of MODELS) push(m.provider, m, false);
    for (const p of PROVIDER_ORDER) {
      for (const id of dynamic[p] ?? []) {
        if (MODELS.some((m) => m.id === id)) continue;
        push(p, {
          id,
          label: id,
          provider: p,
          providerLabel: PROVIDER_NAME[p],
          region: p === "deepseek" || p === "dashscope" ? "china" : "global",
          capabilities: ["text"],
          inputPricePerMtok: 0.5,
          outputPricePerMtok: 1.5,
        }, true);
      }
    }
    return PROVIDER_ORDER.map((p) => ({ provider: p, items: map.get(p) ?? [] }));
  }, [dynamic]);

  const currentModel =
    MODELS.find((m) => m.id === value) ?? { id: value, label: value, provider: inferProvider(value) ?? "demo" };

  const fetchModels = async (provider: ProviderId) => {
    setFetching(provider);
    setFetchError("");
    try {
      const res = await fetch("/api/models/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, overrides: getOverrides() }),
      });
      const data = (await res.json()) as { models?: string[]; error?: string };
      if (!res.ok || !data.models) throw new Error(data.error ?? "获取失败");
      const next = { ...loadDynamicModels(), [provider]: data.models };
      saveDynamicModels(next);
      setDynamic(next);
    } catch (e) {
      setFetchError(`${PROVIDER_NAME[provider]}：${e instanceof Error ? e.message : "获取失败"}`);
    } finally {
      setFetching(null);
    }
  };

  const short = shortLabel(currentModel.label);
  const online = providerAvailable(currentModel.provider);

  return (
    <div ref={ref} className="relative">
      {/* 触发按钮：与「功能」下拉同款浅色胶囊，保持 h-[38px] 对齐 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition",
          open
            ? "border-orange-300 bg-orange-50 text-orange-600"
            : "border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50"
        )}
      >
        <Sparkles className={cn("h-4 w-4 shrink-0", open ? "text-orange-500" : "text-stone-500")} />
        <span className="truncate leading-none">{short}</span>
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", online ? "bg-emerald-500" : "bg-stone-300")}
          title={online ? "可用" : "未配置"}
        />
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform group-hover:text-orange-500",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-[320px] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
          {/* 面板头 */}
          <div className="border-b border-stone-100 p-2.5">
            <div className="flex items-center gap-2 px-0.5 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-red-500 text-white">
                <Zap className="h-3 w-3" />
              </span>
              <span className="text-[13px] font-semibold text-stone-800">智能模型</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-stone-100 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索模型…"
                className="w-full bg-transparent text-[12px] text-stone-700 outline-none placeholder:text-stone-400"
              />
            </div>
          </div>

          <div className="max-h-[56vh] overflow-y-auto p-1.5">
            {/* 演示模型 */}
            {(!q.trim() || "演示模型".toLowerCase().includes(q.trim().toLowerCase())) && (
              <>
                <GroupHeader name={PROVIDER_NAME.demo} available />
                <ModelRow
                  label="演示模型"
                  sub="免费"
                  provider="demo"
                  active={value === "demo"}
                  available
                  onClick={() => {
                    onChange("demo");
                    setOpen(false);
                  }}
                />
              </>
            )}

            {groups.map((g) => {
              const avail = providerAvailable(g.provider);
              const qq = q.trim().toLowerCase();
              const items = qq ? g.items.filter((it) => it.info.label.toLowerCase().includes(qq)) : g.items;
              if (qq && items.length === 0) return null;
              return (
                <div key={g.provider}>
                  <GroupHeader
                    name={PROVIDER_NAME[g.provider]}
                    available={avail}
                    fetching={fetching === g.provider}
                    onFetch={avail ? () => void fetchModels(g.provider) : undefined}
                  />
                  {items.map(({ info, dynamic: isDynamic }) => (
                    <ModelRow
                      key={info.id}
                      label={info.label}
                      sub={isDynamic ? "动态" : !avail ? "未配置" : REGION_LABEL[info.region]}
                      provider={g.provider}
                      active={value === info.id}
                      available={avail}
                      onClick={() => {
                        onChange(info.id, g.provider);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {fetchError && (
              <div className="mx-1.5 mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
                {fetchError}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
            className="flex w-full items-center gap-2 border-t border-stone-100 bg-stone-50 px-3 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            <KeyRound className="h-4 w-4" />
            配置模型 API Key…
          </button>
        </div>
      )}
    </div>
  );
}

function GroupHeader({
  name,
  available,
  fetching,
  onFetch,
}: {
  name: string;
  available: boolean;
  fetching?: boolean;
  onFetch?: () => void;
}) {
  return (
    <div className="mt-1.5 flex items-center justify-between rounded-lg bg-stone-50 px-2.5 py-1.5 first:mt-0">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-500">
        <span className={cn("h-1.5 w-1.5 rounded-full", available ? "bg-emerald-500" : "bg-stone-300")} />
        {name}
      </span>
      {onFetch && (
        <button
          onClick={onFetch}
          disabled={fetching}
          title="从该供应商拉取最新模型列表"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-stone-400 transition hover:bg-white hover:text-orange-600 disabled:opacity-40"
        >
          {fetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          获取模型
        </button>
      )}
    </div>
  );
}

function ModelRow({
  label,
  sub,
  provider,
  active,
  available,
  onClick,
}: {
  label: string;
  sub?: string;
  provider: string;
  active: boolean;
  available: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={!available}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition",
        active ? "bg-orange-50" : "hover:bg-stone-50",
        !available && "cursor-not-allowed opacity-40"
      )}
    >
      <ProviderLogo provider={provider} className={cn("transition-transform group-hover:scale-105", active && "ring-2 ring-orange-200")} />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[13px] font-medium", active ? "text-orange-700" : "text-stone-800")}>
          {label}
        </div>
        {sub && (
          <span
            className={cn(
              "mt-1 inline-block rounded-md px-1.5 py-px text-[10px] font-medium",
              active ? "bg-orange-100 text-orange-600" : "bg-stone-100 text-stone-400"
            )}
          >
            {sub}
          </span>
        )}
      </div>
      {active && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm shadow-orange-200">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
