"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  Globe,
  Info,
  KeyRound,
  ListTree,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import {
  loadSettings,
  saveSettings,
  PROVIDER_META,
  TAVILY_KEY,
  loadDynamicModels,
  saveDynamicModels,
  serverProviderStatus,
  loadDefaultModel,
  saveDefaultModel,
  loadDefaultModelByMode,
  saveDefaultModelByMode,
  loadProviderHealth,
  saveProviderHealth,
  type ProviderHealth,
  type ProviderSettings,
} from "@/lib/settings";
import { MODELS } from "@/lib/gateway/models";
import { ALL_TOOLS, loadToolUsage } from "@/lib/tools";
import { useChatStore } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { useLang, setLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ProviderId } from "@/lib/gateway";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { readRaw, removeKey } from "@/lib/safe-storage";
import { readThemeMode, setThemeMode, type ThemeMode } from "@/lib/theme";

type TestState = Record<string, "idle" | "testing" | "ok" | "fail">;
export type SettingsTabId = "models" | "network" | "data" | "about";

/** 工作台模式（用于按功能独立设置默认模型） */
const MODE_LIST: Array<{ id: string; label: string }> = [
  { id: "chat", label: "对话" },
  { id: "research", label: "研究" },
  { id: "slides", label: "PPT" },
  { id: "image", label: "绘图" },
  { id: "video", label: "视频" },
  { id: "docs", label: "文档" },
];

const TABS: Array<{
  id: SettingsTabId;
  label: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    id: "models",
    label: "模型设置",
    desc: "配置模型 API / 中转",
    icon: <Cpu className="h-4 w-4" />,
  },
  {
    id: "network",
    label: "联网搜索",
    desc: "深度研究联网来源",
    icon: <Globe className="h-4 w-4" />,
  },
  {
    id: "data",
    label: "数据备份",
    desc: "导出 / 导入 / 清理",
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "about",
    label: "关于与存储",
    desc: "运行状态与占用",
    icon: <Info className="h-4 w-4" />,
  },
];

/** 前端写入 localStorage 的数据，用于「关于与存储」页展示真实占用 */
const LOCAL_KEYS: Array<{ key: string; label: string; desc: string; secret?: boolean }> = [
  {
    key: "opencanvas.provider.settings.v1",
    label: "模型密钥 / 中转地址",
    desc: "模型设置里填写的 API Key 与 Base URL",
    secret: true,
  },
  {
    key: "opencanvas.dynamic.models.v1",
    label: "自定义模型列表",
    desc: "测试连接成功后拉取到的模型清单",
  },
  {
    key: "opencanvas.prompts.v1",
    label: "提示词库",
    desc: "收藏 / 最近使用 / 自建提示词与模板",
  },
  { key: "oc:knowledge-bases.v2", label: "知识库", desc: "知识库列表与其下文档" },
  { key: "oc:kb-abilities.v1", label: "知识库能力开关", desc: "语义检索 / 问答 / 引用溯源" },
  { key: "oc:docs.v1", label: "文档中心", desc: "文档列表与正文内容" },
  { key: "oc:doc-folders.v1", label: "文档文件夹", desc: "文档中心的自定义文件夹" },
  { key: "oc:tool-versions", label: "工具箱历史版本", desc: "工具运行结果保存的版本快照" },
  { key: "oc:task-board", label: "团队协作看板", desc: "任务分派清单" },
  { key: "oc:perm-matrix", label: "权限矩阵", desc: "角色 × 权限配置" },
];

