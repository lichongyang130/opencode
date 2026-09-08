"use client";

import { useMemo, useRef, useState } from "react";
import { useSseStream } from "@/hooks/useSseStream";
import {
  Bookmark,
  BookmarkCheck,
  Bot,
  Clock,
  Download,
  Eye,
  Heart,
  LayoutGrid,
  Loader2,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  TEMPLATES,
  CATEGORIES,
  CATEGORY_LABELS,
  extractVariables,
  applyVariables,
  type Template,
  type TemplateCategory,
} from "@/lib/templates";
import type { WorkspaceMode } from "@/lib/store/chat";
import { useChatStore } from "@/lib/store/chat";
import { usePromptStore, encodePrompts, decodePrompts } from "@/lib/prompt-store";
import { getTemplateCases } from "@/lib/template-cases";
import { decodeCaseShare } from "@/lib/case-share";
import { toast } from "@/lib/store/toast";
import { getOverrides } from "@/lib/settings";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tab = "fav" | "recent" | "mine" | TemplateCategory;

const MODE_TAG: Record<WorkspaceMode, string> = {
  chat: "对话",
  research: "研究",
  slides: "PPT",
  image: "绘图",
  video: "视频",
  docs: "文档",
};
const MODE_COLOR: Record<WorkspaceMode, string> = {
  chat: "bg-blue-50 text-blue-600",
  research: "bg-emerald-50 text-emerald-600",
  slides: "bg-violet-50 text-violet-600",
  image: "bg-pink-50 text-pink-600",
  video: "bg-orange-50 text-orange-600",
  docs: "bg-amber-50 text-amber-600",
};

const TAB_ICONS: Record<string, ReactNode> = {
  fav: <Heart className="h-4 w-4" />,
  recent: <Clock className="h-4 w-4" />,
  mine: <Sparkles className="h-4 w-4" />,
};

