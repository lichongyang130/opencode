import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * 数据库自愈测试（R15）。
 *
 * 断电、磁盘写满、外部程序误改都可能让 sqlite 文件损坏。改造前任何一次查询都会抛
 * SQLITE_CORRUPT，整个应用白屏且没有自救路径。现在开库后立刻 integrity_check，
 * 坏了就把原库归档（不删，留给 sqlite3 recover 抢救）再重建空库。
 *
 * 每个用例独立临时目录，绝不碰开发库 data/dev.db。
 */

let tempDir: string;
let dbFile: string;
type Mod = typeof import("./sqlite");
let m: Mod;

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "oc-sqlite-"));
  process.env.OC_DATA_DIR = tempDir;
  dbFile = path.join(tempDir, "dev.db");
  // db 是模块级单例，不重置会继续用上一个用例的临时目录连接
  vi.resetModules();
  m = await import("./sqlite");
});

afterEach(() => {
  m?.closeDb();
  delete process.env.OC_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** 列出归档出来的坏库文件 */
const corruptFiles = () => readdirSync(tempDir).filter((f) => f.includes(".corrupt-"));

describe("dataDir", () => {
  it("优先取 OC_DATA_DIR", () => {
    expect(m.dataDir()).toBe(tempDir);
  });

  it("未设置时回落到 cwd/data", async () => {
    delete process.env.OC_DATA_DIR;
    vi.resetModules();
    const fresh = await import("./sqlite");
    expect(fresh.dataDir()).toBe(path.join(process.cwd(), "data"));
  });
});

describe("正常开库", () => {
  it("首次调用建库并创建全部表", () => {
    const db = m.getDb();
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(tables).toContain("conversations");
    expect(tables).toContain("messages");
    expect(tables).toContain("case_shares");
    expect(tables).toContain("membership");
    expect(tables).toContain("orders");
  });

  it("目录不存在时自动创建", () => {
    const nested = path.join(tempDir, "a", "b");
    process.env.OC_DATA_DIR = nested;
    m.getDb();
    expect(existsSync(path.join(nested, "dev.db"))).toBe(true);
  });

  it("重复调用返回同一个单例", () => {
    expect(m.getDb()).toBe(m.getDb());
  });

  it("closeDb 之后能重新打开", () => {
    m.getDb();
    m.closeDb();
    expect(() => m.getDb()).not.toThrow();
  });

  it("closeDb 可重复调用", () => {
    m.getDb();
    m.closeDb();
    expect(() => m.closeDb()).not.toThrow();
  });

  it("开库时启用 WAL 与外键约束", () => {
    const db = m.getDb();
    const mode = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    const fk = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(String(mode.journal_mode).toLowerCase()).toBe("wal");
    expect(fk.foreign_keys).toBe(1);
  });

  it("健康库不会被归档", () => {
    m.getDb();
    expect(m.lastQuarantinedDb()).toBeNull();
    expect(corruptFiles()).toHaveLength(0);
  });

  it("已有数据的库重开后数据仍在", () => {
    m.getDb().exec("INSERT INTO orders (id, plan, amount, status, createdAt) VALUES ('o1','pro',1,'paid',1)");
    m.closeDb();
    const rows = m.getDb().prepare("SELECT id FROM orders").all() as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(["o1"]);
  });
});

describe("损坏自愈", () => {
  it("文件根本不是 sqlite 库时归档并重建", () => {
    writeFileSync(dbFile, "这不是数据库，只是一段被别的程序写坏的文本");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const db = m.getDb();
    // 新库可用
    expect(() => db.prepare("SELECT COUNT(*) FROM conversations").get()).not.toThrow();
    // 原库被归档而不是删除，留给 sqlite3 recover 抢救
    const archived = corruptFiles();
    expect(archived).toHaveLength(1);
    expect(readFileSync(path.join(tempDir, archived[0]), "utf8")).toContain("只是一段被别的程序写坏的文本");
    expect(m.lastQuarantinedDb()).toBe(path.join(tempDir, archived[0]));
    expect(errSpy).toHaveBeenCalled();
  });

  it("合法 sqlite 头但页数据被写坏时同样自愈", () => {
    // 先建一个真库，再把中间的页填成垃圾，保留文件头骗过 magic 校验
    m.getDb().exec("INSERT INTO orders (id, plan, amount, status, createdAt) VALUES ('o1','pro',1,'paid',1)");
    m.closeDb();
    const buf = readFileSync(dbFile);
    buf.fill(0xff, 1024, Math.min(buf.length, 8192));
    writeFileSync(dbFile, buf);
    // WAL 里还留着完好的页，会掩盖损坏，一并清掉才能复现真实的坏库现场
    for (const suffix of ["-wal", "-shm"]) rmSync(`${dbFile}${suffix}`, { force: true });
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.resetModules();
    const db = m.getDb();
    expect(() => db.prepare("SELECT COUNT(*) FROM conversations").get()).not.toThrow();
    expect(corruptFiles().length).toBeGreaterThanOrEqual(1);
  });

  it("自愈后不残留旧 WAL 内容，新库不会读到陈旧页", () => {
    writeFileSync(dbFile, "坏库");
    writeFileSync(`${dbFile}-wal`, "旧 wal");
    writeFileSync(`${dbFile}-shm`, "旧 shm");
    vi.spyOn(console, "error").mockImplementation(() => {});

    m.getDb();
    // 坏库被打开时 sqlite 自己就清掉了旧 WAL/SHM，归档里的 rename 是兜底；
    // 这里只钉最终结果：新库的 WAL 是全新的，绝不含旧内容
    const wal = `${dbFile}-wal`;
    if (existsSync(wal)) {
      expect(readFileSync(wal, "utf8")).not.toContain("旧 wal");
    }
    expect(corruptFiles()).toHaveLength(1);
  });

  it("自愈后表结构完整，可正常读写", () => {
    writeFileSync(dbFile, "坏库");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const db = m.getDb();
    db.exec("INSERT INTO orders (id, plan, amount, status, createdAt) VALUES ('n1','pro',9,'paid',1)");
    const row = db.prepare("SELECT plan FROM orders WHERE id='n1'").get() as { plan: string };
    expect(row.plan).toBe("pro");
  });

  it("归档文件名带 ISO 时间戳，多次自愈不互相覆盖", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(dbFile, "坏库 1");
    m.getDb();
    const first = m.lastQuarantinedDb();
    expect(first).toMatch(/\.corrupt-\d{4}-\d{2}-\d{2}T/);

    m.closeDb();
    writeFileSync(dbFile, "坏库 2");
    vi.resetModules();
    const again = await import("./sqlite");
    // 同一毫秒内触发两次会撞名，等 2ms 确保时间戳不同
    await new Promise((r) => setTimeout(r, 2));
    again.getDb();
    expect(corruptFiles().length).toBeGreaterThanOrEqual(2);
    again.closeDb();
  });

  it("lastQuarantinedDb 在健康库上被复位，不残留上一次的路径", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(dbFile, "坏库");
    m.getDb();
    expect(m.lastQuarantinedDb()).not.toBeNull();

    m.closeDb();
    vi.resetModules();
    const fresh = await import("./sqlite");
    fresh.getDb();
    expect(fresh.lastQuarantinedDb()).toBeNull();
    fresh.closeDb();
  });
});

