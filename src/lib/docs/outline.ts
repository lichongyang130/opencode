/** DOC4: 大纲解析。按 # 标题层级生成可跳转目录，无标题文档给出空数组 */

export interface DocOutlineItem {
  level: number; // 1-6
  text: string;
  /** 该标题在原文中的行索引，用于编辑区滚动定位 */
  line: number;
  /** 目录缩进级别（0-3），由 normalizeLevels 计算 */
  indent?: number;
}

const HEADING = /^(#{1,6})\s+(.*)$/;

/** 代码围栏内的 # 不是标题，必须跳过（与 Markdown.tsx 渲染口径一致） */
export function parseOutline(md: string): DocOutlineItem[] {
  const items: DocOutlineItem[] = [];
  let inCode = false;
  md.split("\n").forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      return;
    }
    if (inCode) return;
    const m = line.match(HEADING);
    if (m) {
      items.push({ level: m[1].length, text: m[2].trim(), line: i });
    }
  });
  return items;
}

/** DOC4: 大纲文本的显示层级压缩。若文档只有 ## / ###（跳过一），把最小层级映射到目录顶层，
 *  避免整棵目录树缩进到看不见。保持相对层级关系不变。 */
export function normalizeLevels(items: DocOutlineItem[]): DocOutlineItem[] {
  if (items.length === 0) return items;
  const min = Math.min(...items.map((i) => i.level));
  // 等级差 > 3 时压缩（缩进最多三级），否则原样
  return items.map((i) => ({ ...i, indent: Math.min(3, i.level - min) }));
}

/** DOC3: 从文档内容定位选区所属段落边界（行级），返回 [start, end] 字符偏移。
 *  若选区文本在文中出现多次，取第一次出现——UI 侧保证传入选区原文。 */
export function findSelectionRange(content: string, selection: string): [number, number] | null {
  const start = content.indexOf(selection);
  if (start < 0) return null;
  return [start, start + selection.length];
}