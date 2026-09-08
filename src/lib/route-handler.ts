/**
 * 路由包装器（O4/O11 与限流的编排入口）。
 *
 * 每个 API 路由的导出函数包一层 withRoute，统一负责：
 * 1. 生成/透传 requestId，写入 AsyncLocalStorage 与响应头 x-request-id；
 * 2. 按「IP + 路由」做限流（AI 路由自动套用更严口径），命中返回 429 + Retry-After；
 * 3. 记录访问日志与耗时，超过慢阈值单独 warn；
 * 4. 兜底捕获 handler 抛出的异常，转成 500 而非让 Next 吐堆栈。
 *
 * 业务 handler 只需关心正常路径，requestId 经 logger 自动附加，无需逐层传参。
 */
import crypto from "node:crypto";
import { logger } from "./logger";
import { runWithRequestContext } from "./request-context";
import {
  checkRateLimit,
  defaultPolicyFor,
  extractIp,
  rateLimitError,
  type RateLimitPolicy,
} from "./rate-limit";
import { recordDuration } from "./metrics";
import { installProcessGuards } from "./process-guard";

export interface RouteCtx {
  params: Record<string, string>;
}

export type RouteHandler<TCtx = RouteCtx> = (
  req: Request,
  ctx: TCtx
) => Response | Promise<Response>;

export interface WithRouteOptions {
  /** 路由名（用于日志 route 字段与限流维度），默认取请求路径 */
  name?: string;
  /** 慢请求告警阈值毫秒；0 表示关闭（SSE 长连接应关闭） */
  slowMs?: number;
  rateLimit?: RateLimitPolicy | false;
}

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** 请求自带的 requestId 需格式合法才沿用，否则重生成，防止注入奇怪字段到日志 */
function pickRequestId(req: Request): string {
  const incoming = req.headers.get("x-request-id");
  if (incoming && REQUEST_ID_RE.test(incoming)) return incoming;
  return crypto.randomUUID();
}

function routeName(req: Request, name?: string): string {
  if (name) return name;
  try {
    return new URL(req.url).pathname;
  } catch {
    return req.url;
  }
}

function withRequestIdHeader(res: Response, requestId: string): Response {
  if (res.headers.has("x-request-id")) return res;
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: { ...Object.fromEntries(res.headers.entries()), "x-request-id": requestId },
  });
}

const DEFAULT_SLOW_MS = 5_000;

export function withRoute<TCtx = RouteCtx>(
  handler: RouteHandler<TCtx>,
  options: WithRouteOptions = {}
): ((req: Request, ctx?: TCtx) => Promise<Response>) {
  const slowMs = options.slowMs === undefined ? DEFAULT_SLOW_MS : options.slowMs;

  return async function wrapped(req: Request, ctx = { params: {} } as TCtx): Promise<Response> {
    installProcessGuards();

    const startedAt = Date.now();
    const requestId = pickRequestId(req);
    const name = routeName(req, options.name);

    return runWithRequestContext({ requestId, route: name }, async () => {
      // 限流：命中直接 429，不再进入 handler；测试环境可显式关闭避免功能用例互相触发
      if (options.rateLimit !== false && process.env.OC_RATE_LIMIT_DISABLED !== "1") {
        const policy = options.rateLimit ?? defaultPolicyFor(name);
        const result = checkRateLimit(name, extractIp(req), policy);
        if (!result.allowed) {
          logger.warn("限流命中", { ip: extractIp(req), limit: result.limit });
          return withRequestIdHeader(rateLimitError(policy), requestId);
        }
      }

      const method = req.method;
      logger.debug("请求进入", { method, path: name });

      try {
        const res = await handler(req, ctx);
        const elapsed = Date.now() - startedAt;
        recordDuration(elapsed);
        logger.info("请求完成", {
          method,
          status: res.status,
          durationMs: elapsed,
        });
        if (slowMs > 0 && elapsed > slowMs) {
          logger.warn("慢请求", { method, durationMs: elapsed, thresholdMs: slowMs });
        }
        return withRequestIdHeader(res, requestId);
      } catch (err) {
        const elapsed = Date.now() - startedAt;
        recordDuration(elapsed);
        logger.error("请求处理异常", { method, durationMs: elapsed, err });
        return withRequestIdHeader(
          Response.json({ error: "服务器内部错误" }, { status: 500 }),
          requestId
        );
      }
    });
  };
}