describe("旧库迁移", () => {
  /** 造一个只有最初几列的老库，模拟历史版本留下的文件 */
  function legacyDb() {
    const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
    const conn = new DatabaseSync(dbFile);
    conn.exec(`
      CREATE TABLE conversations (
        id        TEXT PRIMARY KEY,
        title     TEXT NOT NULL DEFAULT '新任务',
        mode      TEXT NOT NULL DEFAULT 'chat',
        model     TEXT NOT NULL DEFAULT 'demo',
        createdAt REAL NOT NULL,
        updatedAt REAL NOT NULL
      );
    `);
    conn.exec("INSERT INTO conversations (id, createdAt, updatedAt) VALUES ('old', 1, 1)");
    conn.close();
  }

  it("自动补齐后续版本新增的列", () => {
    legacyDb();
    const cols = (
      m.getDb().prepare("PRAGMA table_info(conversations)").all() as { name: string }[]
    ).map((c) => c.name);
    for (const col of ["archived", "pinned", "report", "modelProvider", "doc", "personaId"]) {
      expect(cols).toContain(col);
    }
  });

  it("迁移不影响老数据", () => {
    legacyDb();
    const row = m.getDb().prepare("SELECT id, title FROM conversations WHERE id='old'").get() as {
      id: string;
      title: string;
    };
    expect(row).toMatchObject({ id: "old", title: "新任务" });
  });

  it("重复开库不会重复执行 ALTER", () => {
    legacyDb();
    m.getDb();
    m.closeDb();
    expect(() => m.getDb()).not.toThrow();
  });
});

