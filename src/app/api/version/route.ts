/**
 * 版本信息（O8）。
 *
 * 构建时经 next.config.mjs 注入 commit sha 与构建时间，运行时只读不重算。
 * commit 走 Next 的 BUILD_ID，构建时间走 env 静态替换（见 next.config.mjs）。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    version: process.env.npm_package_version ?? "0.1.0",
    commit: process.env.BUILD_ID ?? "unknown",
    builtAt: process.env.BUILD_TIME ?? "unknown",
    node: process.version,
  });
}