export function TemplatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const runTemplate = useChatStore((s) => s.runTemplate);
  const fillTemplate = useChatStore((s) => s.fillTemplate);
  const sending = useChatStore((s) => s.sending);
  const { favorites, custom, recent, toggleFavorite, addCustom, removeCustom, markUsed } =
    usePromptStore();

  const [tab, setTab] = useState<Tab>("fav");
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState<Template | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [zoomCase, setZoomCase] = useState<{
    image?: string;
    label: string;
    prompt: string;
    output?: string;
    source?: string;
  } | null>(null);

  /** 导出全部自建提示词为 JSON 文件 */
  const exportPrompts = () => {
    if (custom.length === 0) {
      toast("还没有自建提示词可导出", "info");
      return;
    }
    const blob = new Blob([JSON.stringify({ app: "opencanvas-prompts", version: 1, exportedAt: Date.now(), prompts: custom.map(({ id: _id, builtin: _b, ...rest }) => rest) }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opencanvas-prompts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`已导出 ${custom.length} 条提示词`, "success");
  };

  const importPrompts = (list: Array<Omit<Template, "id" | "builtin">>) => {
    const n = usePromptStore.getState().importCustom(list);
    if (n > 0) {
      toast(`成功导入 ${n} 条提示词`, "success");
      setTab("mine");
    } else {
      toast("没有有效的提示词数据", "error");
    }
  };

  /** 从 JSON 文件导入 */
  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = decodePrompts(String(reader.result ?? ""));
      if (!parsed) {
        toast("文件格式不正确", "error");
        return;
      }
      importPrompts(parsed.prompts);
      setShowImport(false);
    };
    reader.readAsText(file);
  };

  const all = useMemo(() => [...custom, ...TEMPLATES], [custom]);
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const list = useMemo(() => {
    let base: Template[];
    if (tab === "fav") base = all.filter((t) => favSet.has(t.id));
    else if (tab === "recent")
      base = recent
        .map((id) => all.find((t) => t.id === id))
        .filter((t): t is Template => Boolean(t));
    else if (tab === "mine") base = custom;
    else base = all.filter((t) => t.category === tab);

    if (query.trim()) {
      const q = query.toLowerCase();
      base = base.filter((t) =>
        (t.label + t.desc + t.prompt + t.category).toLowerCase().includes(q)
      );
    }
    return base;
  }, [tab, query, all, favSet, recent, custom]);

  if (!open) return null;

  const close = () => {
    onClose();
    setRunning(null);
    setShowCreate(false);
  };

  const doRun = (t: Template, values: Record<string, string>) => {
    const prompt = applyVariables(t.prompt, values);
    markUsed(t.id);
    close();
    setTimeout(() => void runTemplate({ mode: t.mode, prompt }), 80);
  };

  /** 做同款：把案例参数填入输入框（不自动发送，待用户确认） */
  const makeSame = (t: Template, c: { label: string; values: Record<string, string> }) => {
    markUsed(t.id);
    close();
    void fillTemplate({ mode: t.mode, prompt: applyVariables(t.prompt, c.values) });
    toast(`已把「${t.label}」同款填入输入框，确认后发送`, "success");
  };

  /** 分享：生成公开链接并复制（方案 B） */
  const shareCase = async (
    t: Template,
    c: { label: string; values: Record<string, string>; output?: string; image?: string; source?: string }
  ) => {
    try {
      const r = await fetch("/api/cases/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: t.id,
          label: c.label,
          prompt: applyVariables(t.prompt, c.values),
          values: c.values,
          output: c.output,
          image: c.image,
          source: c.source,
        }),
      });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!j.url) throw new Error(j.error || "生成失败");
      await navigator.clipboard?.writeText(`${location.origin}${j.url}`);
      toast("分享链接已复制", "success");
    } catch {
      toast("分享失败，请稍后重试", "error");
    }
  };

  const sidebar: { id: Tab; label: string; icon: ReactNode; count?: number }[] = [
    { id: "fav", label: "我的收藏", icon: TAB_ICONS.fav, count: favorites.length },
    { id: "recent", label: "最近使用", icon: TAB_ICONS.recent, count: recent.length },
    ...CATEGORIES.map((c) => ({
      id: c.id as Tab,
      label: c.label,
      icon: <LayoutGrid className="h-4 w-4" />,
    })),
    { id: "mine", label: "我的提示词", icon: TAB_ICONS.mine, count: custom.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div
        className="flex h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧分类 */}
        <div className="flex w-44 shrink-0 flex-col border-r border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2 px-4 py-4 font-semibold">
            <Wand2 className="h-5 w-5 text-brand-600" /> 提示词库
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
            {sidebar.map((s) => (
              <button
                key={s.id}
                onClick={() => setTab(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  tab === s.id
                    ? "bg-brand-600 font-medium text-white"
                    : "text-stone-600 hover:bg-stone-200/60"
                )}
              >
                {s.icon}
                <span className="flex-1 text-left">{s.label}</span>
                {s.count !== undefined && s.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px]",
                      tab === s.id ? "bg-white/20" : "bg-stone-200 text-stone-500"
                    )}
                  >
                    {s.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 border-t border-stone-100 p-2">
            <button
              onClick={() => setShowAI(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              <Bot className="h-4 w-4" /> AI 帮我写提示词
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 px-3 py-2 text-sm text-brand-600 transition hover:bg-brand-50"
            >
              <Plus className="h-4 w-4" /> 手动新建
            </button>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowImport(true)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-500 transition hover:bg-stone-100"
              >
                <Upload className="h-3.5 w-3.5" /> 导入
              </button>
              <button
                onClick={exportPrompts}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-500 transition hover:bg-stone-100"
              >
                <Download className="h-3.5 w-3.5" /> 导出
              </button>
            </div>
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-stone-200 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-stone-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索提示词、场景、关键词…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-stone-300"
              />
              {query && (
                <button onClick={() => setQuery("")}>
                  <X className="h-3.5 w-3.5 text-stone-300 hover:text-stone-500" />
                </button>
              )}
            </div>
            <button onClick={close} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {list.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-400">
                <Wand2 className="h-8 w-8" />
                <p className="text-sm">
                  {tab === "fav"
                    ? "还没有收藏，点卡片上的 ☆ 收藏常用提示词"
                    : tab === "recent"
                      ? "使用过的提示词会出现在这里"
                      : tab === "mine"
                        ? "还没有自建提示词，点左下角「新建提示词」"
                        : "没有匹配的提示词"}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((t) => {
                  const fav = favSet.has(t.id);
                  const isMine = tab === "mine" || custom.some((c) => c.id === t.id);
                  const cases = getTemplateCases(t.id);
                  const thumb = cases.find((c) => c.image);
                  return (
                    <div
                      key={t.id}
                      className="group flex flex-col rounded-xl border border-stone-200 p-3.5 transition hover:border-brand-300 hover:shadow-sm"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
                            <span className="truncate">{t.label}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className={cn("rounded px-1.5 py-0.5 text-[10px]", MODE_COLOR[t.mode])}>
                              {MODE_TAG[t.mode]}
                            </span>
                            <span className="truncate text-[11px] text-stone-400">
                              {CATEGORY_LABELS[t.category]} · {t.desc}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {isMine && (
                            <button
                              title="复制分享码"
                              onClick={() => {
                                const { id: _i, builtin: _b, ...rest } = t as Template & { builtin?: boolean };
                                navigator.clipboard?.writeText(encodePrompts([rest])).then(
                                  () => toast("分享码已复制，发给好友即可导入", "success"),
                                  () => toast("复制失败", "error")
                                );
                              }}
                              className="text-stone-300 transition hover:text-brand-500"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            title={fav ? "取消收藏" : "收藏"}
                            onClick={() => toggleFavorite(t.id)}
                            className="text-stone-300 transition hover:text-amber-400"
                          >
                            {fav ? (
                              <BookmarkCheck className="h-4 w-4 text-brand-600" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      {thumb && (
                        <button
                          onClick={() =>
                            setZoomCase({
                              image: thumb.image!,
                              label: thumb.label,
                              prompt: applyVariables(t.prompt, thumb.values),
                            })
                          }
                          title="查看真实效果图"
                          className="mb-2 block w-full overflow-hidden rounded-lg border border-stone-100 bg-stone-50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumb.image}
                            alt={thumb.label}
                            loading="lazy"
                            className="h-32 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        </button>
                      )}
                      <p className="mb-3 line-clamp-2 min-h-[2rem] text-xs leading-relaxed text-stone-400">
                        {t.prompt.length > 90 ? t.prompt.slice(0, 90) + "…" : t.prompt}
                      </p>
                      {cases.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {cases.map((c) => (
                            <span
                              key={c.label}
                              className="flex items-center overflow-hidden rounded-full border border-brand-200 bg-brand-50 text-[11px] text-brand-700"
                            >
                              <button
                                onClick={() => makeSame(t, c)}
                                title="做同款：把该案例填入输入框（不发送）"
                                className="flex items-center gap-1 px-2 py-0.5 transition hover:bg-brand-100"
                              >
                                <Sparkles className="h-3 w-3" /> {c.label}
                              </button>
                              <button
                                onClick={() =>
                                  setZoomCase({
                                    image: c.image,
                                    label: c.label,
                                    prompt: applyVariables(t.prompt, c.values),
                                    output: c.output,
                                    source: c.source,
                                  })
                                }
                                title="查看真实效果"
                                className="border-l border-brand-200 px-1.5 py-0.5 transition hover:bg-brand-100"
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => void shareCase(t, c)}
                                title="分享该真实案例（生成公开链接）"
                                className="border-l border-brand-200 px-1.5 py-0.5 transition hover:bg-brand-100"
                              >
                                <Share2 className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto flex items-center gap-2">
                        <button
                          disabled={sending}
                          onClick={() => {
                            const vars = extractVariables(t.prompt);
                            if (vars.length) {
                              setRunning(t);
                              setVarValues(Object.fromEntries(vars.map((v) => [v, ""])));
                            } else {
                              doRun(t, {});
                            }
                          }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-40"
                        >
                          <Play className="h-3 w-3" /> 使用
                        </button>
                        {isMine && (
                          <button
                            title="删除"
                            onClick={() => {
                              removeCustom(t.id);
                              toast("已删除", "info");
                            }}
                            className="rounded-lg border border-stone-200 p-1.5 text-stone-400 transition hover:border-red-300 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 变量填空 */}
      {running && (
        <VariableDialog
          template={running}
          values={varValues}
          onChange={setVarValues}
          onCancel={() => setRunning(null)}
          onConfirm={() => doRun(running, varValues)}
        />
      )}

      {/* 效果图放大查看 */}
      {zoomCase && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6" onClick={() => setZoomCase(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{zoomCase.label}</span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">真实案例</span>
              </div>
              <button onClick={() => setZoomCase(null)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {zoomCase.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={zoomCase.image} alt={zoomCase.label} className="w-full" />
                </>
              ) : (
                <div className="bg-stone-900 px-4 py-4">
                  <p className="mb-1 text-[11px] font-medium text-stone-400">真实输出（节选）</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-100">{zoomCase.output}</p>
                </div>
              )}
              <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                <p className="mb-1 text-[11px] font-medium text-stone-400">
                  对应的真实提示词{zoomCase.source ? ` · ${zoomCase.source}` : ""}
                </p>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-stone-600">{zoomCase.prompt}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreatePromptDialog
          onClose={() => setShowCreate(false)}
          onSave={(p) => {
            addCustom(p);
            setShowCreate(false);
            setTab("mine");
            toast("已保存到「我的提示词」", "success");
          }}
        />
      )}

      {showAI && (
        <AIPromptDialog
          onClose={() => setShowAI(false)}
          onSave={(p) => {
            addCustom(p);
            setShowAI(false);
            setTab("mine");
            toast("AI 提示词已保存到「我的提示词」", "success");
          }}
        />
      )}

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onImport={(list) => importPrompts(list)}
          onFile={onImportFile}
          onCase={(c) => {
            const p = decodeCaseShare(c);
            if (!p) return false;
            const t =
              TEMPLATES.find((x) => x.id === p.templateId) ?? custom.find((x) => x.id === p.templateId);
            if (!t) {
              toast("找不到对应的模板，无法做同款", "error");
              return false;
            }
            setShowImport(false);
            close();
            void fillTemplate({ mode: t.mode, prompt: applyVariables(t.prompt, p.values) });
            toast(`已载入同款「${t.label}」，确认后发送`, "success");
            return true;
          }}
        />
      )}
    </div>
  );
}

/** AI 生成提示词弹窗：描述需求 → AI 产出完整提示词 → 存入我的提示词 */
function AIPromptDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (p: Omit<Template, "id" | "builtin">) => void;
}) {
  const [need, setNeed] = useState("");
  const [mode, setMode] = useState<WorkspaceMode>("chat");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const aiStream = useSseStream();

  const generate = async () => {
    const raw = need.trim();
    if (!raw || busy) return;
    setBusy(true);
    setResult("");
    const ov = getOverrides();
    const hasModel = Object.values(ov).some((p) => p?.apiKey);
    try {
      if (hasModel) {
        // AI15：SSE 读取收敛进 useSseStream，onEvent 里同步渲染进度
        const acc = await aiStream.start({
          url: "/api/chat",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "demo",
            overrides: ov,
            messages: [
              {
                role: "system",
                content:
                  "你是提示词工程专家。根据用户的粗略需求，产出一条高质量、可直接复用的中文提示词：包含角色设定、任务描述、输入变量（用 {{变量名}} 标注需要用户每次替换的部分）、输出格式与约束。只输出提示词本身，不要解释。",
              },
              { role: "user", content: `用途场景：${mode}。需求：${raw}` },
            ],
          }),
        });
        if (acc.trim()) {
          setResult(acc.trim());
          return;
        }
      }
      // 本地兜底：结构化提示词模板
      const modeOut: Record<string, string> = {
        image: "输出英文绘图提示词（主体+风格+构图+光线+画质词，逗号分隔）",
        slides: "输出幻灯片结构（标题 + 每页标题与要点）",
        research: "从背景、现状、数据、玩家、趋势、结论展开",
        docs: "输出完整文档结构（标题、导语、分小节、结论）",
        video: "输出分镜表（镜头时长/画面/旁白/字幕）",
        chat: "分点作答，含步骤与示例",
      };
      const fallback = `# 角色
你是{{领域}}方面的资深专家，有丰富的实战经验。

# 任务
${raw}
涉及的具体对象：{{主题}}

# 要求
- 面向受众：{{受众}}
- 语言：中文，专业且易懂
- 输出格式：${modeOut[mode] ?? modeOut.chat}
- 约束：内容准确、结构清晰、可直接使用；必要处给出示例

# 输入
{{用户输入}}`;
      setResult(fallback);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!result.trim()) return;
    onSave({
      label: need.trim().slice(0, 20) || "AI 生成提示词",
      desc: `AI 生成 · ${MODE_TAG[mode]}`,
      category: "productivity",
      mode,
      prompt: result.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Bot className="h-4 w-4 text-brand-600" /> AI 帮我写提示词
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">你想用这个提示词做什么？</label>
            <textarea
              autoFocus
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              rows={3}
              placeholder="例如：帮我批量生成小红书风格的产品种草文案，要有标题和标签"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">用于哪个工作台</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as WorkspaceMode)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            >
              {(Object.keys(MODE_TAG) as WorkspaceMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_TAG[m]}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void generate()}
            disabled={!need.trim() || busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "AI 正在撰写提示词…" : "生成提示词"}
          </button>
          {result && (
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">生成结果（可编辑后保存）</label>
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-brand-400"
              />
              <button
                onClick={save}
                className="mt-2 w-full rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                保存到「我的提示词」
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 导入弹窗：粘贴分享码或上传 JSON 文件 */
function ImportDialog({
  onClose,
  onImport,
  onFile,
  onCase,
}: {
  onClose: () => void;
  onImport: (list: Array<Omit<Template, "id" | "builtin">>) => void;
  onFile: (f: File) => void;
  onCase: (code: string) => boolean;
}) {
  const [code, setCode] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const doPaste = () => {
    // 先尝试「做同款」案例码，再尝试提示词分享码
    if (onCase(code)) {
      onClose();
      return;
    }
    const parsed = decodePrompts(code);
    if (!parsed) {
      toast("分享码无效，请检查后重试", "error");
      return;
    }
    onImport(parsed.prompts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Share2 className="h-4 w-4 text-brand-600" /> 导入提示词
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">粘贴分享码</label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={4}
              placeholder="粘贴好友分享的提示词码（一长串字符）…"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono text-xs outline-none focus:border-brand-400"
            />
            <button
              onClick={doPaste}
              disabled={!code.trim()}
              className="mt-2 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              导入
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-300">
            <span className="h-px flex-1 bg-stone-200" /> 或 <span className="h-px flex-1 bg-stone-200" />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-600 hover:border-brand-300 hover:bg-brand-50/40"
          >
            <Upload className="h-4 w-4" /> 选择 JSON 备份文件
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** 变量填空弹窗 */
function VariableDialog({
  template,
  values,
  onChange,
  onCancel,
  onConfirm,
}: {
  template: Template;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const vars = extractVariables(template.prompt);
  const filled = vars.every((v) => values[v]?.trim());
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <Star className="h-4 w-4 text-brand-600" /> {template.label}
        </div>
        <p className="mb-4 text-xs text-stone-400">填写下面的内容，替换提示词中的变量</p>
        <div className="space-y-3">
          {vars.map((v) => (
            <div key={v}>
              <label className="mb-1 block text-xs font-medium text-stone-500">{v}</label>
              <textarea
                value={values[v] ?? ""}
                autoFocus
                rows={2}
                onChange={(e) => onChange({ ...values, [v]: e.target.value })}
                placeholder={`请输入${v}`}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-stone-200 px-4 py-2 text-sm hover:bg-stone-50">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!filled}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            开始生成
          </button>
        </div>
      </div>
    </div>
  );
}

/** 新建提示词 */
function CreatePromptDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (p: Omit<Template, "id" | "builtin">) => void;
}) {
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("productivity");
  const [mode, setMode] = useState<WorkspaceMode>("chat");
  const [prompt, setPrompt] = useState("");

  const canSave = label.trim() && prompt.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4 text-brand-600" /> 新建提示词
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">名称</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="如：小红书爆款标题"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">工作台</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as WorkspaceMode)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                {(Object.keys(MODE_TAG) as WorkspaceMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_TAG[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">一句话说明</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="这个提示词用来做什么"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">
              提示词内容（可用 {"{{变量名}}"} 作为填空）
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="例：为「{{产品}}」写 5 条小红书种草文案，每条含标题、正文和标签…"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm hover:bg-stone-50">
            取消
          </button>
          <button
            disabled={!canSave}
            onClick={() =>
              onSave({ label: label.trim(), desc: desc.trim() || "自定义", category, mode, prompt: prompt.trim() })
            }
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
