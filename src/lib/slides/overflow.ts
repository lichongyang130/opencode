import type { Slide } from "./types";

/**
 * PPT11：单页文字溢出检测。
 *
 * 思路：每页容量近似为「行数 × 每行字数」，超出容量判定溢出。
 * 渲染端字号用 cqw 相对单位（如 2.3cqw ≈ 16:9 画布宽度的 2.3%），
 * 每行可容纳的汉字数约为 100 / 字号cqw；行高约 1.5 倍，可容纳行数
 * 由内容区高度（约 60% 画布高）推得。这里给出保守估计并留 10% 余量。
 */

/** 各版式正文区的容量配置：[每行字数, 最多行数] */
const CAPACITY: Record<string, [number, number]> = {
  toc: [28, 6],
  content: [40, 9],
  twoCol: [20, 7],
  stats: [12, 4], // 每卡 label 行
  timeline: [14, 4],
  compare: [20, 7],
  process: [14, 4],
  quote: [30, 3],
  team: [12, 3],
};

/** 单页估算占用行数：要点按换行折算，长句拆多行 */
function estimateLines(text: string, perLine: number): number {
  if (!text) return 0;
  return Math.ceil(text.length / perLine);
}

export interface OverflowReport {
  /** 估算行数 */
  lines: number;
  /** 该版式容量行数 */
  capacity: number;
  /** 是否溢出 */
  overflow: boolean;
  /** 建议动作文案（无溢出为空串） */
  hint: string;
}

/** 检测单页是否文字溢出，给出缩排/精简建议 */
export function checkSlideOverflow(slide: Slide): OverflowReport {
  const cap = CAPACITY[slide.layout] ?? [40, 9];
  const [perLine, maxLines] = cap;

  let lines = 0;
  switch (slide.layout) {
    case "toc":
    case "content":
      lines = (slide.bullets ?? []).reduce((n, b) => n + estimateLines(b, perLine), 0);
      break;
    case "twoCol":
    case "compare": {
      const l = (slide.bullets ?? []).reduce((n, b) => n + estimateLines(b, perLine), 0);
      const r = (slide.bulletsRight ?? []).reduce((n, b) => n + estimateLines(b, perLine), 0);
      // 双栏取较高一侧（另一侧不影响排版）
      lines = Math.max(l, r);
      break;
    }
    case "stats":
    case "team":
      lines = (slide.stats ?? []).reduce((n, s) => n + estimateLines(s.label, perLine), 0);
      break;
    case "timeline":
    case "process":
      lines = (slide.steps ?? []).reduce(
        (n, s) => n + estimateLines(s.item, perLine) + estimateLines(s.detail ?? "", perLine),
        0
      );
      break;
    case "quote":
      lines = estimateLines(slide.quote ?? "", perLine);
      break;
    default:
      lines = 0;
  }

  const overflow = lines > maxLines;
  return {
    lines,
    capacity: maxLines,
    overflow,
    hint: overflow
      ? `本页约 ${lines} 行，超出容量 ${maxLines} 行：建议精简要点或拆成两页`
      : "",
  };
}

/** 整份 deck 的溢出页清单（index → 报告），供批量提示 */
export function checkDeckOverflow(slides: Slide[]): Record<number, OverflowReport> {
  const out: Record<number, OverflowReport> = {};
  slides.forEach((s, i) => {
    const r = checkSlideOverflow(s);
    if (r.overflow) out[i] = r;
  });
  return out;
}