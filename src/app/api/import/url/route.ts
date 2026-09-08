import { NextResponse } from "next/server";
import { BlockedAddressError, safeFetch } from "@/lib/net-guard";
import { readJsonBody } from "@/lib/http";
import { logger } from "@/lib/logger";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * URL 抓取入库：拉取网页正文（去标签），供知识库导入。
 * 只允许公网 http/https，逐跳校验重定向目标，限制响应大小与超时，
 * 避免被当作任意代理或用来探测内网 / 云元数据服务。
 */
export const POST = withRoute(async (req: Request) => {
  try {
    const body = await readJsonBody<{ url?: string }>(req);
    if (!body) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }
    const { url } = body;
    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "请提供 http/https 链接" }, { status: 400 });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    let html: string;
    try {
      const res = await safeFetch(url.trim(), {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OpenCanvasBot/1.0)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        },
      });
      if (!res.ok) {
        // 只回传状态码，不透出上游响应体；url 交给 logger 脱敏签名参数
        logger.error("URL 抓取失败", { url, status: res.status });
        return NextResponse.json(
          { error: `目标站点返回 ${res.status}，无法抓取` },
          { status: 502 }
        );
      }
      html = (await res.text()).slice(0, 2_000_000);
    } finally {
      clearTimeout(timer);
    }

    // 提取标题
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = (titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || "网页内容";

    // 去脚本/样式，再剥标签，压缩空白
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim()
      .slice(0, 20_000);

    if (!text) {
      return NextResponse.json({ error: "未能从该页面提取到正文" }, { status: 422 });
    }

    return NextResponse.json({
      title,
      text,
      bytes: text.length,
      source: url.trim(),
    });
  } catch (e) {
    // 地址被安全策略拦截时把具体原因告知用户（不含上游内容）
    if (e instanceof BlockedAddressError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "抓取超时，请稍后重试" }, { status: 504 });
    }
    logger.error("URL 抓取异常", { err: e });
    return NextResponse.json({ error: "抓取失败，请稍后重试" }, { status: 500 });
  }
});
