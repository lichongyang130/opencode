/**
 * 宽松 JSON 解析：专门用来消化大模型输出。
 *
 * 模型「只输出 JSON」的指令并不可靠，实际最常见的三种坏输出是：
 *   1. 裹在 ```json 围栏或前后带一段解释文字；
 *   2. 被 max_tokens 截断，末尾少了若干 } ]，甚至断在字符串中间；
 *   3. 末尾多一个逗号（尾随逗号 JSON 不合法）。
 * 这三种情况都还留有大部分可用内容，直接 JSON.parse 抛错等于把整次生成丢掉，
 * 所以这里逐级降级修复，尽最大努力抢救出对象（R10）。
 */

/**
 * 从 start 处的 `{` 出发找到与之配对的右括号下标；始终没配平则返回 -1。
 *
 * 必须逐字符扫描并跳过字符串字面量里的括号：早先图省事用 lastIndexOf("}")，
 * 遇到「输出被截断 + 已生成内容里出现过 }」就会停在那个内部括号上，
 * 把后面的可用内容一起裁掉（实测会让截断的 deck 直接少掉整整一页）。
 */
function matchingBraceEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth += 1;
    else if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 剥掉 markdown 代码围栏，并截取最外层花括号包裹的部分 */
function extractObjectText(raw: string): string {
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf("{");
  if (start === -1) return text;
  const end = matchingBraceEnd(text, start);
  // 没配平说明被截断了，保留到末尾交给 repairTruncated 补齐
  return end === -1 ? text.slice(start) : text.slice(start, end + 1);
}

/** 去掉 `,}` `,]` 这类尾随逗号 */
function dropTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * 补齐被截断的 JSON。
 * 逐字符扫描以正确跳过字符串内的括号与转义，再按括号栈逆序补齐。
 */
function repairTruncated(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }

  let out = text;
  // 断在字符串中间：先把引号闭上，这一项的值虽被截短但仍然可读
  if (inString) out += '"';

  out = out.replace(/\s+$/, "");
  // 断在 key 与 value 之间（`..., "heading":`）：整个键值对没有内容，直接丢掉
  out = out.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
  // 断在逗号后：后面本该还有一项，去掉悬空逗号
  out = out.replace(/,\s*$/, "");

  for (let i = stack.length - 1; i >= 0; i -= 1) {
    out += stack[i] === "{" ? "}" : "]";
  }
  return out;
}

export interface LooseParseResult {
  value: Record<string, unknown> | null;
  /** 是否动用了修复手段（调用方可据此提示用户内容可能不完整） */
  repaired: boolean;
}

/** 尽力把模型输出解析成对象；彻底失败时返回 value: null，不抛错 */
export function looseParseJson(raw: string): LooseParseResult {
  const base = extractObjectText(raw);
  const attempts: Array<{ text: string; repaired: boolean }> = [
    { text: base, repaired: false },
    { text: dropTrailingCommas(base), repaired: true },
    { text: repairTruncated(base), repaired: true },
    { text: dropTrailingCommas(repairTruncated(base)), repaired: true },
  ];

  for (const { text, repaired } of attempts) {
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as unknown;
      // 数组或标量都不是调用方要的形状，继续尝试后面的修复策略
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { value: parsed as Record<string, unknown>, repaired };
      }
    } catch {
      // 换下一种修复策略
    }
  }
  return { value: null, repaired: false };
}