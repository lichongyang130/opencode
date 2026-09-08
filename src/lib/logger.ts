/**
 * 结构化 JSON 日志（O1/O2/O6）。
 *
 * 全库原先只有零散 `console.error`，没有 requestId / 级别 / 脱敏，
 * 出问题只能靠人工猜。这里统一收口：
 * - 单行 JSON 输出，字段含 level / time / msg / requestId / route 等，方便日志采集管道解析；
 * - 分级开关：生产只出 info 及以上，开发保留 debug，测试静默；
 * - 脱敏：apiKey / token / Authorization / base64 图片体绝不落日志。
 *
 * requestId 不在这里逐层传参，而是由 withRoute 写入 AsyncLocalStorage，
 * 本模块通过 request-context 自动附加，业务代码用 logger.* 时无感知。
 */

import { currentRequestId, currentRoute } from "./request-context";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

export type LogFields = Record<string, unknown>;

function resolveLevel(): LogLevel {
  const env = process.env.OC_LOG_LEVEL?.toLowerCase();
  if (env && env in LEVEL_ORDER) return env as LogLevel;
  // 测试环境默认静默，避免把用例输出刷满噪音，也不影响真实运行
  if (process.env.NODE_ENV === "test") return "silent";
  if (process.env.NODE_ENV === "production") return "info";
  return "debug";
}

/** 脱敏关键名单：命中即整值替换，无论值是什么类型 */
const EXACT_HIDDEN = new Set(["authorization", "apiKey", "apikey", "key"]);

/** 模糊命中的敏感片段，值必须转成字符串后才能替换 */
const CONTAINS_HIDDEN = ["secret", "password", "credential", "token", "apikey"];

/** 超过这个字符数的字符串直接截断，防止一条超长文本把日志撑爆 */
const MAX_STRING_LENGTH = 500;

// http/https 地址里夹带签名/密钥的场景：http://host/k?sig=xxx -> http://host/k?sig=[redacted]
const URL_SIGNATURE_RE = /([?&](?:sig|sign|signature|token|key|api_key|apikey)=)[^&\s]+/gi;
const DATA_URI_RE = /^(data:[^,]*?,).*$/s;

/** 字符串级脱敏：打码 URL 签名、base64 图片体，超长截断 */
function maskString(value: string): string {
  let out = value;
  out = out.replace(URL_SIGNATURE_RE, "$1[redacted]");
  if (out.startsWith("data:")) {
    out = out.replace(DATA_URI_RE, "$1[base64 内容已省略]");
  }
  if (out.length > MAX_STRING_LENGTH) {
    out = `${out.slice(0, MAX_STRING_LENGTH)}…（截断 ${out.length - MAX_STRING_LENGTH} 字符）`;
  }
  return out;
}

function hiddenKey(key: unknown): boolean {
  const k = typeof key === "string" ? key.toLowerCase() : "";
  if (EXACT_HIDDEN.has(k)) return true;
  return CONTAINS_HIDDEN.some((s) => k.includes(s));
}

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 4) return "[嵌套过深已省略]";

  if (typeof value === "string") return maskString(value);
  if (typeof value === "number" || typeof value === "boolean") {
    // 数字/布尔不脱敏：usage 里的 token 计数、布尔开关必须原样留存
    return value;
  }
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;

  // Error 对象既非普通对象又无 toJSON，单独展开，保证错误信息真正落进日志
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: maskString(value.stack ?? ""),
    };
  }

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForLog(v, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const item = (value as Record<string, unknown>)[key];
    out[key] = hiddenKey(key) ? "[redacted]" : sanitizeForLog(item, depth + 1);
  }
  return out;
}

function emit(level: Exclude<LogLevel, "silent">, msg: string, fields: LogFields): void {
  if (resolveLevel() === "silent") return;
  const order = LEVEL_ORDER[resolveLevel()];
  if (LEVEL_ORDER[level] < order) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(currentRequestId() ? { requestId: currentRequestId() } : {}),
    ...(currentRoute() ? { route: currentRoute() } : {}),
    ...(Object.keys(fields).length > 0 ? { fields: sanitizeForLog(fields) } : {}),
  };

  const line = JSON.stringify(entry);
  // debug/info 走 stdout，warn/error 走 stderr，配合进程收集管道分别处理
  if (level === "warn" || level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(msg: string, fields: LogFields = {}): void {
    emit("debug", msg, fields);
  },
  info(msg: string, fields: LogFields = {}): void {
    emit("info", msg, fields);
  },
  warn(msg: string, fields: LogFields = {}): void {
    emit("warn", msg, fields);
  },
  error(msg: string, fields: LogFields = {}): void {
    emit("error", msg, fields);
  },
};