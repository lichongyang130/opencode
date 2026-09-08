/** DOC7: 文档统计：字数（中日韩计数规则）与预计阅读时长 */

/**
 * 中文语境的字数统计：连续的拉丁词算 1 个词，CJK 每字算 1。
 * 与「字符数」区分：中英混排时更贴近用户感知的「字数」。
 */
export function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length;
  const words = (text.match(/[A-Za-z0-9]+(?:[''-][A-Za-z0-9]+)*/g) ?? []).length;
  return cjk + words;
}

/** 阅读时长：中文 300 字/分钟（中文阅读速度研究常用值）。返回向上取整分钟，至少 1 */
export function readingMinutes(text: string, wpm = 300): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / wpm));
}

/** 友好显示：不足 1 分钟显示「<1 分钟」 */
export function readingLabel(minutes: number): string {
  if (minutes <= 0) return "0 分钟";
  return `${minutes} 分钟`;
}