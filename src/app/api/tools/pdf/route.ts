import { PDFDocument, degrees } from "pdf-lib";
import { badJsonResponse, readJsonBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PDF 服务端工具（pdf-lib，纯 JS 无需外部二进制）：
 * - info    ：读取页数、标题、作者、文件大小
 * - merge   ：合并多个 PDF
 * - split   ：拆分（按页码范围 / 每页一个文件）
 * - extract ：提取指定页生成新 PDF
 * - rotate  ：旋转指定页（90/180/270）
 *
 * 输入/输出均为 base64，避免 multipart 解析依赖。
 */

interface PdfIn {
  name: string;
  data: string; // base64（可带 data: 前缀）
}

interface Body {
  action: "info" | "merge" | "split" | "extract" | "rotate";
  files?: PdfIn[];
  /** split=range 时用：如 "1-3,5,8-" */
  ranges?: string;
  /** extract 用：如 "1,3,5-7"；split=each 时忽略 */
  pages?: string;
  /** rotate 用：90 / 180 / 270 */
  angle?: number;
}

const MAX_FILES = 10;
const MAX_BYTES = 40 * 1024 * 1024; // 单个文件 40MB 上限

/** base64 解码；字符集非法时返回 null，避免 Buffer 静默产出垃圾字节 */
function toBytes(b64: string): Uint8Array | null {
  if (typeof b64 !== "string") return null;
  const clean = (b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64).replace(/\s/g, "");
  if (!clean || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return null;
  return new Uint8Array(Buffer.from(clean, "base64"));
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function isPdf(bytes: Uint8Array) {
  if (bytes.length < 5) return false;
  const head = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  return head === "%PDF-";
}

/** 解析 "1-3,5,8-" 这类页码表达式（1 起，闭区间） */
function parsePages(expr: string, total: number): number[] {
  const out = new Set<number>();
  for (const part of expr.split(/[,，]/)) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*[-~]\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, Number(m[1]));
      const b = Math.min(total, Number(m[2]));
      for (let i = a; i <= b; i += 1) out.add(i);
      continue;
    }
    const open = p.match(/^(\d+)\s*[-~]$/);
    if (open) {
      const a = Math.max(1, Number(open[1]));
      for (let i = a; i <= total; i += 1) out.add(i);
      continue;
    }
    const n = Number(p);
    if (Number.isFinite(n) && n >= 1 && n <= total) out.add(Math.floor(n));
  }
  return [...out].sort((a, b) => a - b);
}

