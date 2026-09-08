import type { Slide, SlideDeck } from "./types";
import { themeOrDefault, VALID_LAYOUTS } from "./prompt";
import { looseParseJson } from "@/lib/json-loose";

const LAYOUT_SET = new Set<string>(VALID_LAYOUTS);

export interface SlideParseResult {
  deck: SlideDeck;
  /** 走了纯文本兜底（模型输出完全不是 JSON），内容质量不保证 */
  degraded: boolean;
  /** 动过 JSON 修复（截断补齐等），内容可能不完整 */
  repaired: boolean;
}

function toSlide(s: Record<string, unknown>): Slide {
  return {
    layout: s.layout as Slide["layout"],
    title: typeof s.title === "string" ? s.title : undefined,
    subtitle: typeof s.subtitle === "string" ? s.subtitle : undefined,
    bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : undefined,
    bulletsRight: Array.isArray(s.bulletsRight) ? s.bulletsRight.map(String) : undefined,
    twoColTitle: typeof s.twoColTitle === "string" ? s.twoColTitle : undefined,
    stats: Array.isArray(s.stats)
      ? s.stats
          .map((x) => x as Record<string, unknown>)
          .filter((x) => x && typeof x.value !== "undefined")
          .map((x) => ({ value: String(x.value), label: String(x.label ?? "") }))
      : undefined,
    // PPT5：timeline/process 的阶段/步骤
    steps: Array.isArray(s.steps)
      ? s.steps
          .map((x) => x as Record<string, unknown>)
          .filter((x) => x && typeof x.item !== "undefined")
          .map((x) => ({
            item: String(x.item).slice(0, 60),
            detail: typeof x.detail === "string" ? x.detail.slice(0, 120) : undefined,
          }))
      : undefined,
    // PPT5：quote 版式
    quote: typeof s.quote === "string" ? s.quote : undefined,
    quoteBy: typeof s.quoteBy === "string" ? s.quoteBy : undefined,
    // PPT3：配图回填（生成后由 store 写入，解析层同样透传）
    imageUrl: typeof s.imageUrl === "string" ? s.imageUrl : undefined,
    imagePrompt: typeof s.imagePrompt === "string" ? s.imagePrompt : undefined,
    note: typeof s.note === "string" ? s.note : undefined,
  };
}

/** 保证首尾页齐全，否则导出的 PPTX 会缺封面/结束页 */
function withCoverAndEnd(slides: Slide[], title: string): Slide[] {
  const out = [...slides];
  if (out[0]?.layout !== "cover") out.unshift({ layout: "cover", title });
  if (out[out.length - 1]?.layout !== "end") out.push({ layout: "end", title: "谢谢观看" });
  return out;
}

/**
 * 纯文本兜底：模型完全没按 JSON 输出时，按 Markdown 标题与列表切页。
 * 宁可给一份粗糙但可编辑的 PPT，也不要让用户面对一句「生成失败」白等一场。
 */
function deckFromText(raw: string, fallbackTitle: string): Slide[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const slides: Slide[] = [];
  let current: Slide | null = null;
  const pushCurrent = () => {
    if (current && (current.title || current.bullets?.length)) slides.push(current);
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.*)$/) ?? line.match(/^(?:\d+[.、)]|[一二三四五六七八九十]+[、.])\s*(.*)$/);
    if (heading && heading[1]) {
      pushCurrent();
      current = { layout: "content", title: heading[1].slice(0, 60), bullets: [] };
      continue;
    }
    const bullet = line.match(/^(?:[-*+•]|\d+[.、)])\s+(.*)$/);
    const text = (bullet?.[1] ?? line).slice(0, 160);
    if (!text) continue;
    if (!current) current = { layout: "content", title: fallbackTitle.slice(0, 60), bullets: [] };
    // 单页要点过多会排版溢出，满 6 条就翻页
    if ((current.bullets?.length ?? 0) >= 6) {
      pushCurrent();
      current = { layout: "content", title: `${current.title ?? fallbackTitle}（续）`, bullets: [] };
    }
    current.bullets?.push(text);
  }
  pushCurrent();

  if (slides.length === 0) {
    slides.push({
      layout: "content",
      title: fallbackTitle.slice(0, 60),
      bullets: [raw.trim().slice(0, 160) || "模型未返回可用内容，请重新生成"],
    });
  }
  return slides;
}

/**
 * 从 LLM 输出中提取并校验幻灯片 JSON。
 *
 * 三级降级：合法 JSON → 修复后的 JSON（截断/尾随逗号）→ 纯文本切页。
 * 任何一级都不抛错，调用方靠 degraded / repaired 决定要不要提示用户。
 */
export function parseSlideDeck(raw: string, fallbackTitle = "未命名演示"): SlideParseResult {
  const { value: obj, repaired } = looseParseJson(raw);

  const title =
    typeof obj?.title === "string" && obj.title ? (obj.title as string) : fallbackTitle;
  const theme = themeOrDefault(typeof obj?.theme === "string" ? (obj.theme as string) : undefined);
  const subtitle = typeof obj?.subtitle === "string" ? (obj.subtitle as string) : undefined;

  const rawSlides = Array.isArray(obj?.slides) ? (obj!.slides as unknown[]) : [];
  const slides: Slide[] = rawSlides
    .map((s) => s as Record<string, unknown>)
    .filter((s) => s && LAYOUT_SET.has(String(s.layout)))
    .map(toSlide);

  if (slides.length > 0) {
    return {
      deck: { title, subtitle, theme, slides: withCoverAndEnd(slides, title) },
      degraded: false,
      repaired,
    };
  }

  return {
    deck: {
      title,
      subtitle,
      theme,
      slides: withCoverAndEnd(deckFromText(raw, title), title),
    },
    degraded: true,
    repaired,
  };
}
