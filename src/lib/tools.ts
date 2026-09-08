import {
  BarChart3,
  Braces,
  Calculator,
  Dices,
  Download,
  Ruler,
  FileImage,
  FileText,
  GitBranch,
  KeyRound,
  Link2,
  ListChecks,
  MessageSquareQuote,
  QrCode as QrCodeIcon,
  Scissors,
  Send,
  Sparkles,
  Table2,
  Type,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { readJSON, writeJSON } from "@/lib/safe-storage";

/**
 * 工具箱注册表。
 * - local：纯前端计算，离线可用
 * - ai：调用 /api/chat 流式生成（未配密钥时走内置演示模型）
 * - watermark / share / task：用到浏览器或现有服务端的专项工具
 * - pdf / ocr：走服务端接口（pdf-lib / 视觉模型）
 * - board / matrix：带独立界面的轻量协作工具
 * - unsupported：确实依赖服务端账号体系，界面上会说明原因并给出替代方案
 */

export type ToolKind =
  | "local"
  | "ai"
  | "watermark"
  | "share"
  | "task"
  | "pdf"
  | "ocr"
  | "board"
  | "matrix"
  | "qr"
  | "gallery"
  | "unsupported";

export interface ToolResult {
  output: string;
  /** 结果下方的一行说明（如压缩率、去重条数） */
  note?: string;
  /** 需要渲染的 HTML（目前用于图表） */
  html?: string;
  /** 结果图片的 dataURL（水印工具） */
  image?: string;
  /** 下载建议扩展名 */
  ext?: string;
}

export interface ToolOption {
  label: string;
  choices: { value: string; label: string }[];
  default: string;
}

export interface ToolDef {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  tint: string;
  bg: string;
  category: string;
  kind: ToolKind;
  /** 输入框占位提示 */
  hint: string;
  /** 运行按钮文案 */
  action?: string;
  /** kind=ai 的系统提示词 */
  system?: string;
  /** kind=local 的处理函数 */
  run?: (input: string, opt?: string) => ToolResult;
  /** 选项下拉（如转换目标格式） */
  option?: ToolOption;
  /** 预设示例，方便一键试用 */
  sample?: string;
  /** kind=unsupported 的原因与替代方案 */
  reason?: string;
  /** 替代方案的提示词（跳到对话用 AI 完成） */
  fallbackPrompt?: string;
}

/* ══════════════ 纯前端工具实现 ══════════════ */

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 极简 Markdown → HTML */
function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  const inline = (t: string) =>
    esc(t)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("```")) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(`${esc(line)}\n`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const lv = h[1].length;
      out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    if (!line.trim()) continue;
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) out.push("</code></pre>");
  if (inList) out.push("</ul>");
  return out.join("\n");
}

/** HTML → 纯文本/Markdown */
function htmlToText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(h[1-6]|p|li|div|tr)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  return s
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 压缩文本：去掉多余空行与行尾空格 */
function minifyText(input: string): ToolResult {
  const before = input.length;
  const out = input
    .split("\n")
    .map((l) => l.replace(/\s+$/, "").replace(/\s{2,}/g, " "))
    .filter((l, i, arr) => !(l.trim() === "" && arr[i - 1]?.trim() === ""))
    .join("\n")
    .trim();
  const saved = before ? Math.round(((before - out.length) / before) * 100) : 0;
  return {
    output: out,
    note: `原 ${before} 字符 → 现 ${out.length} 字符，减少 ${saved}%`,
  };
}