function fmtSize(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<Body>(req);
    if (!body) return badJsonResponse();
    const action = body.action;
    const files = (body.files ?? []).slice(0, MAX_FILES);

    if (!action) return Response.json({ error: "缺少 action" }, { status: 400 });
    if (files.length === 0) return Response.json({ error: "请先选择 PDF 文件" }, { status: 400 });

    const bytesList: Uint8Array[] = [];
    for (const f of files) {
      const bytes = toBytes(f?.data ?? "");
      if (!bytes) {
        return Response.json({ error: `文件内容不是有效的 base64：${f?.name ?? "未命名"}` }, { status: 400 });
      }
      if (bytes.length > MAX_BYTES) {
        return Response.json({ error: `文件过大（上限 40MB）：${f.name}` }, { status: 400 });
      }
      if (!isPdf(bytes)) {
        return Response.json({ error: `不是有效的 PDF 文件：${f.name}` }, { status: 400 });
      }
      bytesList.push(bytes);
    }

    if (action === "info") {
      const infos = [];
      for (let i = 0; i < bytesList.length; i += 1) {
        const doc = await PDFDocument.load(bytesList[i], { ignoreEncryption: true });
        infos.push({
          name: files[i].name,
          pages: doc.getPageCount(),
          title: doc.getTitle() || "—",
          author: doc.getAuthor() || "—",
          subject: doc.getSubject() || "—",
          creator: doc.getCreator() || "—",
          size: fmtSize(bytesList[i].length),
        });
      }
      const totalPages = infos.reduce((a, b) => a + b.pages, 0);
      const text = [
        `共 ${infos.length} 个文件，${totalPages} 页`,
        ...infos.map(
          (x, i) =>
            `${i + 1}. ${x.name}｜${x.pages} 页｜${x.size}｜标题：${x.title}｜作者：${x.author}`
        ),
      ].join("\n");
      return Response.json({ ok: true, text, infos });
    }

    if (action === "merge") {
      if (bytesList.length < 2) {
        return Response.json({ error: "合并至少需要 2 个 PDF 文件" }, { status: 400 });
      }
      const out = await PDFDocument.create();
      for (const bytes of bytesList) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copied = await out.copyPages(src, src.getPageIndices());
        for (const p of copied) out.addPage(p);
      }
      out.setTitle("OpenCanvas 合并文档");
      out.setProducer("OpenCanvas PDF 工具");
      const data = await out.save({ useObjectStreams: true });
      return Response.json({
        ok: true,
        text: `已合并 ${bytesList.length} 个文件 → ${out.getPageCount()} 页 / ${fmtSize(data.byteLength)}`,
        files: [{ name: "merged.pdf", data: toBase64(data) }],
      });
    }

    if (action === "split") {
      const doc = await PDFDocument.load(bytesList[0], { ignoreEncryption: true });
      const total = doc.getPageCount();
      const base = (files[0].name || "doc").replace(/\.pdf$/i, "");
      const outs: { name: string; data: string }[] = [];

      if (body.ranges?.trim()) {
        // 按范围拆成多个文件：每段一个 PDF
        const segments = body.ranges
          .split(/[;；]/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (let i = 0; i < segments.length; i += 1) {
          const pages = parsePages(segments[i], total);
          if (pages.length === 0) continue;
          const part = await PDFDocument.create();
          const copied = await part.copyPages(
            doc,
            pages.map((p) => p - 1)
          );
          for (const p of copied) part.addPage(p);
          const data = await part.save({ useObjectStreams: true });
          outs.push({ name: `${base}_第${i + 1}段(${segments[i]}).pdf`, data: toBase64(data) });
        }
        if (outs.length === 0) return Response.json({ error: "页码范围内没有有效页" }, { status: 400 });
      } else {
        // 每页一个文件
        if (total > 60) {
          return Response.json({ error: `页数过多（${total} 页），请改用页码范围拆分` }, { status: 400 });
        }
        for (let i = 0; i < total; i += 1) {
          const part = await PDFDocument.create();
          const [copied] = await part.copyPages(doc, [i]);
          part.addPage(copied);
          const data = await part.save({ useObjectStreams: true });
          outs.push({ name: `${base}_p${i + 1}.pdf`, data: toBase64(data) });
        }
      }
      return Response.json({
        ok: true,
        text: `已拆分为 ${outs.length} 个文件（原 ${total} 页）`,
        files: outs,
      });
    }

    if (action === "extract") {
      const doc = await PDFDocument.load(bytesList[0], { ignoreEncryption: true });
      const total = doc.getPageCount();
      const pages = parsePages(body.pages ?? "1", total);
      if (pages.length === 0) return Response.json({ error: "请填写有效页码，如 1,3,5-7" }, { status: 400 });
      const out = await PDFDocument.create();
      const copied = await out.copyPages(
        doc,
        pages.map((p) => p - 1)
      );
      for (const p of copied) out.addPage(p);
      const data = await out.save({ useObjectStreams: true });
      const base = (files[0].name || "doc").replace(/\.pdf$/i, "");
      return Response.json({
        ok: true,
        text: `已提取 ${pages.length} 页（${pages.join("、")}）→ ${fmtSize(data.byteLength)}`,
        files: [{ name: `${base}_提取.pdf`, data: toBase64(data) }],
      });
    }

    if (action === "rotate") {
      const angle = [90, 180, 270].includes(Number(body.angle)) ? Number(body.angle) : 90;
      const doc = await PDFDocument.load(bytesList[0], { ignoreEncryption: true });
      const total = doc.getPageCount();
      const pages = body.pages?.trim() ? parsePages(body.pages, total) : doc.getPageIndices().map((i) => i + 1);
      for (const p of pages) {
        const page = doc.getPage(p - 1);
        page.setRotation(degrees((page.getRotation().angle + angle) % 360));
      }
      const data = await doc.save({ useObjectStreams: true });
      const base = (files[0].name || "doc").replace(/\.pdf$/i, "");
      return Response.json({
        ok: true,
        text: `已旋转 ${pages.length} 页（${angle}°）`,
        files: [{ name: `${base}_rotated.pdf`, data: toBase64(data) }],
      });
    }

    return Response.json({ error: `不支持的操作：${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF 处理失败";
    return Response.json({ error: /encrypt/i.test(msg) ? "该 PDF 已加密，暂无法处理" : msg }, { status: 500 });
  }
}

/** 探测：告诉前端当前环境是否可用（有密钥时 OCR 才可用，此处只回 PDF 能力） */
export async function GET() {
  return Response.json({
    actions: ["info", "merge", "split", "extract", "rotate"],
    maxFiles: MAX_FILES,
    maxBytes: MAX_BYTES,
  });
}
