// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * localStorage 安全封装测试。
 *
 * 三类真实故障现场都要覆盖：SSR 无 window、隐私模式禁用存储、配额写满。
 * 关键契约是「任何情况下都不抛异常」，且不可用时降级到内存桶后本次会话读写仍自洽 ——
 * 早先散在各处的裸 localStorage 调用就是在这三种现场直接把整块 UI 打崩的。
 */

type Mod = typeof import("./safe-storage");
let m: Mod;

beforeEach(async () => {
  vi.resetModules();
  m = await import("./safe-storage");
  window.localStorage.clear();
  m.resetStorageProbe();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("可用性探针", () => {
  it("正常浏览器环境判定为可用", () => {
    expect(m.storageAvailable()).toBe(true);
  });

  it("探针写入失败时判定为不可用", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(m.storageAvailable()).toBe(false);
  });

  it("探针键不会残留在存储里", () => {
    m.storageAvailable();
    expect(window.localStorage.getItem("__oc_probe__")).toBeNull();
  });

  it("结果被缓存，不会每次读写都重跑探针", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    m.storageAvailable();
    m.storageAvailable();
    m.storageAvailable();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("原始字符串读写", () => {
  it("写入后能读回", () => {
    expect(m.writeRaw("k", "v")).toBe(true);
    expect(m.readRaw("k")).toBe("v");
  });

  it("不存在的键返回 null", () => {
    expect(m.readRaw("missing")).toBeNull();
  });

  it("removeKey 之后读不到", () => {
    m.writeRaw("k", "v");
    m.removeKey("k");
    expect(m.readRaw("k")).toBeNull();
  });

  it("getItem 抛错时回退内存桶且上报 read", () => {
    const seen: string[] = [];
    m.onStorageError((e) => seen.push(e.kind));
    m.writeRaw("k", "v");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("boom");
    });
    // 内存桶里没有这个键（写入成功走的是真 localStorage），只要不抛就算过
    expect(m.readRaw("k")).toBeNull();
    expect(seen).toContain("read");
  });

  it("removeItem 抛错也不冒泡", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => m.removeKey("k")).not.toThrow();
  });
});

describe("存储不可用时降级到内存", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    m.resetStorageProbe();
  });

  it("writeRaw 返回 false 但值仍可读回", () => {
    expect(m.writeRaw("k", "v")).toBe(false);
    expect(m.readRaw("k")).toBe("v");
  });

  it("上报 unavailable", () => {
    const seen: string[] = [];
    m.onStorageError((e) => seen.push(e.kind));
    m.writeRaw("k", "v");
    expect(seen).toEqual(["unavailable"]);
  });

  it("readJSON / writeJSON 在内存桶里闭环", () => {
    m.writeJSON("cfg", { a: 1 });
    expect(m.readJSON("cfg", null)).toEqual({ a: 1 });
  });

  it("removeKey 能清掉内存桶里的值", () => {
    m.writeRaw("k", "v");
    m.removeKey("k");
    expect(m.readRaw("k")).toBeNull();
  });
});

describe("配额写满", () => {
  /** 造一个浏览器口径的 QuotaExceededError */
  function quotaError(name = "QuotaExceededError", code?: number) {
    const e = new Error("quota");
    e.name = name;
    if (code !== undefined) Object.assign(e, { code });
    return e;
  }

  it("写满时上报 quota 并落内存，不丢当次数据", () => {
    const seen: string[] = [];
    m.onStorageError((e) => seen.push(e.kind));
    // 探针先跑通（此时判定可用），随后真实写入才失败
    expect(m.storageAvailable()).toBe(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError();
    });
    expect(m.writeRaw("k", "big")).toBe(false);
    expect(seen).toEqual(["quota"]);
    expect(m.readRaw("k")).toBe("big");
  });

  it("识别 Firefox 的 NS_ERROR_DOM_QUOTA_REACHED", () => {
    const seen: string[] = [];
    m.onStorageError((e) => seen.push(e.kind));
    m.storageAvailable();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError("NS_ERROR_DOM_QUOTA_REACHED");
    });
    m.writeRaw("k", "v");
    expect(seen).toEqual(["quota"]);
  });

  it.each([22, 1014])("识别 legacy code %i", (code) => {
    const seen: string[] = [];
    m.onStorageError((e) => seen.push(e.kind));
    m.storageAvailable();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError("SomeOtherError", code);
    });
    m.writeRaw("k", "v");
    expect(seen).toEqual(["quota"]);
  });

  it("非配额类写入失败归到 write", () => {
    const seen: string[] = [];
    m.onStorageError((e) => seen.push(e.kind));
    m.storageAvailable();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("unknown");
    });
    m.writeRaw("k", "v");
    expect(seen).toEqual(["write"]);
  });
});

