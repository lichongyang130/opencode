import { THEMES } from "@/lib/slides/themes";
import { fillCoverMeta } from "@/lib/slides/outline";
import { readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";
import type { Slide, SlideDeck } from "@/lib/slides/types";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const LAYOUT_LABEL: Record<string, string> = {
  toc: "目录",
  content: "要点",
  twoCol: "双栏",
  stats: "数字",
  timeline: "时间轴",
  compare: "对比",
  process: "流程",
  quote: "金句",
  team: "团队",
};

/** 单页 → 打印用 HTML 块（每页一屏 16:9，page-break 后分页打印成 PDF） */
function slideToHtml(s: Slide, t: (typeof THEMES)["violet"], pageNo: number): string {
  const dark = s.layout === "cover" || s.layout === "end";
  const title = `<div class="title">${esc(s.title ?? "")}</div>`;
  const sub = s.subtitle ? `<div class="subtitle">${esc(s.subtitle)}</div>` : "";

  let body = "";
  if (s.layout === "toc" || s.layout === "content") {
    body = `<ul class="bullets">${(s.bullets ?? []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
  } else if (s.layout === "twoCol" || s.layout === "compare") {
    const left = `<div class="col"><h3>${esc(s.layout === "compare" ? "方案 A" : "核心要点")}</h3><ul>${(s.bullets ?? []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>`;
    const right = `<div class="col dashed"><h3>${esc(s.twoColTitle ?? (s.layout === "compare" ? "方案 B" : "补充"))}</h3><ul>${(s.bulletsRight ?? []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>`;
    body = `<div class="cols">${left}${right}</div>`;
  } else if (s.layout === "stats" || s.layout === "team") {
    const isTeam = s.layout === "team";
    body = `<div class="stats">${(s.stats ?? [])
      .map(
        (st) =>
          `<div class="card"><div class="${isTeam ? "name" : "num"}">${esc(st.value)}</div><div class="label">${esc(st.label)}</div></div>`
      )
      .join("")}</div>`;
  } else if (s.layout === "timeline" || s.layout === "process") {
    body = `<div class="steps">${(s.steps ?? [])
      .map(
        (st, i) =>
          `<div class="step"><span class="badge">${i + 1}</span><div><b>${esc(st.item)}</b>${st.detail ? `<small>${esc(st.detail)}</small>` : ""}</div></div>`
      )
      .join("")}</div>`;
  } else if (s.layout === "quote") {
    body = `<div class="quote">“${esc(s.quote ?? "")}”<div class="by">${esc(s.quoteBy ?? "")}</div></div>`;
  }

  return `
  <section class="page ${dark ? "dark" : ""}" style="${dark
    ? `background:${t.primary};color:${t.onPrimary}`
    : `background:${t.surface};color:${t.text}`}">
    ${dark ? `<div class="deco" style="background:${t.accent}"></div>${title}${sub}` : `<div class="head"><span class="bar" style="background:${t.accent}"></span>${title}</div>${body}`}
    ${!dark ? `<div class="pageno" style="color:${t.muted}">${pageNo}</div>` : ""}
    ${s.note ? `<div class="note" style="color:${t.muted}">备注：${esc(s.note)}</div>` : ""}
  </section>`;
}

/**
 * PPT7：导出打印样式 HTML——浏览器打开后 Ctrl+P 打印为 PDF。
 * 每页 16:9 一屏 + page-break-after 分页，样式与 Web 渲染同款主题。
 * （服务端渲染 PDF 需要引入 headless 浏览器依赖，违背项目零重依赖原则，
 *  打印页方案无依赖且各平台兼容）
 */
export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<{ deck?: SlideDeck }>(req);
  if (!body) {
    return new Response(JSON.stringify({ error: "请求体不是有效的 JSON 对象" }), { status: 400 });
  }
  const rawDeck = body.deck;
  if (!rawDeck?.slides?.length) {
    return new Response(JSON.stringify({ error: "deck 无效" }), { status: 400 });
  }
  const deck = fillCoverMeta(rawDeck);
  const t = THEMES[deck.theme] ?? THEMES.violet;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><title>${esc(deck.title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Microsoft YaHei',-apple-system,sans-serif;background:#e7e5e4;}
.page{width:100vw;max-width:1280px;aspect-ratio:16/9;margin:0 auto 16px;padding:5% 7%;position:relative;overflow:hidden;break-after:page;page-break-after:always;box-shadow:0 2px 12px rgba(0,0,0,.12);}
@media print{.page{box-shadow:none;margin:0;}body{background:#fff;}}
.title{font-size:36px;font-weight:700;}
.dark{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}
.dark .title{font-size:44px;}
.dark .subtitle{margin-top:14px;font-size:18px;opacity:.8;}
.deco{position:absolute;right:-10%;top:-14%;width:32%;aspect-ratio:1;border-radius:50%;opacity:.32;}
.head{display:flex;align-items:center;gap:12px;margin-bottom:28px;}
.bar{width:6px;height:30px;border-radius:3px;flex-shrink:0;}
.head .title{font-size:28px;}
.bullets{margin-left:12px;list-style:none;}
.bullets li{font-size:17px;line-height:2;padding-left:20px;position:relative;}
.bullets li::before{content:"";position:absolute;left:2px;top:14px;width:8px;height:8px;border-radius:50%;background:${t.accent};}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.col{background:rgba(255,255,255,.85);border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06);}
.col.dashed{border:1.5px dashed ${t.muted};}
.col h3{font-size:17px;color:${t.accent};margin-bottom:10px;}
.col ul{list-style:none;}
.col li{font-size:14px;line-height:1.9;}
.stats{display:flex;gap:16px;justify-content:center;}
.card{flex:1;max-width:240px;background:#fff;border-radius:14px;padding:24px;text-align:center;border:1.5px solid ${t.accent}88;}
.num{font-size:42px;font-weight:800;color:${t.accent};}
.name{font-size:20px;font-weight:700;}
.label{font-size:13px;color:${t.muted};margin-top:6px;}
.steps{display:flex;flex-direction:column;gap:14px;}
.step{display:flex;align-items:flex-start;gap:14px;background:#fff;border-radius:10px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.05);}
.step .badge{width:32px;height:32px;border-radius:50%;background:${t.accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;}
.step b{font-size:16px;display:block;}
.step small{font-size:12px;color:${t.muted};display:block;margin-top:2px;}
.quote{display:flex;flex-direction:column;align-items:center;justify-content:center;height:70%;text-align:center;font-size:24px;font-weight:500;line-height:1.8;max-width:80%;margin:0 auto;}
.quote .by{margin-top:18px;font-size:15px;color:${t.muted};font-weight:400;}
.pageno{position:absolute;right:4%;bottom:4%;font-size:12px;}
.note{position:absolute;left:7%;bottom:4%;font-size:11px;opacity:.8;max-width:70%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hint{position:fixed;left:12px;top:12px;background:#fff;border:1px solid #d6d3d1;border-radius:8px;padding:8px 14px;font-size:12px;color:#57534e;box-shadow:0 2px 8px rgba(0,0,0,.1);}
@media print{.hint{display:none;}}
</style>
</head>
<body>
<div class="hint">按 Ctrl/Cmd + P 打印，选择「另存为 PDF」· 布局：横向 · 勾选背景图形</div>
${deck.slides.map((s, i) => slideToHtml(s, t, i + 1)).join("\n")}
</body>
</html>`;

  const filename = encodeURIComponent(`${(deck.title || "slides").slice(0, 60)}-打印版.html`);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
    },
  });
});