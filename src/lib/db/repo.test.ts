import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * repo 层测试。
 *
 * 每个用例用独立的临时数据目录（OC_DATA_DIR）+ 重置模块缓存，
 * 保证既不污染开发库 data/dev.db，也不让用例之间共享 sqlite 单例。
 */

let tempDir: string;
type RepoModule = typeof import("./repo");
let repo: RepoModule["repo"];
let importBackup: RepoModule["importBackup"];
let membershipRepo: RepoModule["membershipRepo"];
let sqliteModule: typeof import("./sqlite");

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "oc-repo-"));
  process.env.OC_DATA_DIR = tempDir;
  // 重置模块注册表：sqlite.ts 里的 db 是模块级单例，
  // 不重置会让第二个用例继续用上一个临时目录的连接
  vi.resetModules();
  sqliteModule = await import("./sqlite");
  const mod = await import("./repo");
  repo = mod.repo;
  importBackup = mod.importBackup;
  membershipRepo = mod.membershipRepo;
});

afterEach(() => {
  sqliteModule?.closeDb();
  delete process.env.OC_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("会话 CRUD", () => {
  it("新建会话时未给的字段落到默认值", () => {
    repo.upsertConversation({ id: "c1" });
    const c = repo.getConversation("c1");
    expect(c).toMatchObject({
      id: "c1",
      title: "新任务",
      mode: "chat",
      model: "demo",
      modelProvider: null,
      images: [],
      archived: false,
      pinned: false,
    });
  });

  it("再次 upsert 只改传入的字段，未传字段保持原值", () => {
    repo.upsertConversation({ id: "c1", title: "原标题", mode: "slides" });
    repo.upsertConversation({ id: "c1", title: "新标题" });
    const c = repo.getConversation("c1");
    expect(c?.title).toBe("新标题");
    expect(c?.mode).toBe("slides");
  });

  it("显式传 null 能把字段清空（区别于 undefined 的不改动）", () => {
    repo.upsertConversation({ id: "c1", personaId: "p1", deckStatus: "done" });
    expect(repo.getConversation("c1")?.personaId).toBe("p1");

    repo.upsertConversation({ id: "c1", personaId: null, deckStatus: null });
    const c = repo.getConversation("c1");
    expect(c?.personaId).toBeNull();
    expect(c?.deckStatus).toBeNull();
  });

  it("deck / report / doc 的对象结构往返不失真", () => {
    const deck = { title: "标题", theme: "violet", slides: [{ layout: "cover", title: "封面" }] };
    repo.upsertConversation({ id: "c1", deck, report: { topic: "t" }, doc: { title: "d" } });
    const c = repo.getConversation("c1");
    expect(c?.deck).toEqual(deck);
    expect(c?.report).toEqual({ topic: "t" });
    expect(c?.doc).toEqual({ title: "d" });
  });

  it("读取不存在的会话返回 null 而非抛异常", () => {
    expect(repo.getConversation("missing")).toBeNull();
  });

  it("字段里存的是非法 JSON 时降级为默认值，不让整个列表崩掉", () => {
    repo.upsertConversation({ id: "c1" });
    sqliteModule
      .getDb()
      .prepare("UPDATE conversations SET deck = ?, images = ? WHERE id = ?")
      .run("{坏", "[坏", "c1");
    const c = repo.getConversation("c1");
    expect(c?.deck).toBeNull();
    expect(c?.images).toEqual([]);
  });
});

describe("listConversations 过滤与排序", () => {
  beforeEach(() => {
    repo.upsertConversation({ id: "active" });
    repo.upsertConversation({ id: "pinned", pinned: true });
    repo.upsertConversation({ id: "archived", archived: true });
  });

  it("默认只返回活跃会话", () => {
    const ids = repo.listConversations(0).map((c) => c.id);
    expect(ids).toContain("active");
    expect(ids).toContain("pinned");
    expect(ids).not.toContain("archived");
  });

  it("传 1 只返回归档会话", () => {
    expect(repo.listConversations(1).map((c) => c.id)).toEqual(["archived"]);
  });

  it("传 undefined 返回全部", () => {
    expect(repo.listConversations(undefined)).toHaveLength(3);
  });

  it("置顶会话排在最前", () => {
    expect(repo.listConversations(0)[0].id).toBe("pinned");
  });
});

describe("消息操作", () => {
  beforeEach(() => repo.upsertConversation({ id: "c1" }));

  it("插入后按时间升序返回", () => {
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "user", content: "一" });
    repo.insertMessage({ id: "m2", conversationId: "c1", role: "assistant", content: "二" });
    expect(repo.getMessages("c1").map((m) => m.content)).toEqual(["一", "二"]);
  });

  it("更新消息内容与错误标记", () => {
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "assistant", content: "旧" });
    repo.updateMessage("m1", "新", true);
    const m = repo.getMessages("c1")[0];
    expect(m.content).toBe("新");
    expect(m.error).toBe(true);
  });

  it("删除单条消息", () => {
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "user", content: "x" });
    repo.deleteMessage("m1");
    expect(repo.getMessages("c1")).toHaveLength(0);
  });

  it("删除会话时软删除保留数据，彻底删除才级联清掉", () => {
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "user", content: "x" });
    repo.deleteConversation("c1");
    // 软删除：记录仍在（进回收站），消息也保留
    expect(repo.getConversation("c1")?.deletedAt).not.toBeNull();
    expect(repo.getMessages("c1")).toHaveLength(1);
    // 列表默认排除已软删
    expect(repo.listConversations(undefined)).toHaveLength(0);
    // 彻底删除后记录与消息一并消失
    repo.purgeConversation("c1");
    expect(repo.getConversation("c1")).toBeNull();
    expect(repo.getMessages("c1")).toHaveLength(0);
  });

  it("插入消息会顺带刷新会话的 updatedAt", () => {
    const before = repo.getConversation("c1")!.updatedAt;
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "user", content: "x" });
    expect(repo.getConversation("c1")!.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe("批量操作与标记", () => {
  beforeEach(() => {
    repo.upsertConversation({ id: "a" });
    repo.upsertConversation({ id: "b" });
  });

  it("patchFlags 更新归档/置顶/标题", () => {
    repo.patchFlags("a", { archived: true, pinned: true, title: "改名" });
    const c = repo.getConversation("a");
    expect(c).toMatchObject({ archived: true, pinned: true, title: "改名" });
  });

  it("patchFlags 传空对象时不产生无效 SQL", () => {
    expect(() => repo.patchFlags("a", {})).not.toThrow();
  });

  it("批量归档与批量删除", () => {
    repo.setArchivedBatch(["a", "b"], true);
    expect(repo.listConversations(1)).toHaveLength(2);

    repo.deleteConversations(["a", "b"]);
    expect(repo.listConversations(undefined)).toHaveLength(0);
  });
});

describe("importBackup", () => {
  const backup = (id: string, messageId: string) => ({
    app: "opencanvas",
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    conversations: [
      {
        id,
        title: "导入的会话",
        mode: "chat",
        model: "gpt-4o",
        deck: null,
        images: [],
        report: null,
        doc: null,
        archived: false,
        pinned: false,
        createdAt: 1767225600000,
        updatedAt: 1767225600000,
        messages: [
          {
            id: messageId,
            conversationId: id,
            role: "user",
            content: "hi",
            error: false,
            createdAt: 1767225600000,
          },
        ],
      },
    ],
  });

  it("导入新会话与消息", () => {
    const r = importBackup(backup("c1", "m1"));
    expect(r).toEqual({
      importedConversations: 1,
      importedMessages: 1,
      skippedConversations: 0,
      skippedMessages: 0,
    });
    expect(repo.getMessages("c1")).toHaveLength(1);
  });

  it("重复导入同一份备份时整体跳过（幂等）", () => {
    importBackup(backup("c1", "m1"));
    const r = importBackup(backup("c1", "m1"));
    expect(r).toEqual({
      importedConversations: 0,
      importedMessages: 0,
      skippedConversations: 1,
      skippedMessages: 1,
    });
  });

  it("消息 ID 撞车时抛错并整体回滚，不留半条数据", () => {
    importBackup(backup("c1", "m1"));
    // 换个会话 ID 但复用已存在的消息 ID：普通 INSERT 不能退化成 upsert
    expect(() => importBackup(backup("c2", "m1"))).toThrow(/已存在/);
    expect(repo.getConversation("c2")).toBeNull();
  });

  it("缺失可选字段时归一化为 null 而非把 undefined 传给 SQLite", () => {
    const input = backup("c1", "m1");
    // 旧代码在这里会抛 "Provided value cannot be bound to SQLite parameter"
    expect(() => importBackup(input)).not.toThrow();
    const c = repo.getConversation("c1");
    expect(c?.modelProvider).toBeNull();
    expect(c?.personaId).toBeNull();
    expect(c?.deckStatus).toBeNull();
  });

  it("校验失败时不写入任何数据", () => {
    const bad = backup("c1", "m1") as Record<string, unknown>;
    bad.version = 99;
    expect(() => importBackup(bad)).toThrow();
    expect(repo.listConversations(undefined)).toHaveLength(0);
  });
});

describe("membershipRepo", () => {
  it("首次读取自动初始化为 pro 试用会员", () => {
    const m = membershipRepo.get();
    expect(m.plan).toBe("pro");
    expect(m.autoRenew).toBe(true);
    expect(m.renewAt).toBeGreaterThan(Date.now());
  });

  it("重复读取不会栈溢出（曾经的递归自调用缺陷）", () => {
    expect(() => {
      for (let i = 0; i < 50; i++) membershipRepo.get();
    }).not.toThrow();
  });

  it("升级套餐后生成订单并可查询", () => {
    const r = membershipRepo.upgrade("pro", 39);
    expect(r.membership.plan).toBe("pro");
    const orders = membershipRepo.listOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ plan: "pro", amount: 39 });
  });

  it("取消自动续费", () => {
    membershipRepo.upgrade("pro", 39);
    expect(membershipRepo.cancelAutoRenew().autoRenew).toBe(false);
  });

  it("stats 在无数据时返回零值而不是 NaN", () => {
    const s = membershipRepo.stats();
    for (const value of Object.values(s)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    }
  });
});