describe("JSON 读写", () => {
  it("写入后能按类型读回", () => {
    m.writeJSON("cfg", { theme: "dark", n: 2 });
    expect(m.readJSON("cfg", {})).toEqual({ theme: "dark", n: 2 });
  });

  it("键不存在时返回 fallback", () => {
    expect(m.readJSON("missing", { d: 1 })).toEqual({ d: 1 });
  });

  it("空字符串视为无值", () => {
    m.writeRaw("k", "");
    expect(m.readJSON("k", "fb")).toBe("fb");
  });

  it("存的是 null 时返回 fallback", () => {
    m.writeRaw("k", "null");
    expect(m.readJSON("k", "fb")).toBe("fb");
  });

  it("坏 JSON 返回 fallback、上报 parse 并清掉脏键", () => {
    const seen: string[] = [];
    m.onStorageError((e) => seen.push(e.kind));
    m.writeRaw("k", "{ 坏数据");
    expect(m.readJSON("k", "fb")).toBe("fb");
    expect(seen).toEqual(["parse"]);
    // 不清掉的话用户每次进页面都会踩同一条坏记录
    expect(m.readRaw("k")).toBeNull();
  });

  it("循环引用序列化失败时返回 false 且上报 write", () => {
    const seen: string[] = [];
    m.onStorageError((e) => seen.push(e.kind));
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(m.writeJSON("k", cyclic)).toBe(false);
    expect(seen).toEqual(["write"]);
  });
});

describe("批量操作", () => {
  it("allKeys 合并真实存储与内存桶", () => {
    m.writeRaw("real", "1");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    m.resetStorageProbe();
    m.writeRaw("mem", "2");
    expect(m.allKeys().sort()).toEqual(["mem"]);
  });

  it("allKeys 列出已写入的键", () => {
    m.writeRaw("oc:a", "1");
    m.writeRaw("oc:b", "2");
    expect(m.allKeys().sort()).toEqual(["oc:a", "oc:b"]);
  });

  it("removeByPrefix 只删命中前缀的键并返回条数", () => {
    m.writeRaw("oc:a", "1");
    m.writeRaw("oc:b", "2");
    m.writeRaw("other", "3");
    expect(m.removeByPrefix("oc:")).toBe(2);
    expect(m.readRaw("oc:a")).toBeNull();
    expect(m.readRaw("other")).toBe("3");
  });

  it("前缀无命中时返回 0", () => {
    expect(m.removeByPrefix("nope:")).toBe(0);
  });

  it("estimateBytes 按 UTF-16 双字节口径统计", () => {
    m.writeRaw("ab", "cd");
    expect(m.estimateBytes()).toBe((2 + 2) * 2);
  });

  it("estimateBytes 支持按前缀过滤", () => {
    m.writeRaw("oc:x", "1");
    m.writeRaw("zz", "1");
    expect(m.estimateBytes("oc:")).toBe((4 + 1) * 2);
  });

  it("列键失败时只统计内存桶，不抛错", () => {
    vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => m.allKeys()).not.toThrow();
  });
});

describe("错误订阅", () => {
  it("退订后不再收到通知", () => {
    const seen: string[] = [];
    const off = m.onStorageError((e) => seen.push(e.kind));
    m.writeRaw("k", "{bad");
    m.readJSON("k", null);
    expect(seen).toEqual(["parse"]);
    off();
    m.writeRaw("k2", "{bad");
    m.readJSON("k2", null);
    expect(seen).toEqual(["parse"]);
  });

  it("监听器自身抛错不会打断存储流程", () => {
    m.onStorageError(() => {
      throw new Error("listener boom");
    });
    const seen: string[] = [];
    m.onStorageError((e) => seen.push(e.kind));
    m.writeRaw("k", "{bad");
    expect(() => m.readJSON("k", null)).not.toThrow();
    expect(seen).toEqual(["parse"]);
  });

  it("回调里带上出错的键名", () => {
    let key = "";
    m.onStorageError((e) => {
      key = e.key;
    });
    m.writeRaw("dirty", "{bad");
    m.readJSON("dirty", null);
    expect(key).toBe("dirty");
  });
});

describe("错误文案", () => {
  it.each([
    ["quota", "本地存储空间已满"],
    ["unavailable", "浏览器禁用了本地存储"],
    ["parse", "检测到损坏的本地数据"],
    ["write", "本地存储读写失败"],
    ["read", "本地存储读写失败"],
  ] as const)("%s 有对应的中文提示", (kind, expected) => {
    expect(m.describeStorageError({ kind, key: "k" })).toContain(expected);
  });
});