function fmtBytes(n: number): string {
  if (n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function SettingsCenter({
  variant = "page",
  onClose,
  initialTab = "models",
}: {
  /** page = 设置页面内的主体；modal = 弹窗内嵌 */
  variant?: "page" | "modal";
  onClose?: () => void;
  initialTab?: SettingsTabId;
}) {
  const router = useRouter();
  const hydrate = useChatStore((s) => s.hydrate);
  const [lang, switchLang] = useLang();

  const [tab, setTab] = useState<SettingsTabId>(initialTab);
  // E59: 外观主题并入设置中心（与工作台顶栏下拉同一套存储键）
  const [theme, setTheme] = useState<ThemeMode>(readThemeMode());
  const [settings, setSettings] = useState<ProviderSettings>({});
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [test, setTest] = useState<TestState>({});
  const [serverStatus, setServerStatus] = useState<Record<string, boolean>>({});
  const [dynamic, setDynamic] = useState<Partial<Record<ProviderId, string[]>>>({});
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [storage, setStorage] = useState<Array<{ key: string; bytes: number }>>([]);
  const [importing, setImporting] = useState(false);
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [defaultModel, setDefaultModel] = useState("demo");
  const [modeModels, setModeModels] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<{ conversations: number; messages: number; exports: number } | null>(null);
  const [toolTop, setToolTop] = useState<Array<{ name: string; count: number }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);

  const refreshStorage = useCallback(() => {
    const next = LOCAL_KEYS.map((k) => ({
      key: k.key,
      bytes: (readRaw(k.key) ?? "").length * 2, // UTF-16 近似
    }));
    setStorage(next);
  }, []);

  useEffect(() => {
    setSettings(loadSettings());
    setSaved(false);
    setTest({});
    setDynamic(loadDynamicModels());
    setHealth(loadProviderHealth());
    setDefaultModel(loadDefaultModel());
    setModeModels(loadDefaultModelByMode());
    refreshStorage();
    void serverProviderStatus().then(setServerStatus);
    // 用量统计（与会员中心同一数据源）
    fetch("/api/membership")
      .then((r) => r.json())
      .then((d: { stats?: { conversations: number; messages: number; exports: number } }) => {
        if (d.stats) setUsage(d.stats);
      })
      .catch(() => {});
    // 工具使用排行
    try {
      const map = loadToolUsage();
      setToolTop(
        Object.entries(map)
          .map(([id, count]) => ({ name: ALL_TOOLS.find((t) => t.id === id)?.name ?? id, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      );
    } catch {}
  }, [refreshStorage]);

  /** 记录一次密钥验证结果（本机持久化，作为健康状态展示） */
  const recordHealth = (id: string, ok: boolean, models: number) => {
    const next = { ...loadProviderHealth(), [id]: { ok, models, at: Date.now() } };
    saveProviderHealth(next);
    setHealth(next);
  };

  const fmtHealthTime = (at: number) => {
    const d = new Date(at);
    return d.toDateString() === new Date().toDateString()
      ? `今天 ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`
      : d.toLocaleDateString("zh-CN");
  };

  useEffect(() => {
    if (variant !== "modal" || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, onClose]);

  const totalBytes = useMemo(() => storage.reduce((n, s) => n + s.bytes, 0), [storage]);

  const update = (id: string, field: "apiKey" | "baseUrl", value: string) => {
    setSettings((s) => ({
      ...s,
      [id]: {
        apiKey: (s[id as ProviderId]?.apiKey) ?? "",
        baseUrl: (s[id as ProviderId]?.baseUrl) ?? "",
        [field]: value,
      },
    }));
    setSaved(false);
  };

  const tavily = settings[TAVILY_KEY as ProviderId]?.apiKey ?? "";

  const testConnection = async (id: ProviderId) => {
    const cur = settings[id];
    if (!cur?.apiKey) {
      toast("请先填写 API Key", "error");
      return;
    }
    setTest((t) => ({ ...t, [id]: "testing" }));
    try {
      const res = await fetch("/api/models/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: id,
          overrides: { [id]: { apiKey: cur.apiKey, baseUrl: cur.baseUrl || undefined } },
        }),
      });
      const data = (await res.json()) as { models?: string[]; error?: string };
      if (!res.ok || !data.models) throw new Error(data.error ?? "连接失败");

      const dyn = loadDynamicModels();
      dyn[id] = data.models;
      saveDynamicModels(dyn);

      recordHealth(id, true, data.models.length);
      setTest((t) => ({ ...t, [id]: "ok" }));
      toast(`连接成功，获取到 ${data.models.length} 个模型`, "success");
    } catch (e) {
      recordHealth(id, false, 0);
      setTest((t) => ({ ...t, [id]: "fail" }));
      toast(`连接失败：${e instanceof Error ? e.message : ""}`, "error");
    }
  };

  /** 已配置（本机填了 key 或服务端 env 配了）才能拉取模型 */
  const isReady = (id: ProviderId) => Boolean(settings[id]?.apiKey) || Boolean(serverStatus[id]);

  /** 拉取该供应商账号/中转真实可用的模型列表并缓存（用当前表单值，未保存也能拉） */
  const fetchModels = async (id: ProviderId) => {
    if (!isReady(id)) {
      toast("请先填写 API Key（或由服务端配置）", "error");
      return;
    }
    const cur = settings[id];
    setFetching((f) => ({ ...f, [id]: true }));
    try {
      const res = await fetch("/api/models/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: id,
          overrides: cur?.apiKey
            ? { [id]: { apiKey: cur.apiKey, baseUrl: cur.baseUrl || undefined } }
            : undefined,
        }),
      });
      const data = (await res.json()) as { models?: string[]; error?: string };
      if (!res.ok || !data.models) throw new Error(data.error ?? "获取失败");

      const next = { ...loadDynamicModels(), [id]: data.models };
      saveDynamicModels(next);
      setDynamic(next);
      recordHealth(id, true, data.models.length);
      setTest((t) => ({ ...t, [id]: "ok" }));
      setExpanded((e) => ({ ...e, [id]: true }));
      toast(
        `${PROVIDER_META.find((p) => p.id === id)?.label.split("（")[0]}：已获取 ${data.models.length} 个模型`,
        "success",
      );
    } catch (e) {
      recordHealth(id, false, 0);
      setTest((t) => ({ ...t, [id]: "fail" }));
      toast(`获取模型列表失败：${e instanceof Error ? e.message : ""}`, "error");
    } finally {
      setFetching((f) => ({ ...f, [id]: false }));
    }
  };

  /** 一键刷新全部已配置供应商的模型列表 */
  const fetchAll = async () => {
    const targets = PROVIDER_META.filter((p) => isReady(p.id)).map((p) => p.id);
    if (targets.length === 0) {
      toast("请先至少配置一家供应商的 API Key", "error");
      return;
    }
    setFetching(Object.fromEntries(targets.map((t) => [t, true])));
    let ok = 0;
    let count = 0;
    const failed: string[] = [];
    for (const id of targets) {
      const cur = settings[id];
      try {
        const res = await fetch("/api/models/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: id,
            overrides: cur?.apiKey
              ? { [id]: { apiKey: cur.apiKey, baseUrl: cur.baseUrl || undefined } }
              : undefined,
          }),
        });
        const data = (await res.json()) as { models?: string[]; error?: string };
        if (!res.ok || !data.models) throw new Error(data.error ?? "获取失败");
        const next = { ...loadDynamicModels(), [id]: data.models };
        saveDynamicModels(next);
        setDynamic(next);
        recordHealth(id, true, data.models.length);
        setTest((t) => ({ ...t, [id]: "ok" }));
        ok += 1;
        count += data.models.length;
      } catch (e) {
        recordHealth(id, false, 0);
        setTest((t) => ({ ...t, [id]: "fail" }));
        failed.push(
          `${PROVIDER_META.find((p) => p.id === id)?.label.split("（")[0]}（${
            e instanceof Error ? e.message : "失败"
          }）`,
        );
      } finally {
        setFetching((f) => ({ ...f, [id]: false }));
      }
    }
    if (ok > 0) toast(`已更新 ${ok} 家供应商、共 ${count} 个模型`, "success");
    if (failed.length > 0) toast(`获取失败：${failed.join("、")}`, "error");
  };

  /** 清除某家已缓存的模型列表 */
  const clearModels = (id: ProviderId) => {
    const next = { ...loadDynamicModels() };
    delete next[id];
    saveDynamicModels(next);
    setDynamic(next);
    setTest((t) => ({ ...t, [id]: "idle" }));
    setExpanded((e) => ({ ...e, [id]: false }));
    toast("已清除该供应商的模型列表", "info");
  };

  const handleSave = () => {
    saveSettings(settings);
    saveDefaultModel(defaultModel);
    saveDefaultModelByMode(modeModels);
    // 让默认模型立即对当前会话与新建对话生效
    useChatStore.setState({ model: defaultModel });
    setSaved(true);
    refreshStorage();
    toast("设置已保存，新建对话将默认使用所选模型", "success");
    if (variant === "modal" && onClose) setTimeout(onClose, 500);
  };

  /** 导出服务端会话与消息为 JSON 备份 */
  const handleExport = () => {
    const a = document.createElement("a");
    a.href = "/api/export";
    a.download = `opencanvas-backup-${Date.now()}.json`;
    a.click();
    toast("正在导出备份…", "info");
  };

  /** 导入备份：逐条写入会话与消息，再刷新侧栏 */
  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        app?: string;
        conversations?: Array<{
          id?: string;
          title?: string;
          mode?: string;
          model?: string;
          messages?: Array<{ id?: string; role?: string; content?: string }>;
        }>;
      };
      const list = Array.isArray(data.conversations) ? data.conversations : [];
      if (list.length === 0) throw new Error("备份文件里没有会话数据");

      let conv = 0;
      let msgs = 0;
      for (const c of list) {
        if (!c.id) continue;
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: c.id,
            title: c.title ?? "导入的对话",
            mode: c.mode ?? "chat",
            model: c.model ?? "demo",
          }),
        });
        if (!res.ok) continue;
        conv += 1;
        for (const m of c.messages ?? []) {
          if (!m?.id || !m.role || typeof m.content !== "string") continue;
          await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: m.id,
              conversationId: c.id,
              role: m.role,
              content: m.content,
            }),
          });
          msgs += 1;
        }
      }
      await hydrate();
      toast(`已导入 ${conv} 个会话、${msgs} 条消息`, "success");
    } catch (e) {
      toast(`导入失败：${e instanceof Error ? e.message : "文件解析失败"}`, "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /** 清空本机缓存数据；keepSecrets = true 时保留模型密钥 */
  const clearLocal = (keepSecrets: boolean) => {
    const keys = LOCAL_KEYS.filter((k) => !keepSecrets || !k.secret).map((k) => k.key);
    for (const k of keys) removeKey(k);
    refreshStorage();
    if (!keepSecrets) {
      setSettings({});
      toast("已清空全部本机数据（页面刷新后恢复默认）", "success");
    } else {
      toast("已清空缓存数据，模型密钥已保留", "success");
    }
  };

  const keyInput = (id: string, value: string, placeholder: string) => (
    <div className="relative mb-3">
      <input
        type={showKey[id] ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => update(id, "apiKey", e.target.value)}
        className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
      />
      <button
        type="button"
        onClick={() => setShowKey((s) => ({ ...s, [id]: !s[id] }))}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition hover:text-stone-600"
        title={showKey[id] ? "隐藏" : "显示"}
      >
        {showKey[id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  const StatusPill = ({
    text,
    kind,
    icon,
  }: {
    text: string;
    kind: "ok" | "info" | "fail";
    icon?: React.ReactNode;
  }) => (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        kind === "ok" && "bg-emerald-50 text-emerald-600",
        kind === "info" && "bg-stone-100 text-stone-500",
        kind === "fail" && "bg-red-50 text-red-600",
      )}
    >
      {icon}
      {text}
    </span>
  );

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* 左侧分类导航 */}
      <aside className="hidden w-56 shrink-0 border-r border-stone-100 bg-white p-3 md:flex md:flex-col">
        <div className="mb-4 flex items-center gap-2.5 px-2 pb-3 pt-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[14px] font-semibold text-stone-800">设置中心</div>
            <div className="text-[11px] text-stone-400">OpenCanvas</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition",
                tab === t.id
                  ? "bg-orange-50 text-orange-700"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-800",
              )}
            >
              <span className={cn("mt-0.5", tab === t.id ? "text-orange-500" : "text-stone-400")}>
                {t.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{t.label}</span>
                <span
                  className={cn(
                    "block text-[11px]",
                    tab === t.id ? "text-orange-400" : "text-stone-400",
                  )}
                >
                  {t.desc}
                </span>
              </span>
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-xl border border-stone-200/80 bg-stone-50 p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-stone-600">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            密钥仅存本机
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-400">
            保存在浏览器 localStorage，服务器不存储。
          </p>
        </div>
      </aside>

      {/* 移动端分类切换 */}
      <div className="flex gap-1 overflow-x-auto border-b border-stone-100 bg-white px-3 py-2 md:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
              tab === t.id
                ? "bg-orange-50 text-orange-600"
                : "text-stone-500 hover:bg-stone-50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 右侧内容 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {variant === "page" && (
          <header className="flex items-center justify-between border-b border-stone-100 bg-white/80 px-5 py-3.5 md:hidden">
            <div>
              <h2 className="text-[14px] font-semibold text-stone-800">{activeTab.label}</h2>
              <p className="text-[11px] text-stone-400">{activeTab.desc}</p>
            </div>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {/* 安全提示 */}
          {tab === "models" && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 text-sm text-orange-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <p>
                密钥只保存在<b>你自己的浏览器</b>中，随请求发给本应用后端转发。点「测试连接」可验证密钥并自动拉取可用模型；演示模型始终免费，未配置任何密钥也能正常使用全部功能。
              </p>
            </div>
          )}

          {tab === "models" && (
            <div className="space-y-4">
              {/* 默认模型偏好 */}
              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-sm">
                      <Cpu className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold text-stone-800">默认模型偏好</div>
                      <div className="mt-0.5 text-xs text-stone-400">
                        新建对话时默认使用的模型；保存后立即生效，会话里仍可临时切换
                      </div>
                    </div>
                  </div>
                  <select
                    value={defaultModel}
                    onChange={(e) => {
                      setDefaultModel(e.target.value);
                      setSaved(false);
                    }}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-700 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  >
                    {MODELS.filter((m) => m.capabilities.includes("text")).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                    {Object.entries(dynamic).map(([pid, list]) =>
                      list && list.length > 0 ? (
                        <optgroup key={pid} label={PROVIDER_META.find((p) => p.id === pid)?.label ?? pid}>
                          {list.map((m) => (
                            <option key={`${pid}:${m}`} value={m}>
                              {m}
                            </option>
                          ))}
                        </optgroup>
                      ) : null
                    )}
                  </select>
                </div>
                <div className="mt-3 border-t border-stone-100 pt-3">
                  <p className="text-[11.5px] text-stone-400">按工作台单独指定（未设置的跟随上方全局默认）</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {MODE_LIST.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 rounded-xl border border-stone-200/80 px-2.5 py-1.5"
                      >
                        <span className="w-10 shrink-0 text-[12px] text-stone-500">{m.label}</span>
                        <select
                          value={modeModels[m.id] ?? ""}
                          onChange={(e) => {
                            const next = { ...modeModels };
                            if (e.target.value) next[m.id] = e.target.value;
                            else delete next[m.id];
                            setModeModels(next);
                            setSaved(false);
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-1.5 py-1 text-[11.5px] text-stone-700 outline-none"
                        >
                          <option value="">跟随全局</option>
                          {MODELS.filter((mo) => mo.capabilities.includes("text")).map((mo) => (
                            <option key={mo.id} value={mo.id}>
                              {mo.label}
                            </option>
                          ))}
                          {Object.entries(dynamic).map(([pid, list]) =>
                            list && list.length > 0 ? (
                              <optgroup key={pid} label={PROVIDER_META.find((p) => p.id === pid)?.label ?? pid}>
                                {list.map((m) => (
                                  <option key={`${pid}:${m}`} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null,
                          )}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 密钥健康状态 */}
              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-sm">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-stone-800">密钥健康</div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      每家供应商最近一次「测试连接 / 获取模型」的结果与时间（保存在本机）
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PROVIDER_META.map((p) => {
                    const h = health[p.id];
                    if (!h) {
                      return (
                        <StatusPill
                          key={p.id}
                          text={`${p.label.split("（")[0]}：未验证`}
                          kind="info"
                        />
                      );
                    }
                    return (
                      <StatusPill
                        key={p.id}
                        text={`${p.label.split("（")[0]}：${h.ok ? "正常" : "验证失败"} · ${h.ok ? `${h.models} 个模型 · ` : ""}${fmtHealthTime(h.at)}`}
                        kind={h.ok ? "ok" : "fail"}
                        icon={h.ok ? <Check className="h-3 w-3" /> : undefined}
                      />
                    );
                  })}
                  {Object.keys(health).length === 0 && (
                    <p className="text-[11.5px] text-stone-400">
                      还没有验证记录。填好 API Key 后点「测试连接」或「获取模型列表」，这里会显示最近一次验证结果。
                    </p>
                  )}
                </div>
              </div>

              {/* 动态模型列表总览 */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold text-stone-800">
                    <ListTree className="h-4 w-4 text-stone-400" />
                    动态模型列表
                    <StatusPill
                      text={`${Object.keys(dynamic).length} 家 / ${Object.values(dynamic).reduce(
                        (n, l) => n + (l?.length ?? 0),
                        0,
                      )} 个`}
                      kind="info"
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-stone-400">
                    从供应商账号或中转地址拉取真实可用模型；获取成功后会出现在对话页的模型下拉里
                  </p>
                </div>
                <button
                  onClick={() => void fetchAll()}
                  disabled={Object.values(fetching).some(Boolean)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600 disabled:opacity-40"
                >
                  {Object.values(fetching).some(Boolean) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  一键获取全部
                </button>
              </div>

              {PROVIDER_META.map((p) => {
                const cur = settings[p.id] ?? { apiKey: "", baseUrl: "" };
                const configured = Boolean(cur.apiKey);
                const st = test[p.id] ?? "idle";
                const onServer = serverStatus[p.id];
                const list = dynamic[p.id] ?? [];
                const isFetching = Boolean(fetching[p.id]);
                const isOpen = Boolean(expanded[p.id]);
                const shown = isOpen ? list.slice(0, 60) : [];
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-sm">
                          <KeyRound className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-semibold text-stone-800">
                              {p.label}
                            </span>
                            <StatusPill text={p.region} kind="info" />
                            {configured && (
                              <StatusPill
                                text="本机已填写"
                                kind="ok"
                                icon={<Check className="h-3 w-3" />}
                              />
                            )}
                            {!configured && onServer && (
                              <StatusPill
                                text="服务端已配置"
                                kind="ok"
                                icon={<Server className="h-3 w-3" />}
                              />
                            )}
                            {st === "ok" && (
                              <StatusPill
                                text="连接正常"
                                kind="ok"
                                icon={<Check className="h-3 w-3" />}
                              />
                            )}
                            {st === "fail" && <StatusPill text="连接失败" kind="fail" />}
                          </div>
                          <div className="mt-0.5 text-xs text-stone-400">
                            {p.models} · {p.note}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => void fetchModels(p.id)}
                          disabled={isFetching || !isReady(p.id)}
                          title="从该供应商拉取最新模型列表"
                          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600 disabled:opacity-40"
                        >
                          {isFetching ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ListTree className="h-3.5 w-3.5" />
                          )}
                          获取模型列表
                        </button>
                        <button
                          onClick={() => void testConnection(p.id)}
                          disabled={st === "testing" || !configured}
                          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600 disabled:opacity-40"
                        >
                          {st === "testing" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          测试连接
                        </button>
                      </div>
                    </div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">API Key</label>
                    {keyInput(p.id, cur.apiKey, "sk-...")}
                    <label className="mb-1 block text-xs font-medium text-stone-500">
                      Base URL（可选，默认官方地址；中转填中转地址）
                    </label>
                    <input
                      type="text"
                      value={cur.baseUrl}
                      placeholder={p.defaultBaseUrl}
                      onChange={(e) => update(p.id, "baseUrl", e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    />

                    {/* 已获取到的模型列表 */}
                    <div className="mt-3 rounded-xl border border-stone-100 bg-stone-50/70 p-3">
                      {list.length > 0 ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[12px] font-medium text-stone-600">
                              已获取 {list.length} 个模型
                            </span>
                            <button
                              onClick={() => setExpanded((e) => ({ ...e, [p.id]: !isOpen }))}
                              className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-500 transition hover:border-orange-300 hover:text-orange-600"
                            >
                              {isOpen ? "收起" : "展开列表"}
                            </button>
                            <button
                              onClick={() => void fetchModels(p.id)}
                              disabled={isFetching || !isReady(p.id)}
                              className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-500 transition hover:border-orange-300 hover:text-orange-600 disabled:opacity-40"
                            >
                              <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
                              刷新
                            </button>
                            <button
                              onClick={() => clearModels(p.id)}
                              className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-500 transition hover:border-red-200 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                              清除
                            </button>
                          </div>
                          {isOpen && (
                            <div className="mt-2 max-h-44 overflow-y-auto pr-1">
                              <div className="flex flex-wrap gap-1.5">
                                {shown.map((m) => (
                                  <span
                                    key={m}
                                    title={m}
                                    className="max-w-[220px] truncate rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-600"
                                  >
                                    {m}
                                  </span>
                                ))}
                                {list.length > shown.length && (
                                  <span className="rounded-md px-1.5 py-0.5 text-[11px] text-stone-400">
                                    还有 {list.length - shown.length} 个…
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-[11.5px] leading-relaxed text-stone-400">
                          尚未获取模型列表。点「获取模型列表」从该账号 / 中转拉取真实可用模型，成功后会出现在对话页的模型下拉里。
                          {!isReady(p.id) && "（需先填写 API Key）"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "network" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-sm">
                    <Search className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-stone-800">
                        Tavily 联网搜索
                      </span>
                      <StatusPill text="联网用" kind="info" />
                      {tavily && (
                        <StatusPill
                          text="已填写"
                          kind="ok"
                          icon={<Check className="h-3 w-3" />}
                        />
                      )}
                      {!tavily && serverStatus[TAVILY_KEY] && (
                        <StatusPill
                          text="服务端已配置"
                          kind="ok"
                          icon={<Server className="h-3 w-3" />}
                        />
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      用于深度研究等需要实时联网的场景
                    </div>
                  </div>
                </div>
                <div className="mb-1 mt-3 text-xs text-stone-400">
                  填入后深度研究真实联网；不填则使用示例来源。获取：tavily.com
                </div>
                {keyInput(TAVILY_KEY, tavily, "tvly-...")}
              </div>

              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-stone-300 to-stone-400 text-white shadow-sm">
                    <Server className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-stone-800">服务端运行状态</div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      读自 /api/models，只返回「是否配置」，不返回密钥内容
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      void serverProviderStatus().then(setServerStatus);
                      toast("已刷新服务端配置状态", "info");
                    }}
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> 刷新
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PROVIDER_META.map((p) => (
                    <StatusPill
                      key={p.id}
                      text={`${p.label.split("（")[0]}：${
                        serverStatus[p.id] ? "已配置" : "未配置"
                      }`}
                      kind={serverStatus[p.id] ? "ok" : "info"}
                      icon={
                        serverStatus[p.id] ? (
                          <Check className="h-3 w-3" />
                        ) : undefined
                      }
                    />
                  ))}
                  <StatusPill text="演示模型：始终可用" kind="ok" icon={<Check className="h-3 w-3" />} />
                </div>
              </div>
            </div>
          )}

          {tab === "data" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-sm">
                    <Database className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-stone-800">导出 / 导入备份</div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      备份包含全部会话与消息（服务端 SQLite），保存为 JSON 文件
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-3.5">
                  <p className="text-xs text-stone-500">
                    备份文件保存在本机，不会上传到任何服务器。
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleExport}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600"
                    >
                      <Download className="h-3.5 w-3.5" /> 导出数据
                    </button>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={importing}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600 disabled:opacity-50"
                    >
                      {importing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      导入备份
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImport(f);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-rose-500 text-white shadow-sm">
                    <Trash2 className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-stone-800">清理本机数据</div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      只影响保存在这台浏览器里的数据，不会删除服务端会话
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => clearLocal(true)}
                    className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600"
                  >
                    清空缓存数据（保留密钥）
                  </button>
                  <button
                    onClick={() => setClearAllOpen(true)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100"
                  >
                    清空全部本机数据
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "about" && (
            <div className="space-y-4">
              {/* E59: 外观主题（浅色 / 深色 / 跟随系统） */}
              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="text-[14px] font-semibold text-stone-800">外观主题</div>
                <div className="mt-0.5 text-xs text-stone-400">切换后立即生效并记住选择</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      { id: "light", label: "浅色", icon: Sun, desc: "明亮暖白" },
                      { id: "dark", label: "深色", icon: Moon, desc: "夜间护眼" },
                      { id: "system", label: "跟随系统", icon: Monitor, desc: "随设备自动" },
                    ] as { id: ThemeMode; label: string; icon: typeof Sun; desc: string }[]
                  ).map((o) => {
                    const cur = theme === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => {
                          setTheme(o.id);
                          setThemeMode(o.id);
                          toast(
                            o.id === "light"
                              ? "已切换到浅色模式"
                              : o.id === "dark"
                                ? "已切换到深色模式"
                                : "已切换到跟随系统",
                            "info"
                          );
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2 transition",
                          cur
                            ? "border-orange-300 bg-orange-50"
                            : "border-stone-200 hover:border-stone-300"
                        )}
                      >
                        <o.icon className={cn("h-4 w-4", cur ? "text-orange-600" : "text-stone-400")} />
                        <span className="text-left">
                          <span className={cn("block text-xs font-medium", cur ? "text-orange-700" : "text-stone-700")}>
                            {o.label}
                          </span>
                          <span className="block text-[10px] text-stone-400">{o.desc}</span>
                        </span>
                        {cur && <Check className="h-3.5 w-3.5 text-orange-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-sm">
                    <Info className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-stone-800">OpenCanvas v0.1.0</div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      AI 创作工作台 · Next.js 14 + React 18 + Tailwind CSS + SQLite
                    </div>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 text-[12.5px] sm:grid-cols-2">
                  {[
                    { k: "会话与消息", v: "服务端 SQLite（Prisma）" },
                    { k: "模型密钥", v: "浏览器 localStorage" },
                    { k: "知识库 / 文档 / 提示词", v: "浏览器 localStorage" },
                    { k: "未配置密钥时", v: "自动使用演示模型（免费）" },
                  ].map((row) => (
                    <div
                      key={row.k}
                      className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2"
                    >
                      <dt className="text-[11px] text-stone-400">{row.k}</dt>
                      <dd className="mt-0.5 font-medium text-stone-700">{row.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold text-stone-800">
                      本机存储占用
                      <span className="ml-2 text-xs font-normal text-stone-400">
                        合计 {fmtBytes(totalBytes)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      按模块统计当前浏览器里保存的数据大小
                    </div>
                  </div>
                  <button
                    onClick={refreshStorage}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> 刷新
                  </button>
                </div>
                <div className="mt-3 overflow-hidden rounded-xl border border-stone-100">
                  <table className="w-full text-left text-[12.5px]">
                    <thead className="bg-stone-50 text-[11px] text-stone-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">模块</th>
                        <th className="px-3 py-2 font-medium">说明</th>
                        <th className="w-20 px-3 py-2 text-right font-medium">占用</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LOCAL_KEYS.map((k) => {
                        const row = storage.find((s) => s.key === k.key);
                        return (
                          <tr key={k.key} className="border-t border-stone-100">
                            <td className="px-3 py-2 font-medium text-stone-700">{k.label}</td>
                            <td className="px-3 py-2 text-stone-400">{k.desc}</td>
                            <td
                              className={cn(
                                "px-3 py-2 text-right tabular-nums",
                                (row?.bytes ?? 0) > 0 ? "text-stone-700" : "text-stone-300",
                              )}
                            >
                              {fmtBytes(row?.bytes ?? 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 用量统计 */}
              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-sm">
                    <Info className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-stone-800">界面语言 / Language</div>
                    <div className="mt-0.5 text-xs text-stone-400">切换全局界面语言 · Switch UI language</div>
                  </div>
                  <div className="ml-auto flex overflow-hidden rounded-lg border border-stone-200">
                    {(["zh", "en"] as Lang[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => switchLang(l)}
                        className={cn(
                          "px-3 py-1.5 text-[12px] font-medium transition",
                          lang === l ? "bg-orange-50 text-orange-600" : "bg-white text-stone-500 hover:text-stone-800",
                        )}
                      >
                        {l === "zh" ? "简体中文" : "English"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
                    <ListTree className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-stone-800">用量统计</div>
                    <div className="mt-0.5 text-xs text-stone-400">服务端累计的会话 / 消息 / 导出总量</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 divide-x divide-[#f0eadf] rounded-xl border border-[#f0eadf] py-3 text-center">
                  <div>
                    <p className="text-[18px] font-bold text-stone-800">
                      {usage ? usage.conversations.toLocaleString() : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">会话</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-bold text-stone-800">
                      {usage ? usage.messages.toLocaleString() : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">消息</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-bold text-stone-800">
                      {usage ? usage.exports.toLocaleString() : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">导出</p>
                  </div>
                </div>
              </div>

              {/* 使用习惯 */}
              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-stone-800">使用习惯</div>
                    <div className="mt-0.5 text-xs text-stone-400">本机记录的工具打开排行（Top 5）</div>
                  </div>
                </div>
                {toolTop.length === 0 ? (
                  <p className="mt-3 text-[11.5px] text-stone-400">还没有工具使用记录，去工具箱试试吧。</p>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    {toolTop.map((t, i) => {
                      const max = toolTop[0].count || 1;
                      return (
                        <div key={t.name} className="flex items-center gap-2.5">
                          <span className="w-4 shrink-0 text-center text-[11px] font-bold text-stone-400">{i + 1}</span>
                          <span className="w-24 shrink-0 truncate text-[12.5px] text-stone-600">{t.name}</span>
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-stone-100">
                            <span className="block h-full rounded-full bg-orange-400" style={{ width: `${(t.count / max) * 100}%` }} />
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-stone-400">{t.count} 次</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="text-[14px] font-semibold text-stone-800">快捷入口</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    { label: "AI 对话", route: "/chat" },
                    { label: "知识库", route: "/knowledge" },
                    { label: "文档中心", route: "/docs" },
                    { label: "模板中心", route: "/templates" },
                    { label: "工具箱", route: "/tools" },
                    { label: "会员中心", route: "/membership" },
                  ].map((l) => (
                    <button
                      key={l.route}
                      onClick={() => router.push(l.route)}
                      className="flex items-center justify-between rounded-xl border border-stone-200/80 px-3.5 py-2.5 text-[13px] text-stone-700 transition hover:border-orange-300 hover:bg-orange-50/60 hover:text-orange-700"
                    >
                      {l.label}
                      <ArrowUpRight className="h-3.5 w-3.5 text-stone-300" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <footer className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-stone-100 bg-white/80 px-5 py-3.5 backdrop-blur md:px-6">
          <button
            onClick={() => (onClose ? onClose() : router.push("/"))}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-50"
          >
            {onClose ? "取消（Esc）" : "返回首页"}
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2 text-sm font-medium text-white shadow-md shadow-orange-200 transition hover:brightness-105"
          >
            {saved ? "✓ 已保存" : "保存设置"}
          </button>
        </footer>
      </div>

      <ConfirmDialog
        open={clearAllOpen}
        tone="danger"
        title="清空全部本机数据"
        message="将清空本机保存的模型密钥、知识库、文档中心、提示词与工具数据，且无法恢复。确定继续？"
        confirmText="清空"
        onCancel={() => setClearAllOpen(false)}
        onConfirm={() => {
          setClearAllOpen(false);
          clearLocal(false);
        }}
      />
    </div>
  );
}