/** 文本统计 */
function textStats(input: string): ToolResult {
  const chars = input.length;
  const charsNoSpace = input.replace(/\s/g, "").length;
  const lines = input.split("\n").length;
  const paragraphs = input.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const chinese = (input.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = (input.match(/[A-Za-z0-9_'-]+/g) ?? []).length;
  const freq = new Map<string, number>();
  for (const w of input.match(/[\u4e00-\u9fa5]{2,}|[A-Za-z][A-Za-z0-9'-]{1,}/g) ?? []) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const lines10 = Math.max(1, lines);
  const report = [
    `字符数（含空格）：${chars}`,
    `字符数（不含空格）：${charsNoSpace}`,
    `中文字数：${chinese}`,
    `英文单词数：${words}`,
    `行数：${lines}`,
    `段落数：${paragraphs}`,
    `预计朗读时长：约 ${Math.max(1, Math.round(chinese / 300 + words / 180))} 分钟`,
    "",
    "高频词 Top15：",
    ...top.map(([w, n], i) => `${i + 1}. ${w} × ${n}`),
    "",
    `平均每行 ${(chars / lines10).toFixed(1)} 字符`,
  ].join("\n");
  return { output: report };
}

/** 去重：保留首次出现顺序 */
function dedupeLines(input: string): ToolResult {
  const lines = input.split("\n");
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const l of lines) {
    const k = l.trim();
    if (!k) {
      kept.push(l);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    kept.push(l);
  }
  return {
    output: kept.join("\n"),
    note: `原 ${lines.length} 行 → 现 ${kept.length} 行，去重 ${lines.length - kept.length} 行`,
  };
}

function splitTable(input: string): string[][] {
  const rows: string[][] = [];
  for (const raw of input.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\|?[\s:-]*\|[\s:|-]*$/.test(line) && line.includes("-")) continue; // 分隔行
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/\t|\||,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
    rows.push(cells);
  }
  return rows;
}

function mdToCsv(input: string): ToolResult {
  const rows = splitTable(input);
  if (rows.length === 0) return { output: "", note: "没有解析到表格内容" };
  const csv = rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
  return { output: csv, note: `共 ${rows.length} 行 ${Math.max(...rows.map((r) => r.length))} 列`, ext: "csv" };
}

function csvToMd(input: string): ToolResult {
  const rows = splitTable(input);
  if (rows.length === 0) return { output: "", note: "没有解析到表格内容" };
  const cols = Math.max(...rows.map((r) => r.length));
  const head = rows[0];
  const body = rows.slice(1);
  const line = (cells: string[]) => `| ${Array.from({ length: cols }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  const md = [line(head), `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`, ...body.map(line)].join("\n");
  return { output: md, note: `共 ${body.length} 行数据 / ${cols} 列`, ext: "md" };
}

function toJson(input: string): ToolResult {
  const rows = splitTable(input);
  if (rows.length < 2) return { output: JSON.stringify(rows, null, 2), note: "未识别到表头，按原始行导出" };
  const head = rows[0];
  const data = rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h || `col${i + 1}`, r[i] ?? ""])));
  return { output: JSON.stringify(data, null, 2), note: `共 ${data.length} 条记录`, ext: "json" };
}

/** 数据可视化：每行「名称,数值」→ SVG 柱状图 */
function barChart(input: string): ToolResult {
  const rows = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.split(/[,，\t]/).map((s) => s.trim());
      if (m.length < 2) {
        const m2 = l.match(/^(.*?)[\s:：]+(-?\d+(?:\.\d+)?)$/);
        return m2 ? { label: m2[1], value: Number(m2[2]) } : null;
      }
      const value = Number(m[m.length - 1].replace(/[^\d.-]/g, ""));
      if (Number.isNaN(value)) return null;
      return { label: m.slice(0, -1).join(" "), value };
    })
    .filter((x): x is { label: string; value: number } => Boolean(x));

  if (rows.length === 0) {
    return { output: "", note: "没解析到数据，请每行写「名称,数值」，例如：北京,120" };
  }

  const W = 640;
  const rowH = 34;
  const H = rows.length * rowH + 40;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const labelW = 120;
  const bars = rows
    .map((r, i) => {
      const y = i * rowH + 16;
      const w = Math.max(2, (Math.abs(r.value) / max) * (W - labelW - 90));
      return [
        `<text x="${labelW - 8}" y="${y + 15}" text-anchor="end" font-size="13" fill="#57534e">${esc(r.label)}</text>`,
        `<rect x="${labelW}" y="${y}" width="${w}" height="18" rx="4" fill="#f97316" opacity="0.85" />`,
        `<text x="${labelW + w + 8}" y="${y + 15}" font-size="12" fill="#78716c">${r.value}</text>`,
      ].join("");
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fdfaf6" rx="12" />
  <text x="16" y="24" font-size="13" fill="#a8a29e">数据可视化 · 共 ${rows.length} 项，最大值 ${max}</text>
  ${bars}
</svg>`;
  return {
    output: rows.map((r) => `${r.label}\t${r.value}`).join("\n"),
    html: svg,
    note: `共 ${rows.length} 项数据，最大值 ${max}（可复制下方结果或直接下载 SVG）`,
  };
}

/** 文本版本快照（localStorage） */
const VERSION_KEY = "oc:tool-versions";
type Snapshot = { ts: number; len: number; head: string; text: string };
function saveVersion(input: string): ToolResult {
  if (!input.trim()) return { output: "", note: "请输入内容后再保存版本" };
  const saved = readJSON<Snapshot[]>(VERSION_KEY, []);
  let list: Snapshot[] = Array.isArray(saved) ? saved : [];
  list.unshift({
    ts: Date.now(),
    len: input.length,
    head: input.trim().split("\n")[0].slice(0, 30),
    text: input,
  });
  list = list.slice(0, 20);
  writeJSON(VERSION_KEY, list);
  const out = list
    .map(
      (v, i) =>
        `${i === 0 ? "●" : "○"} v${list.length - i} · ${new Date(v.ts).toLocaleString("zh-CN", { hour12: false })} · ${v.len} 字符 · ${v.head}`
    )
    .join("\n");
  return { output: out, note: `已保存 v${list.length}，共保留 ${list.length} 个版本（存于本机浏览器）` };
}

/* ══════════════ 注册表 ══════════════ */

/* ────────── 本地工具的纯函数实现 ────────── */

const TOOL_USAGE_KEY = "oc:tool-usage.v1";

/** 工具打开次数计数（设置中心「使用习惯」面板读取） */
export function recordToolUsage(id: string): void {
  const map = readJSON<Record<string, number>>(TOOL_USAGE_KEY, {});
  map[id] = (map[id] ?? 0) + 1;
  writeJSON(TOOL_USAGE_KEY, map);
}

/** 读取工具使用次数统计 */
export function loadToolUsage(): Record<string, number> {
  return readJSON<Record<string, number>>(TOOL_USAGE_KEY, {});
}

/** 安全表达式求值：递归下降，支持 + - * / % ^ 与括号，不使用 eval */
export function evalExpression(src: string): number {
  const s = src
    .replace(/×|x(?=\d|\(|\))/gi, "*")
    .replace(/÷/g, "/")
    .replace(/[,，\s]/g, "");
  let pos = 0;
  const eat = (ch: string) => {
    if (s[pos] === ch) {
      pos += 1;
      return true;
    }
    return false;
  };
  const parseExpr = (): number => {
    let v = parseTerm();
    for (;;) {
      if (eat("+")) v += parseTerm();
      else if (eat("-")) v -= parseTerm();
      else return v;
    }
  };
  const parseTerm = (): number => {
    let v = parseFactor();
    for (;;) {
      if (eat("*")) v *= parseFactor();
      else if (eat("/")) {
        const d = parseFactor();
        if (d === 0) throw new Error("除数不能为 0");
        v /= d;
      } else if (eat("%")) v %= parseFactor();
      else return v;
    }
  };
  const parseFactor = (): number => {
    if (eat("+")) return parseFactor();
    if (eat("-")) return -parseFactor();
    let base: number;
    if (eat("(")) {
      base = parseExpr();
      if (!eat(")")) throw new Error("括号不匹配");
    } else {
      const m = /^\d+(\.\d+)?/.exec(s.slice(pos));
      if (!m) throw new Error(`无法识别的字符「${s[pos] ?? "（末尾）"}」`);
      base = Number(m[0]);
      pos += m[0].length;
    }
    if (eat("^")) base = Math.pow(base, parseFactor());
    return base;
  };
  const v = parseExpr();
  if (pos !== s.length) throw new Error(`无法识别的字符「${s[pos]}」`);
  if (!Number.isFinite(v)) throw new Error("结果不是有效数字");
  return v;
}

const LENGTH_UNITS: Record<string, number> = {
  mm: 0.001, 毫米: 0.001, cm: 0.01, 厘米: 0.01, m: 1, 米: 1, km: 1000, 千米: 1000, 公里: 1000,
  in: 0.0254, 英寸: 0.0254, ft: 0.3048, 英尺: 0.3048, mi: 1609.344, 英里: 1609.344, mile: 1609.344,
};
const WEIGHT_UNITS: Record<string, number> = {
  mg: 0.001, g: 1, 克: 1, kg: 1000, 千克: 1000, t: 1e6, 吨: 1e6,
  lb: 453.59237, 磅: 453.59237, oz: 28.3495231, 盎司: 28.3495231,
};

function runCalculator(input: string): ToolResult {
  try {
    const v = evalExpression(input);
    const out = Number.isInteger(v) ? String(v) : String(Number(v.toFixed(10)));
    return { output: `${input.replace(/\s+/g, " ").trim()} = ${out}`, note: "本地计算，离线可用" };
  } catch (e) {
    return { output: "", note: `⚠️ ${e instanceof Error ? e.message : "表达式有误"}` };
  }
}

function runUnitConvert(input: string, category: string): ToolResult {
  const m = /^(-?\d+(?:\.\d+)?)\s*([^\s到to=→]+)\s*(?:到|to|=|→)\s*([^\s]+)$/i.exec(input.trim());
  if (!m) {
    return { output: "", note: "⚠️ 格式：数值 源单位 到 目标单位，例如 10 km to mile、100 千克到磅" };
  }
  const value = Number(m[1]);
  const fromRaw = m[2].toLowerCase();
  const toRaw = m[3].toLowerCase();
  const isTemp = (u: string) => ["c", "f", "k", "℃", "℉", "摄氏度", "华氏度", "开尔文"].some((k) => u.startsWith(k));
  const inTable = LENGTH_UNITS[fromRaw] !== undefined && LENGTH_UNITS[toRaw] !== undefined;
  const inWeight = WEIGHT_UNITS[fromRaw] !== undefined && WEIGHT_UNITS[toRaw] !== undefined;

  const bothTemp = isTemp(fromRaw) && isTemp(toRaw);
  if (category === "temp" || (!inTable && !inWeight && bothTemp)) {
    const toC = (v: number, u: string) =>
      u.startsWith("f") || u === "℉" || u === "华氏度" ? ((v - 32) * 5) / 9 : u.startsWith("k") || u === "开尔文" ? v - 273.15 : v;
    const fromC = (c: number, u: string) =>
      u.startsWith("f") || u === "℉" || u === "华氏度" ? (c * 9) / 5 + 32 : u.startsWith("k") || u === "开尔文" ? c + 273.15 : c;
    const c = toC(value, fromRaw);
    const out = fromC(c, toRaw);
    return { output: `${value} ${m[2]} = ${Number(out.toFixed(4))} ${m[3]}`, note: "温度换算（℃/℉/K）" };
  }
  if (inTable || category === "length") {
    const out = (value * LENGTH_UNITS[fromRaw]) / LENGTH_UNITS[toRaw];
    return { output: `${value} ${m[2]} = ${Number(out.toFixed(6))} ${m[3]}`, note: "长度换算" };
  }
  if (inWeight || category === "weight") {
    const out = (value * WEIGHT_UNITS[fromRaw]) / WEIGHT_UNITS[toRaw];
    return { output: `${value} ${m[2]} = ${Number(out.toFixed(6))} ${m[3]}`, note: "重量换算" };
  }
  return { output: "", note: "⚠️ 无法识别的单位组合，请检查单位拼写（支持长度/重量/温度）" };
}

function runRandom(input: string, mode: string): ToolResult {
  if (mode === "lottery") {
    const candidates = input.split("\n").map((l) => l.trim()).filter(Boolean);
    if (candidates.length === 0) return { output: "", note: "⚠️ 请每行填写一位候选" };
    const winner = candidates[Math.floor(Math.random() * candidates.length)];
    return { output: `🎉 中选：${winner}`, note: `共 ${candidates.length} 位候选，公平随机` };
  }
  const m = /^(?:(\d+)\s*[个路次@x*]?\s*)?(-?\d+)\s*[-到~]\s*(-?\d+)$/.exec(input.trim().replace(/到/g, "-").replace(/~/g, "-"));
  const count = m ? Math.min(20, Number(m[1] ?? 1)) : 1;
  const min = m ? Number(m[2]) : 1;
  const max = m ? Number(m[3]) : 100;
  if (!m || min > max) return { output: "", note: "⚠️ 格式：最小值-最大值（可加数量），如 1-100 或 5 个 1-100" };
  const lines: string[] = [];
  for (let i = 0; i < count; i += 1) {
    lines.push(String(Math.floor(Math.random() * (max - min + 1)) + min));
  }
  return { output: lines.join("\n"), note: `范围 ${min} ~ ${max}，共 ${count} 个` };
}

function runJson(input: string, mode: string): ToolResult {
  try {
    const obj = JSON.parse(input);
    const out = mode === "min" ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);
    return { output: out, note: `JSON 合法 · ${mode === "min" ? "已压缩" : "已格式化"}` };
  } catch (e) {
    return { output: "", note: `⚠️ JSON 不合法：${e instanceof Error ? e.message : "解析失败"}` };
  }
}

export const TOOL_GROUPS: { title: string; tools: ToolDef[] }[] = [
  {
    title: "文档处理",
    tools: [
      {
        id: "format",
        name: "格式转换",
        desc: "Markdown / HTML / 纯文本互转",
        icon: FileText,
        tint: "text-blue-600",
        bg: "bg-blue-50",
        category: "文档处理",
        kind: "local",
        hint: "粘贴 Markdown、HTML 或纯文本…",
        sample: "# 标题\n这是一段 **加粗** 文字。\n\n- 要点一\n- 要点二",
        option: {
          label: "转换方向",
          default: "md2html",
          choices: [
            { value: "md2html", label: "Markdown → HTML" },
            { value: "html2md", label: "HTML → 纯文本" },
            { value: "md2text", label: "Markdown → 纯文本" },
          ],
        },
        run: (input, opt) => {
          if (opt === "html2md") return { output: htmlToText(input), ext: "txt" };
          if (opt === "md2text") return { output: htmlToText(mdToHtml(input)), ext: "txt" };
          return { output: mdToHtml(input), ext: "html", note: "已生成 HTML，可复制嵌入网页或下载" };
        },
      },
      {
        id: "pdf",
        name: "PDF 工具",
        desc: "合并 / 拆分 / 提取页面 / 旋转 / 查看信息",
        icon: FileText,
        tint: "text-red-500",
        bg: "bg-red-50",
        category: "文档处理",
        kind: "pdf",
        hint: "选择 PDF 文件（合并需 ≥ 2 个，单文件上限 40MB）",
        action: "处理 PDF",
        option: {
          label: "操作",
          default: "info",
          choices: [
            { value: "info", label: "查看信息（页数/标题/作者）" },
            { value: "merge", label: "合并多个 PDF" },
            { value: "split-each", label: "拆分：每页一个文件" },
            { value: "split-range", label: "拆分：按页码段" },
            { value: "extract", label: "提取指定页面" },
            { value: "rotate", label: "旋转页面 90°" },
          ],
        },
      },
      {
        id: "ocr",
        name: "图片转文字",
        desc: "用视觉模型识别图片中的文字（支持表格）",
        icon: FileImage,
        tint: "text-emerald-600",
        bg: "bg-emerald-50",
        category: "文档处理",
        kind: "ocr",
        hint: "选择一张图片（PNG/JPG/WebP，≤ 8MB）",
        action: "识别文字",
      },
      {
        id: "compress",
        name: "文档压缩",
        desc: "去掉多余空白与空行，减小文本体积",
        icon: Scissors,
        tint: "text-violet-600",
        bg: "bg-violet-50",
        category: "文档处理",
        kind: "local",
        hint: "粘贴要压缩的文本…",
        sample: "第一段。\n\n\n第二段  里面有   多余空格。\n   \n第三段。",
        run: minifyText,
      },
      {
        id: "gallery",
        name: "图片画廊",
        desc: "浏览所有会话生成的图片并下载",
        icon: FileImage,
        tint: "text-pink-600",
        bg: "bg-pink-50",
        category: "文档处理",
        kind: "gallery",
        hint: "",
      },
      {
        id: "qr",
        name: "二维码生成",
        desc: "把链接或文字生成二维码，可下载 PNG",
        icon: QrCodeIcon,
        tint: "text-emerald-600",
        bg: "bg-emerald-50",
        category: "文档处理",
        kind: "qr",
        hint: "输入网址或任意文字",
        sample: "https://example.com",
      },
      {
        id: "watermark",
        name: "水印添加",
        desc: "给图片加上文字水印后下载",
        icon: FileImage,
        tint: "text-orange-600",
        bg: "bg-orange-50",
        category: "文档处理",
        kind: "watermark",
        hint: "选择一张图片，填写水印文字后生成",
        action: "生成水印图",
      },
      {
        id: "docstats",
        name: "文档统计",
        desc: "统计字数、行数、段落与高频词",
        icon: Type,
        tint: "text-amber-600",
        bg: "bg-amber-50",
        category: "文档处理",
        kind: "local",
        hint: "粘贴要统计的文本…",
        sample: "人工智能正在改变内容创作的方式。内容创作也需要新的工具与流程。",
        run: textStats,
      },
    ],
  },
  {
    title: "内容创作",
    tools: [
      {
        id: "write",
        name: "智能写作",
        desc: "辅助撰写、修改、提升内容质量",
        icon: Sparkles,
        tint: "text-emerald-600",
        bg: "bg-emerald-50",
        category: "内容创作",
        kind: "ai",
        hint: "描述你想写的内容…",
        sample: "帮我写一篇关于「远程办公效率」的公众号文章开头",
        system:
          "你是资深内容创作者。根据用户要求直接产出高质量正文：结构清晰、有具体细节与例子，语言自然，不写空话套话，不要解释你的写作思路。",
      },
      {
        id: "polish",
        name: "内容润色",
        desc: "优化文字表达，提升可读性",
        icon: FileText,
        tint: "text-blue-600",
        bg: "bg-blue-50",
        category: "内容创作",
        kind: "ai",
        hint: "粘贴需要润色的文字…",
        sample: "这个产品非常好用，我们团队用了之后效率提升了很多，推荐大家也来用。",
        system:
          "你是文字编辑。请润色用户给的文字：让表达更流畅、准确、有分寸，保留原意与事实，不要新增虚构内容。只输出润色后的正文。",
      },
      {
        id: "summary",
        name: "摘要提取",
        desc: "自动提取文章、报告、文档要点",
        icon: FileText,
        tint: "text-sky-600",
        bg: "bg-sky-50",
        category: "内容创作",
        kind: "ai",
        hint: "粘贴长文，提取要点…",
        sample: "（在这里粘贴一篇长文）",
        system:
          "你是信息提炼专家。请输出：一句话摘要（不超过 40 字）+ 5-8 条要点（每条不超过 30 字，保留关键数据与结论）+ 可选的后续行动建议。不要复述原文。",
      },
      {
        id: "grammar",
        name: "语法检查",
        desc: "检查语法与拼写错误，纠正表达",
        icon: FileText,
        tint: "text-red-500",
        bg: "bg-red-50",
        category: "内容创作",
        kind: "ai",
        hint: "粘贴要检查的文字…",
        sample: "他昨天已经去过了那个地方，但是我们还没去了。",
        system:
          "你是中文校对编辑。请检查并修正文字中的错别字、语法问题、标点和表达不通顺之处。输出格式：先给「修改后全文」，再给「修改说明」列表（原文 → 改为 → 原因）。",
      },
      {
        id: "keywords",
        name: "关键词提取",
        desc: "自动提取关键词与标签",
        icon: Sparkles,
        tint: "text-violet-600",
        bg: "bg-violet-50",
        category: "内容创作",
        kind: "ai",
        hint: "粘贴文本，提取关键词…",
        sample: "（在这里粘贴文本）",
        system:
          "你是 SEO 与内容分析专家。请从文本中提取 8-12 个关键词/标签，按重要度排序，每个后附一句为什么重要（不超过 20 字）。用列表输出。",
      },
      {
        id: "abstract",
        name: "摘要生成",
        desc: "为你的内容生成一段摘要",
        icon: Sparkles,
        tint: "text-orange-600",
        bg: "bg-orange-50",
        category: "内容创作",
        kind: "ai",
        hint: "粘贴内容，生成一段摘要…",
        sample: "（在这里粘贴内容）",
        system:
          "请为下面的内容写一段 120 字左右的中文摘要，要求：客观准确、信息密度高、可直接作为导语使用。只输出摘要本身。",
      },
    ],
  },
  {
    title: "数据处理",
    tools: [
      {
        id: "table",
        name: "表格处理",
        desc: "CSV / Markdown 表格互转",
        icon: Table2,
        tint: "text-emerald-600",
        bg: "bg-emerald-50",
        category: "数据处理",
        kind: "local",
        hint: "粘贴 CSV 或 Markdown 表格…",
        sample: "城市,销量,同比\n北京,1200,8%\n上海,980,-3%\n广州,760,12%",
        option: {
          label: "转换方向",
          default: "csv2md",
          choices: [
            { value: "csv2md", label: "CSV → Markdown 表格" },
            { value: "md2csv", label: "Markdown 表格 → CSV" },
          ],
        },
        run: (input, opt) => (opt === "md2csv" ? mdToCsv(input) : csvToMd(input)),
      },
      {
        id: "chart",
        name: "数据可视化",
        desc: "把「名称,数值」变成柱状图",
        icon: BarChart3,
        tint: "text-sky-600",
        bg: "bg-sky-50",
        category: "数据处理",
        kind: "local",
        hint: "每行一条：名称,数值",
        sample: "北京,1200\n上海,980\n广州,760\n深圳,1140",
        run: barChart,
      },
      {
        id: "analyze",
        name: "数据分析",
        desc: "让 AI 解读数据并给出结论",
        icon: Sparkles,
        tint: "text-blue-600",
        bg: "bg-blue-50",
        category: "数据处理",
        kind: "ai",
        hint: "粘贴数据（表格/CSV 均可）…",
        sample: "月份,营收,成本\n1月,120,80\n2月,150,95\n3月,142,101",
        system:
          "你是数据分析师。请基于用户给出的数据做分析：先说数据讲了什么（趋势、异常、结构），再给 3-5 条可执行的建议。不要编造数据里没有的信息，不确定处明确说明。",
      },
      {
        id: "dedupe",
        name: "去重工具",
        desc: "删除重复行，保留原始顺序",
        icon: ListChecks,
        tint: "text-violet-600",
        bg: "bg-violet-50",
        category: "数据处理",
        kind: "local",
        hint: "粘贴多行文本…",
        sample: "张三\n李四\n张三\n王五\n李四",
        run: dedupeLines,
      },        {
          id: "calculator",
          name: "计算器",
          desc: "支持 + - × ÷ % ^ 与括号的表达式求值",
          icon: Calculator,
          tint: "text-violet-600",
          bg: "bg-violet-50",
          category: "数据处理",
          kind: "local",
          hint: "输入算式，如 (12+8)×3.5÷2",
          sample: "(12 + 8) × 3.5 ÷ 2",
          run: runCalculator,
        },
        {
          id: "unit",
          name: "单位换算",
          desc: "长度 / 重量 / 温度互转，支持中文单位",
          icon: Ruler,
          tint: "text-emerald-600",
          bg: "bg-emerald-50",
          category: "数据处理",
          kind: "local",
          hint: "如：10 km to mile、100 千克到磅、37c to f",
          sample: "10 km to mile",
          option: { label: "类别", default: "auto", choices: [{ value: "auto", label: "自动识别" }, { value: "length", label: "长度" }, { value: "weight", label: "重量" }, { value: "temp", label: "温度" }] },
          run: (input, option) => runUnitConvert(input, option ?? "auto"),
        },
        {
          id: "random",
          name: "随机数 / 抽奖",
          desc: "生成随机数，或从名单里公平抽取一人",
          icon: Dices,
          tint: "text-amber-600",
          bg: "bg-amber-50",
          category: "数据处理",
          kind: "local",
          hint: "随机数：1-100（可加数量如 5 个 1-100）；抽奖：每行一位候选",
          sample: "1-100",
          option: { label: "模式", default: "number", choices: [{ value: "number", label: "随机数" }, { value: "lottery", label: "抽奖" }] },
          run: (input, option) => runRandom(input, option ?? "number"),
        },
        {
          id: "json",
          name: "JSON 工具",
          desc: "格式化 / 压缩 / 校验 JSON 是否合法",
          icon: Braces,
          tint: "text-sky-600",
          bg: "bg-sky-50",
          category: "数据处理",
          kind: "local",
          hint: "粘贴 JSON 文本",
          sample: '{"name":"OpenCanvas","tags":["ai","canvas"],"v":2}',
          option: { label: "模式", default: "pretty", choices: [{ value: "pretty", label: "格式化" }, { value: "min", label: "压缩" }] },
          run: (input, option) => runJson(input, option ?? "pretty"),
        },
      {
        id: "import",
        name: "数据导入",
        desc: "把 CSV / JSON 规整成表格",
        icon: Upload,
        tint: "text-amber-600",
        bg: "bg-amber-50",
        category: "数据处理",
        kind: "local",
        hint: "粘贴 CSV 或 JSON…",
        sample: 'name,score\nalice,92\nbob,78',
        run: (input) => {
          const t = input.trim();
          if (t.startsWith("[") || t.startsWith("{")) {
            try {
              const obj = JSON.parse(t) as unknown;
              const arr = Array.isArray(obj) ? obj : [obj];
              const cols = [...new Set(arr.flatMap((r) => Object.keys(r as Record<string, unknown>)))];
              const rows = [
                cols.join(" | "),
                cols.map(() => "---").join(" | "),
                ...arr.map((r) =>
                  cols.map((c) => String((r as Record<string, unknown>)[c] ?? "")).join(" | ")
                ),
              ];
              return { output: rows.join("\n"), note: `解析出 ${arr.length} 条记录 / ${cols.length} 个字段`, ext: "md" };
            } catch {
              return { output: "", note: "JSON 解析失败，请检查格式" };
            }
          }
          return csvToMd(input);
        },
      },
      {
        id: "export",
        name: "数据导出",
        desc: "把表格导出为 CSV / JSON / Markdown",
        icon: Download,
        tint: "text-orange-600",
        bg: "bg-orange-50",
        category: "数据处理",
        kind: "local",
        hint: "粘贴要导出的数据…",
        sample: "城市,销量\n北京,1200\n上海,980",
        option: {
          label: "导出格式",
          default: "csv",
          choices: [
            { value: "csv", label: "CSV" },
            { value: "json", label: "JSON" },
            { value: "md", label: "Markdown 表格" },
            { value: "txt", label: "纯文本" },
          ],
        },
        run: (input, opt) => {
          if (opt === "json") return toJson(input);
          if (opt === "md") return csvToMd(input);
          if (opt === "txt") return { output: input, ext: "txt" };
          return mdToCsv(input);
        },
      },
    ],
  },
  {
    title: "协作工具",
    tools: [
      {
        id: "team",
        name: "团队协作",
        desc: "任务看板：拆分事项、指派负责人、跟踪进度",
        icon: Users,
        tint: "text-blue-600",
        bg: "bg-blue-50",
        category: "协作工具",
        kind: "board",
        hint: "新增任务并指派负责人…",
        action: "打开看板",
      },
      {
        id: "comment",
        name: "评论批注",
        desc: "像编辑一样逐段给出批注",
        icon: MessageSquareQuote,
        tint: "text-violet-600",
        bg: "bg-violet-50",
        category: "协作工具",
        kind: "ai",
        hint: "粘贴需要批注的文稿…",
        sample: "（在这里粘贴文稿）",
        system:
          "你是资深主编。请对文稿逐段给出批注：每段先引用关键句，再从「亮点 / 问题 / 修改建议」三点点评，最后给一个总体评价与优先级最高的 3 条修改意见。语气专业直接。",
      },
      {
        id: "version",
        name: "版本管理",
        desc: "把当前内容存为新版本快照",
        icon: GitBranch,
        tint: "text-emerald-600",
        bg: "bg-emerald-50",
        category: "协作工具",
        kind: "local",
        hint: "输入内容后点「保存为新版本」…",
        sample: "v1 的初稿内容…",
        action: "保存为新版本",
        run: saveVersion,
      },
      {
        id: "perm",
        name: "权限管理",
        desc: "配置角色 × 权限矩阵并导出",
        icon: KeyRound,
        tint: "text-orange-600",
        bg: "bg-orange-50",
        category: "协作工具",
        kind: "matrix",
        hint: "勾选每个角色的权限…",
        action: "打开矩阵",
      },
      {
        id: "share",
        name: "分享链接",
        desc: "生成一条可分享的内容链接",
        icon: Link2,
        tint: "text-sky-600",
        bg: "bg-sky-50",
        category: "协作工具",
        kind: "share",
        hint: "输入要分享的内容（提示词、结论、资料摘要等）…",
        sample: "为「AI 写作助手」写 5 条小红书种草文案，每条含标题、正文和标签。",
        action: "生成分享链接",
      },
      {
        id: "task",
        name: "活动任务",
        desc: "把这段描述变成一个 AI 任务",
        icon: Send,
        tint: "text-amber-600",
        bg: "bg-amber-50",
        category: "协作工具",
        kind: "task",
        hint: "描述要执行的任务…",
        sample: "整理本周工作并输出一份周报，包含进展、风险与下周计划",
        action: "创建并发起任务",
      },
    ],
  },
];

export const ALL_TOOLS: ToolDef[] = TOOL_GROUPS.flatMap((g) => g.tools);

export function findTool(id: string): ToolDef | undefined {
  return ALL_TOOLS.find((t) => t.id === id);
}
