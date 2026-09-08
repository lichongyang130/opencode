/**
 * localStorage 安全封装。
 *
 * 裸调用 localStorage 有三类会抛异常的现场，散在各处 try/catch 既啰嗦又容易漏：
 *  1. SSR / 构建期没有 window；
 *  2. 浏览器隐私模式或站点被禁用存储，getItem 本身就 throw；
 *  3. 配额写满（QuotaExceededError），写入失败但读取仍正常。
 *
 * 这里统一兜住，并在 localStorage 不可用时降级到进程内 Map ——
 * 本次会话仍能正常读写（刷新后丢失），而不是整块功能崩掉。
 */

export type StorageErrorKind = "unavailable" | "quota" | "parse" | "write" | "read";

export interface StorageError {
  kind: StorageErrorKind;
  key: string;
  error?: unknown;
}

type Listener = (e: StorageError) => void;

const listeners = new Set<Listener>();

/** 订阅存储异常（UI 层挂一次即可把失败暴露给用户），返回退订函数 */
export function onStorageError(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(kind: StorageErrorKind, key: string, error?: unknown) {
  const payload: StorageError = { kind, key, error };
  for (const fn of listeners) {
    try {
      fn(payload);
    } catch {
      // 监听器自身异常不能反过来打断存储流程
    }
  }
}

/** 降级用的内存桶：localStorage 不可用时接管，保证当前会话内读写自洽 */
const memory = new Map<string, string>();

let available: boolean | null = null;

/** localStorage 是否真的可用（探针写入一次，结果缓存） */
export function storageAvailable(): boolean {
  if (available !== null) return available;
  if (typeof window === "undefined") {
    available = false;
    return false;
  }
  try {
    const probe = "__oc_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/** 仅供测试：清掉可用性缓存与内存桶 */
export function resetStorageProbe(): void {
  available = null;
  memory.clear();
}

function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const name = (e as { name?: string }).name;
  const code = (e as { code?: number }).code;
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}

/**
 * 读原始字符串；不存在或读取失败一律返回 null。
 *
 * 内存桶优先：只有「localStorage 可用但写入失败」（典型是配额写满）时内存桶才有值，
 * 此时它一定比 localStorage 里的旧值更新。若仍先读 localStorage，
 * writeRaw 的配额降级就只是写进了一个永远读不到的地方，等于当次改动照旧丢失。
 */
export function readRaw(key: string): string | null {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  if (!storageAvailable()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    emit("read", key, e);
    return null;
  }
}

/** 写原始字符串；返回是否真正落到 localStorage */
export function writeRaw(key: string, value: string): boolean {
  if (!storageAvailable()) {
    memory.set(key, value);
    emit("unavailable", key);
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    // 落盘成功后必须清掉内存桶里的旧值，否则上一次配额降级留下的陈旧内容
    // 会被 readRaw 的「内存优先」策略一直读到，把新写的值盖掉
    memory.delete(key);
    return true;
  } catch (e) {
    // 配额满时同样落内存，避免用户当前这一次操作直接丢数据
    memory.set(key, value);
    emit(isQuotaError(e) ? "quota" : "write", key, e);
    return false;
  }
}

export function removeKey(key: string): void {
  memory.delete(key);
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    emit("write", key, e);
  }
}

/**
 * 读 JSON。解析失败视为脏数据：返回 fallback 并清掉该键，
 * 否则用户会被一条坏记录永久卡住（每次进页面都解析失败）。
 */
export function readJSON<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null || raw === "") return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    emit("parse", key, e);
    removeKey(key);
    return fallback;
  }
}

/** 写 JSON；序列化失败（循环引用等）也不抛 */
export function writeJSON(key: string, value: unknown): boolean {
  let raw: string;
  try {
    raw = JSON.stringify(value);
  } catch (e) {
    emit("write", key, e);
    return false;
  }
  return writeRaw(key, raw);
}

/** 列出所有键（含内存降级桶里的） */
export function allKeys(): string[] {
  const out = new Set<string>(memory.keys());
  if (storageAvailable()) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k) out.add(k);
      }
    } catch {
      // 读键失败就只返回内存桶里的
    }
  }
  return [...out];
}

/** 按前缀批量删除（清空本机数据用），返回删除条数 */
export function removeByPrefix(prefix: string): number {
  const hit = allKeys().filter((k) => k.startsWith(prefix));
  for (const k of hit) removeKey(k);
  return hit.length;
}

/** 估算占用字节数（UTF-16 计 2 字节，与浏览器配额口径一致） */
export function estimateBytes(prefix?: string): number {
  let total = 0;
  for (const k of allKeys()) {
    if (prefix && !k.startsWith(prefix)) continue;
    total += (k.length + (readRaw(k)?.length ?? 0)) * 2;
  }
  return total;
}

/** 存储异常的中文提示文案，供 UI 直接展示 */
export function describeStorageError(e: StorageError): string {
  switch (e.kind) {
    case "quota":
      return "本地存储空间已满，改动仅在本次会话生效，请到设置中心清理数据";
    case "unavailable":
      return "浏览器禁用了本地存储，设置将无法在刷新后保留";
    case "parse":
      return "检测到损坏的本地数据，已重置为默认值";
    default:
      return "本地存储读写失败";
  }
}