/**
 * 请求上下文的 AsyncLocalStorage 存取（O4）。
 *
 * 把 requestId / route 这类「每个请求一份、但不想每个函数都传一遍」的数据
 * 放进 AsyncLocalStorage：withRoute 在入口写入，logger 直接读取并自动附加。
 * 关键点：本模块被 logger 引用，而 middleware 跑在 edge runtime，
 * 所以这里绝不能 import 任何 Node 专有 API 之外的东西被 middleware 间接引入——
 * 本文件只依赖 node:async_hooks，middleware 不会 import logger 因此无碍。
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  route: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function currentRoute(): string | undefined {
  return storage.getStore()?.route;
}