import PptxGenJS from "pptxgenjs";
import { THEMES } from "@/lib/slides/themes";
import { fillCoverMeta } from "@/lib/slides/outline";
import { readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";
import type { SlideDeck } from "@/lib/slides/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hex = (c: string) => c.replace("#", "");
const FONT = "Microsoft YaHei";

/** 清洗下载文件名：去掉路径分隔符与控制字符，避免 Content-Disposition 被污染 */
function safeFileName(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[\\/]/g, "-")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 80)
    .replace(/^[.\s]+|[.\s]+$/g, "");
  return cleaned || fallback;
}

/**
 * 导出 PPTX：把前端渲染同款的 SlideDeck 用 pptxgenjs 生成 .pptx 文件。
 * POST { deck: SlideDeck } -> application/vnd.openxmlformats... (pptx)
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
  // PPT9：封面副标题与日期兜底填充（store 侧生成时已填过，这里幂等兜底）
  const deck = fillCoverMeta(rawDeck);

  const theme = THEMES[deck.theme] ?? THEMES.violet;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";

  const W = 13.33;

  let pageNo = 0;
  for (const s of deck.slides) {
    pageNo += 1;
    const slide = pptx.addSlide();

    if (s.layout === "cover" || s.layout === "end") {
      slide.background = { color: hex(theme.primary) };
      // 装饰圆
      slide.addShape("ellipse", {
        x: 9.2, y: -1.6, w: 5.5, h: 5.5,
        fill: { color: hex(theme.accent), transparency: 70 },
        line: { color: hex(theme.accent), transparency: 100 },
      });
      slide.addText(s.title ?? "", {
        x: 0.9, y: 2.7, w: 11.5, h: 1.6,
        fontFace: FONT, fontSize: 40, bold: true,
        color: hex(theme.onPrimary), align: "center", valign: "middle",
      });
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 1.5, y: 4.4, w: 10.3, h: 0.8,
          fontFace: FONT, fontSize: 18,
          color: hex(theme.onPrimary), transparency: 25, align: "center",
        });
      }
      continue;
    }

    // 浅色背景页
    slide.background = { color: hex(theme.surface) };
    // 标题 + 强调条
    slide.addShape("rect", {
      x: 0.7, y: 0.55, w: 0.12, h: 0.55,
      fill: { color: hex(theme.accent) }, line: { color: hex(theme.accent) },
    });
    slide.addText(s.title ?? "", {
      x: 0.95, y: 0.5, w: 11.6, h: 0.7,
      fontFace: FONT, fontSize: 26, bold: true, color: hex(theme.text),
    });

    if (s.layout === "toc") {
      const items = s.bullets ?? [];
      items.forEach((b, i) => {
        const y = 1.7 + i * 1.05;
        slide.addShape("roundRect", {
          x: 1.2, y, w: 10.9, h: 0.85, rectRadius: 0.08,
          fill: { color: "FFFFFF" }, line: { color: hex(theme.accent), transparency: 60, width: 1 },
        });
        slide.addText(String(i + 1).padStart(2, "0"), {
          x: 1.5, y, w: 1.0, h: 0.85,
          fontFace: FONT, fontSize: 20, bold: true, color: hex(theme.accent), valign: "middle",
        });
        slide.addText(b, {
          x: 2.6, y, w: 9.2, h: 0.85,
          fontFace: FONT, fontSize: 17, color: hex(theme.text), valign: "middle",
        });
      });
    } else if (s.layout === "content") {
      const items = s.bullets ?? [];
      slide.addText(
        items.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })),
        {
          x: 1.0, y: 1.7, w: s.imagePrompt ? 7.0 : 11.3, h: 5.0,
          fontFace: FONT, fontSize: 17, color: hex(theme.text),
          lineSpacingMultiple: 1.5, valign: "top",
          paraSpaceAfter: 10,
        }
      );
      if (s.imagePrompt) {
        if (s.imageUrl) {
          // PPT3：已生成配图——真实图片嵌入右半区（pptxgenjs 直接支持 URL）
          slide.addImage({
            path: s.imageUrl,
            x: 8.4, y: 1.8, w: 3.9, h: 4.6,
            sizing: { type: "cover", w: 3.9, h: 4.6 },
          });
        } else {
          slide.addShape("roundRect", {
            x: 8.4, y: 1.8, w: 3.9, h: 4.6, rectRadius: 0.12,
            fill: { color: hex(theme.primary), transparency: 88 },
            line: { color: hex(theme.accent), width: 1.5, dashType: "dash" },
          });
          slide.addText("配图位\n（可生成配图后导出）", {
            x: 8.4, y: 1.8, w: 3.9, h: 4.6,
            fontFace: FONT, fontSize: 13, color: hex(theme.muted),
            align: "center", valign: "middle",
          });
        }
      }
    } else if (s.layout === "twoCol") {
      const colW = 5.35;
      const drawCol = (x: number, heading: string | undefined, items: string[]) => {
        slide.addShape("roundRect", {
          x, y: 1.7, w: colW, h: 5.0, rectRadius: 0.1,
          fill: { color: "FFFFFF" }, line: { color: "E7E5E4", width: 1 },
        });
        if (heading) {
          slide.addText(heading, {
            x: x + 0.35, y: 1.95, w: colW - 0.7, h: 0.6,
            fontFace: FONT, fontSize: 17, bold: true, color: hex(theme.accent),
          });
        }
        slide.addText(
          items.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })),
          {
            x: x + 0.35, y: 2.7, w: colW - 0.7, h: 3.8,
            fontFace: FONT, fontSize: 15, color: hex(theme.text),
            lineSpacingMultiple: 1.4, paraSpaceAfter: 8,
          }
        );
      };
      drawCol(0.85, "核心要点", s.bullets ?? []);
      drawCol(7.1, s.twoColTitle ?? "补充说明", s.bulletsRight ?? []);
    } else if (s.layout === "stats" || s.layout === "team") {
      const stats = s.stats ?? [];
      const cardW = 3.5;
      const gap = 0.55;
      // 空数组时 totalW 会算成负数导致布局起点越界，直接跳过卡片绘制
      const totalW = stats.length > 0 ? stats.length * cardW + (stats.length - 1) * gap : 0;
      const startX = (W - totalW) / 2;
      stats.forEach((st, i) => {
        const x = startX + i * (cardW + gap);
        slide.addShape("roundRect", {
          x, y: 2.5, w: cardW, h: 2.7, rectRadius: 0.15,
          fill: { color: "FFFFFF" }, line: { color: hex(theme.accent), transparency: 55, width: 1.5 },
        });
        // team 版式 value 是姓名（小字号），stats 是数字（大字号）
        const isTeam = s.layout === "team";
        slide.addText(st.value, {
          x, y: isTeam ? 3.1 : 2.9, w: cardW, h: isTeam ? 0.8 : 1.2,
          fontFace: FONT, fontSize: isTeam ? 20 : 40, bold: !isTeam,
          color: isTeam ? hex(theme.text) : hex(theme.accent), align: "center",
        });
        slide.addText(st.label, {
          x, y: 4.2, w: cardW, h: 0.7,
          fontFace: FONT, fontSize: 14, color: hex(theme.muted), align: "center",
        });
      });
    } else if (s.layout === "timeline") {
      // PPT5：时间轴——横向节点 + 上下交错文字
      const steps = s.steps ?? [];
      const stepW = W / Math.max(steps.length, 1);
      // 中轴线
      slide.addShape("rect", {
        x: 1.0, y: 3.75, w: W - 2.0, h: 0.03,
        fill: { color: hex(theme.accent) }, line: { color: hex(theme.accent) },
      });
      steps.forEach((st, i) => {
        const cx = stepW * i + stepW / 2;
        slide.addShape("ellipse", {
          x: cx - 0.16, y: 3.6, w: 0.32, h: 0.32,
          fill: { color: hex(theme.surface) }, line: { color: hex(theme.accent), width: 2 },
        });
        const above = i % 2 === 0;
        slide.addText(st.item, {
          x: cx - stepW / 2, y: above ? 2.4 : 4.15, w: stepW, h: 0.5,
          fontFace: FONT, fontSize: 15, bold: true, color: hex(theme.text), align: "center",
        });
        if (st.detail) {
          slide.addText(st.detail, {
            x: cx - stepW / 2, y: above ? 2.9 : 4.65, w: stepW, h: 0.7,
            fontFace: FONT, fontSize: 11.5, color: hex(theme.muted), align: "center",
          });
        }
      });
    } else if (s.layout === "process") {
      // PPT5：流程——竖向步骤链
      const steps = s.steps ?? [];
      const rowH = Math.min(1.1, 5.0 / Math.max(steps.length, 1));
      steps.forEach((st, i) => {
        const y = 1.6 + i * rowH;
        slide.addShape("ellipse", {
          x: 1.1, y: y + rowH / 2 - 0.3, w: 0.6, h: 0.6,
          fill: { color: hex(theme.accent) }, line: { color: hex(theme.accent) },
        });
        slide.addText(String(i + 1), {
          x: 1.1, y: y + rowH / 2 - 0.3, w: 0.6, h: 0.6,
          fontFace: FONT, fontSize: 18, bold: true, color: "FFFFFF", align: "center", valign: "middle",
        });
        slide.addShape("roundRect", {
          x: 2.0, y, w: 10.3, h: rowH - 0.15, rectRadius: 0.08,
          fill: { color: "FFFFFF" }, line: { color: "E7E5E4", width: 1 },
        });
        slide.addText(
          [
            { text: st.item, options: { fontSize: 15, bold: true, color: hex(theme.text), breakLine: true } },
            ...(st.detail ? [{ text: st.detail, options: { fontSize: 11.5, color: hex(theme.muted) } }] : []),
          ],
          { x: 2.35, y, w: 9.7, h: rowH - 0.15, fontFace: FONT, valign: "middle" }
        );
      });
    } else if (s.layout === "compare") {
      // PPT5：左右对比
      const colW = 5.35;
      const drawSide = (x: number, heading: string, items: string[], solid: boolean) => {
        slide.addShape("roundRect", {
          x, y: 1.7, w: colW, h: 5.0, rectRadius: 0.1,
          fill: { color: "FFFFFF" },
          line: { color: hex(solid ? theme.accent : theme.muted), width: solid ? 2 : 1, dashType: solid ? "solid" : "dash" },
        });
        slide.addText(heading, {
          x: x + 0.35, y: 1.95, w: colW - 0.7, h: 0.6,
          fontFace: FONT, fontSize: 17, bold: true, color: hex(solid ? theme.accent : theme.muted),
        });
        slide.addText(
          items.map((b) => ({ text: b, options: { bullet: { code: solid ? "2022" : "25CB" }, breakLine: true } })),
          {
            x: x + 0.35, y: 2.7, w: colW - 0.7, h: 3.8,
            fontFace: FONT, fontSize: 15, color: hex(theme.text),
            lineSpacingMultiple: 1.4, paraSpaceAfter: 8,
          }
        );
      };
      drawSide(0.85, "方案 A", s.bullets ?? [], true);
      drawSide(7.1, s.twoColTitle ?? "方案 B", s.bulletsRight ?? [], false);
    } else if (s.layout === "quote") {
      // PPT5：金句——大字居中
      slide.addText("“", {
        x: 0.9, y: 1.2, w: 2, h: 1.5,
        fontFace: FONT, fontSize: 72, bold: true, color: hex(theme.accent), transparency: 60,
      });
      slide.addText(s.quote ?? "", {
        x: 1.6, y: 2.5, w: 10.1, h: 2.4,
        fontFace: FONT, fontSize: 24, color: hex(theme.text), align: "center", valign: "middle",
      });
      if (s.quoteBy) {
        slide.addText(s.quoteBy, {
          x: 1.6, y: 5.2, w: 10.1, h: 0.6,
          fontFace: FONT, fontSize: 15, color: hex(theme.muted), align: "center",
        });
      }
    }

    // PPT6：演讲者备注写入该页备注区
    if (s.note) {
      slide.addNotes(s.note);
    }

    // 页脚页码
    slide.addText(String(pageNo), {
      x: 12.4, y: 7.0, w: 0.7, h: 0.4,
      fontFace: FONT, fontSize: 10, color: hex(theme.muted), align: "right",
    });
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const filename = encodeURIComponent(`${safeFileName(deck.title ?? "", "slides")}.pptx`);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
});
