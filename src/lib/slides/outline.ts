import type { SlideDeck, SlideOutline } from "./types";
import { looseParseJson } from "@/lib/json-loose";
import { VALID_LAYOUTS } from "./prompt";

/** PPT1: 解析大纲阶段输出（宽松 JSON；失败返回 null 让调用方走错误路径） */
export function parseOutline(raw: string): SlideOutline | null {
  const { value } = looseParseJson(raw);
  if (!value || !Array.isArray(value.pages)) return null;
  const pages = (value.pages as unknown[])
    .map((x) => x as Record<string, unknown>)
    .filter((x) => x && typeof x.title === "string" && VALID_LAYOUTS.includes(String(x.layout) as never))
    .map((x) => ({
      layout: String(x.layout) as SlideOutline["pages"][number]["layout"],
      title: (x.title as string).slice(0, 60),
      hint: typeof x.hint === "string" ? x.hint.slice(0, 120) : undefined,
    }));
  if (pages.length === 0) return null;
  return {
    title: typeof value.title === "string" ? value.title : "未命名演示",
    subtitle: typeof value.subtitle === "string" ? value.subtitle : undefined,
    pages,
  };
}

/** PPT1: 大纲 → 成稿生成上下文。把确认后的页面骨架拼成指令文本喂给成稿阶段 */
export function outlineToContext(outline: SlideOutline): string {
  const lines = outline.pages.map(
    (p, i) =>
      `第 ${i + 1} 页 [${p.layout}] ${p.title}${p.hint ? ` —— ${p.hint}` : ""}`
  );
  return [
    `演示标题：${outline.title}`,
    outline.subtitle ? `副标题：${outline.subtitle}` : "",
    "已确认的页面结构（严格按此结构生成，不要增删页面顺序）：",
    ...lines.filter(Boolean),
  ].join("\n");
}

/** PPT9: 封面副标题与日期自动填充。无副标题时补日期；有则追加日期后缀（幂等：已含当日不重复加） */
export function fillCoverMeta(deck: SlideDeck): SlideDeck {
  const dateStr = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const slides = deck.slides.map((s) => {
    if (s.layout !== "cover") return s;
    const sub = s.subtitle?.trim();
    if (!sub) return { ...s, subtitle: dateStr };
    if (sub.includes(dateStr)) return s; // 已含当日日期，不重复追加
    return { ...s, subtitle: `${sub} · ${dateStr}` };
  });
  return { ...deck, slides };
}