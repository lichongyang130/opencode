/** 文档导出：Markdown / HTML / Word(.doc)，Markdown→HTML 与渲染器能力对齐（DOC6） */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** DOC6: 链接与图片语法（导出侧对齐 Markdown.tsx 渲染器尚未支持的部分单独补） */
function linkImage(s: string): string {
  // ![alt](url) 必须先于 [text](url) 处理，否则 alt 会被误当链接文本
  return s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function inline(s: string): string {
  let h = esc(s);
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  h = linkImage(h);
  return h;
}

/** 单元格按 | 切列：去首尾边界竖线再按剩余竖线切，空单元格保留 */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isTableSep = (line: string): boolean =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);

/** DOC6: 预览用轻量 HTML（完整功能版走全页导出，见 downloadHtml） */
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let list: "ul" | "ol" | null = null;
  let codeBlock = false;
  let tableRows: string[] = [];
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };
  const flushTable = () => {
    if (tableRows.length === 0) return;
    // tableRows 不含分隔行：[0] 是表头，[1..] 是数据行
    const header = splitRow(tableRows[0]);
    const bodyRows = tableRows.slice(1).map(splitRow);
    html.push("<table>");
    html.push(
      `<thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>`
    );
    html.push(
      `<tbody>${bodyRows
        .map((r) => `<tr>${header.map((_, i) => `<td>${inline(r[i] ?? "")}</td>`).join("")}</tr>`)
        .join("")}</tbody>`
    );
    html.push("</table>");
    tableRows = [];
  };
  for (const raw of lines) {
    const line = raw;
    // 代码围栏：内部原样保留不再做任何 MD 转换
    if (/^\s*```/.test(line)) {
      if (tableRows.length) flushTable();
      closeList();
      codeBlock = !codeBlock;
      continue;
    }
    if (codeBlock) {
      html.push(`<pre><code>${esc(line)}</code></pre>`);
      continue;
    }
    // 表格：连续的 | 行组（头行 + 分隔行 + 数据行）
    if (/^\s*\|/.test(line)) {
      closeList();
      // 分隔行跳过（渲染时按列数对齐用），头行与数据行累计
      if (!isTableSep(line)) tableRows.push(line);
      continue;
    }
    if (tableRows.length) flushTable();
    if (/^\s*[-*•]\s+/.test(line)) {
      if (list !== "ul") {
        closeList();
        html.push("<ul>");
        list = "ul";
      }
      html.push(`<li>${inline(line.replace(/^\s*[-*•]\s+/, ""))}</li>`);
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      if (list !== "ol") {
        closeList();
        html.push("<ol>");
        list = "ol";
      }
      html.push(`<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
    } else {
      closeList();
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const level = h[1].length;
        html.push(`<h${level}>${inline(h[2])}</h${level}>`);
      } else if (/^\s*>/.test(line)) {
        html.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
      } else if (line.trim() === "") {
        // 空行忽略（段落间距由样式控制）
      } else {
        html.push(`<p>${inline(line)}</p>`);
      }
    }
  }
  if (tableRows.length) flushTable();
  closeList();
  return html.join("\n");
}

function safeName(title: string): string {
  return (title || "document").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
}

function triggerDownload(name: string, parts: BlobPart[], type: string): void {
  const blob = new Blob(parts, { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(title: string, md: string) {
  triggerDownload(`${safeName(title)}.md`, [md], "text/markdown;charset=utf-8");
}

/** DOC6: 独立 HTML 文件导出（内嵌极简样式，浏览器打开即可读） */
export function downloadHtml(title: string, md: string) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:'Microsoft YaHei',-apple-system,sans-serif;max-width:860px;margin:40px auto;padding:0 24px;line-height:1.85;color:#1c1917;}
h1{font-size:26px;border-bottom:2px solid #e7e5e4;padding-bottom:8px;}
h2{font-size:20px;margin-top:28px;} h3{font-size:16px;}
blockquote{border-left:4px solid #d6d3d1;margin:0;padding:4px 16px;color:#57534e;background:#fafaf9;}
code{background:#f5f5f4;padding:1px 5px;border-radius:3px;font-size:.9em;}
pre{background:#f5f5f4;padding:12px;border-radius:8px;overflow-x:auto;} pre code{background:none;padding:0;}
table{border-collapse:collapse;width:100%;margin:12px 0;}
th,td{border:1px solid #d6d3d1;padding:6px 12px;text-align:left;}
th{background:#f5f5f4;} tr:nth-child(even) td{background:#fafaf9;}
img{max-width:100%;}
</style></head>
<body>${markdownToHtml(md)}</body></html>`;
  triggerDownload(`${safeName(title)}.html`, [html], "text/html;charset=utf-8");
}

/** 导出为 Word 可打开的 .doc（HTML 内核，与 docx 内容互通，Word/WPS 均可直接打开） */
export function downloadWord(title: string, md: string) {
  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:'Microsoft YaHei',sans-serif;line-height:1.8;color:#1c1917;}
h1{font-size:24px;} h2{font-size:19px;margin-top:18px;} h3{font-size:16px;}
p{margin:6px 0;} code{background:#f5f5f4;padding:1px 4px;border-radius:3px;}
blockquote{border-left:3px solid #d6d3d1;margin:6px 0;padding:2px 12px;color:#57534e;}
table{border-collapse:collapse;} th,td{border:1px solid #a8a29e;padding:4px 10px;}
th{background:#f5f5f4;}
</style></head>
<body>${markdownToHtml(md)}</body></html>`;
  // BOM 头让 Word 正确把字节流识别为 UTF-8（中文文档不乱码的关键）
  triggerDownload(`${safeName(title)}.doc`, ["\ufeff", html], "application/msword");
}