// DB16 的调度器专项测试（异常分支 / 去重 / 清理）在 db-maintenance.test.ts，
// 这里只验证开库流程与调度器集成不互相干扰。
describe("DB16 定期 PRAGMA optimize 集成", () => {
  it("开库即调度 optimize，closeDb 清理后可正常重开", () => {
    expect(() => {
      m.getDb();
      m.getDb().exec("PRAGMA optimize");
      m.closeDb();
      m.getDb();
    }).not.toThrow();
  });
});

describe("dbHealthy 与防御分支", () => {
  it("数据目录不可创建时 dbHealthy 返回 false 而非抛错", async () => {
    // 用临时文件占住路径：mkdirSync 会 ENOTDIR，getDb 抛错被 dbHealthy 捕获
    const blocker = path.join(tempDir, "blocker");
    writeFileSync(blocker, "x");
    vi.resetModules();
    const m2 = await import("./sqlite");
    process.env.OC_DATA_DIR = path.join(blocker, "sub");
    try {
      expect(m2.dbHealthy()).toBe(false);
    } finally {
      // 恢复目录，afterEach 的 rmSync 才能清理
      delete process.env.OC_DATA_DIR;
      process.env.OC_DATA_DIR = tempDir;
      m2.closeDb();
    }
  });
});

describe("quarantine 防御分支", () => {
  it("renameSync 失败时回退为删除坏库，应用仍能重建空库", async () => {
    vi.resetModules();
    // node:fs 的 ESM 导出不可 spyOn（Cannot redefine property），
    // 只能走 vi.doMock 在本用例内替换 renameSync 为抛错实现。
    await vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();
      return {
        ...actual,
        renameSync: () => {
          throw new Error("EROFS: read-only file system");
        },
      };
    });
    try {
      // 写一个假坏库触发自愈路径
      writeFileSync(dbFile, "not a sqlite file at all");
      const m2 = await import("./sqlite");
      expect(() => m2.getDb()).not.toThrow();
      // 坏库文件已被 rmSync 兜底删除，新库正常建表
      expect(() => m2.getDb().prepare("SELECT 1").get()).not.toThrow();
    } finally {
      await vi.doUnmock("node:fs");
      m?.closeDb();
    }
  });

  it("renameSync 与 rmSync 都失败时归档返回 null，损坏错误如实上抛", async () => {
    vi.resetModules();
    // 只读挂载的极端场景：改名和删除都失败，quarantine 返回 null；
    // 坏库文件留在原地无法清除，此时错误必须如实抛给调用方
    // （/api/health 据此报 db 不可用），而不是假装健康。
    await vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();
      return {
        ...actual,
        renameSync: () => {
          throw new Error("EROFS: read-only file system");
        },
        rmSync: () => {
          throw new Error("EROFS: read-only file system");
        },
      };
    });
    try {
      writeFileSync(dbFile, "not a sqlite file at all");
      const m2 = await import("./sqlite");
      // 第一次开库：自愈尝试后重建失败，损坏错误透传
      expect(() => m2.getDb()).toThrow();
      expect(m2.lastQuarantinedDb()).toBeNull();
      // 健康检查如实报 false
      expect(m2.dbHealthy()).toBe(false);
    } finally {
      await vi.doUnmock("node:fs");
      m?.closeDb();
    }
  });
});
