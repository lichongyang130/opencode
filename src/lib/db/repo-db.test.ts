import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * DB 章增量能力测试：分页、FTS 搜索、软删/回收站、标签、导入 rename、VACUUM。
 * 沿用 repo.test.ts 的隔离模式：每个用例独立临时数据目录 + 重置模块缓存。
 */

let tempDir: string;
type RepoModule = typeof import("./repo");
let repo: RepoModule["repo"];
let tagRepo: RepoModule["tagRepo"];
let folderRepo: RepoModule["folderRepo"];
let importBackup: RepoModule["importBackup"];
let sqliteModule: typeof import("./sqlite");
let mod: RepoModule;

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "oc-db-ext-"));
  process.env.OC_DATA_DIR = tempDir;
  vi.resetModules();
  sqliteModule = await import("./sqlite");
  mod = await import("./repo");
  repo = mod.repo;
  tagRepo = mod.tagRepo;
  folderRepo = mod.folderRepo;
  importBackup = mod.importBackup;
});

afterEach(() => {
  sqliteModule?.closeDb();
  delete process.env.OC_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

function seedConversations(n: number, prefix = "c"): void {
  for (let i = 0; i < n; i++) {
    repo.upsertConversation({ id: `${prefix}${i}`, title: `会话 ${i}` });
  }
}

describe("DB1 游标分页", () => {
  it("按 limit 分页且 cursor 精确衔接不重不漏", () => {
    seedConversations(10);
    const page1 = repo.listConversations(0, { limit: 4 });
    expect(page1).toHaveLength(4);

    const next = mod.conversationPageCursor(page1, 4);
    expect(next).not.toBeNull();
    const page2 = repo.listConversations(0, { limit: 4, cursor: next! });
    expect(page2).toHaveLength(4);

    // 两页不重叠
    const ids1 = page1.map((c) => c.id);
    const ids2 = page2.map((c) => c.id);
    expect(ids1.filter((id) => ids2.includes(id))).toHaveLength(0);

    const page3 = repo.listConversations(0, {
      limit: 4,
      cursor: mod.conversationPageCursor(page2, 4)!,
    });
    expect(page3).toHaveLength(2);
    const all = [...ids1, ...ids2, ...page3.map((c) => c.id)];
    expect(new Set(all).size).toBe(10);
  });

  it("置顶会话在分页后仍排在最前", () => {
    seedConversations(5);
    repo.upsertConversation({ id: "pinned-top", pinned: true });
    const page = repo.listConversations(0, { limit: 3 });
    expect(page[0].id).toBe("pinned-top");
  });
});

describe("DB8/DB9 FTS 全文搜索", () => {

  it("按关键词命中消息并返回片段", () => {
    repo.upsertConversation({ id: "c1" });
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "user", content: "苹果发布了新款手机" });
    repo.insertMessage({ id: "m2", conversationId: "c1", role: "assistant", content: "香蕉产量今年创新高" });

    const hits = repo.searchMessages("苹果");
    expect(hits).toHaveLength(1);
    expect(hits[0].messageId).toBe("m1");
    expect(hits[0].conversationId).toBe("c1");
    expect(hits[0].snippet).toContain("苹果");
  });

  it("多关键词匹配用 OR 组合", () => {
    repo.upsertConversation({ id: "c1" });
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "user", content: "海豚很聪明" });
    repo.insertMessage({ id: "m2", conversationId: "c1", role: "user", content: "鲸鱼体型巨大" });
    expect(repo.searchMessages("海豚 鲸鱼").length).toBe(2);
  });

  it("空查询与纯符号查询不抛异常", () => {
    expect(repo.searchMessages("")).toEqual([]);
    expect(repo.searchMessages("!!!***")).toEqual([]);
  });

  it("消息删除后搜索索引同步移除", () => {
    repo.upsertConversation({ id: "c1" });
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "user", content: "临时内容" });
    expect(repo.searchMessages("临时")).toHaveLength(1);
    repo.deleteMessage("m1");
    expect(repo.searchMessages("临时")).toHaveLength(0);
  });
});

describe("DB11/DB12 软删除与回收站", () => {
  it("软删除后进回收站，恢复后回到列表", () => {
    repo.upsertConversation({ id: "c1" });
    repo.deleteConversation("c1");
    expect(repo.listConversations(undefined)).toHaveLength(0);
    expect(repo.listDeletedConversations()).toHaveLength(1);

    repo.restoreConversation("c1");
    expect(repo.listConversations(undefined)).toHaveLength(1);
    expect(repo.listDeletedConversations()).toHaveLength(0);
  });

  it("彻底删除不可恢复", () => {
    repo.upsertConversation({ id: "c1" });
    repo.deleteConversation("c1");
    repo.purgeConversation("c1");
    expect(repo.listDeletedConversations()).toHaveLength(0);
    expect(repo.getConversation("c1")).toBeNull();
  });

  it("过期软删自动清理", () => {
    repo.upsertConversation({ id: "c1" });
    repo.deleteConversation("c1");
    expect(repo.purgeExpiredConversations(0)).toBe(1);
    expect(repo.listDeletedConversations()).toHaveLength(0);
  });
});

describe("DB13 标签", () => {
  it("创建标签、绑定会话、按标签筛选", () => {
    repo.upsertConversation({ id: "c1" });
    const tag = tagRepo.createTag("工作", "#ff0000");
    tagRepo.setConversationTags("c1", [tag.id]);

    expect(tagRepo.getConversationTags("c1").map((t) => t.name)).toEqual(["工作"]);
    expect(tagRepo.listConversationsByTag(tag.id).map((c) => c.id)).toEqual(["c1"]);
    expect(tagRepo.listTags()).toHaveLength(1);
  });

  it("删除标签同时解除关联", () => {
    repo.upsertConversation({ id: "c1" });
    const tag = tagRepo.createTag("临时");
    tagRepo.setConversationTags("c1", [tag.id]);
    tagRepo.deleteTag(tag.id);
    expect(tagRepo.getConversationTags("c1")).toHaveLength(0);
    expect(tagRepo.listTags()).toHaveLength(0);
  });
});

describe("DB15 导入冲突策略", () => {
  const backupWith = (id: string, messageId: string) => ({
    app: "opencanvas",
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    conversations: [
      {
        id,
        title: "同名",
        mode: "chat",
        model: "demo",
        deck: null,
        images: [],
        report: null,
        doc: null,
        archived: false,
        pinned: false,
        createdAt: 1,
        updatedAt: 1,
        messages: [
          { id: messageId, conversationId: id, role: "user", content: "hi", error: false, createdAt: 1 },
        ],
      },
    ],
  });

  it("rename 策略对冲突会话分配副本 ID 而非跳过", () => {
    repo.upsertConversation({ id: "c1" });
    const r = importBackup(backupWith("c1", "m1") as never, undefined, { onConflict: "rename" });
    expect(r.importedConversations).toBe(1);
    expect(r.importedMessages).toBe(1);
    // 原会话仍在，副本是新的 id
    expect(repo.listConversations(undefined)).toHaveLength(2);
  });
});

describe("DB16 VACUUM", () => {
  it("vacuum 不抛异常", () => {
    repo.upsertConversation({ id: "c1" });
    expect(() => repo.vacuum()).not.toThrow();
  });

  it("optimize 不抛异常", () => {
    repo.upsertConversation({ id: "c1" });
    expect(() => repo.optimize()).not.toThrow();
  });
});

describe("DB14 文件夹分组", () => {
  it("创建文件夹、移动会话、会话带 folderId", () => {
    const folder = folderRepo.createFolder("项目 A");
    repo.upsertConversation({ id: "c1" });
    folderRepo.moveConversation("c1", folder.id);

    expect(repo.getConversation("c1")?.folderId).toBe(folder.id);
    expect(folderRepo.listFolders().map((f) => f.name)).toEqual(["项目 A"]);
  });

  it("删除文件夹后会话回到未分组", () => {
    const folder = folderRepo.createFolder("项目 B");
    repo.upsertConversation({ id: "c1", folderId: folder.id });
    folderRepo.deleteFolder(folder.id);

    expect(repo.getConversation("c1")?.folderId).toBeNull();
  });

  it("重命名文件夹", () => {
    const folder = folderRepo.createFolder("旧名");
    folderRepo.renameFolder(folder.id, "新名");
    expect(folderRepo.listFolders()[0].name).toBe("新名");
  });
});

describe("DB15 复合索引", () => {
  it("分页与消息复合索引已建", () => {
    const db = sqliteModule.getDb();
    const idx = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_conversations_page', 'idx_messages_convo_created')"
      )
      .all() as { name: string }[];
    expect(idx.map((i) => i.name).sort()).toEqual([
      "idx_conversations_page",
      "idx_messages_convo_created",
    ]);
  });
});
describe("覆盖率补充：回收站批量与边界", () => {
  it("restoreConversations 批量恢复", () => {
    repo.upsertConversation({ id: "c1" });
    repo.upsertConversation({ id: "c2" });
    repo.deleteConversation("c1");
    repo.deleteConversation("c2");
    repo.restoreConversations(["c1", "c2"]);
    expect(repo.listDeletedConversations()).toHaveLength(0);
    expect(repo.listConversations(undefined)).toHaveLength(2);
  });

  it("purgeConversations 批量彻底删除", () => {
    repo.upsertConversation({ id: "c1" });
    repo.upsertConversation({ id: "c2" });
    repo.deleteConversation("c1");
    repo.deleteConversation("c2");
    repo.purgeConversations(["c1", "c2"]);
    expect(repo.listDeletedConversations()).toHaveLength(0);
    expect(repo.getConversation("c1")).toBeNull();
    expect(repo.getConversation("c2")).toBeNull();
  });

  it("getMessages before 游标只拉更早消息", () => {
    repo.upsertConversation({ id: "c1" });
    for (let i = 0; i < 5; i++) {
      repo.insertMessage({ id: `m${i}`, conversationId: "c1", role: "user", content: `x${i}` });
    }
    // insertMessage 用 Date.now()，同循环内同毫秒；手动铺开 createdAt 保证游标有序
    const db = sqliteModule.getDb();
    for (let i = 0; i < 5; i++) {
      db.prepare("UPDATE messages SET createdAt = ? WHERE id = ?").run(1000 + i, `m${i}`);
    }
    const recent = repo.getMessages("c1", { limit: 3 });
    expect(recent.map((m) => m.id)).toEqual(["m2", "m3", "m4"]);
    const earlier = repo.getMessages("c1", { limit: 3, before: recent[0].createdAt });
    expect(earlier.map((m) => m.id)).toEqual(["m0", "m1"]);
  });

  it("rename 策略下消息 ID 撞车同样分配副本", () => {
    repo.upsertConversation({ id: "c1" });
    repo.insertMessage({ id: "m1", conversationId: "c1", role: "user", content: "原" });

    const backup = {
      app: "opencanvas",
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      conversations: [
        {
          id: "c9",
          title: "外来会话",
          mode: "chat",
          model: "demo",
          deck: null,
          images: [],
          report: null,
          doc: null,
          archived: false,
          pinned: false,
          createdAt: 1,
          updatedAt: 1,
          messages: [
            { id: "m1", conversationId: "c9", role: "user", content: "外来", error: false, createdAt: 1 },
          ],
        },
      ],
    };
    const r = importBackup(backup as never, undefined, { onConflict: "rename" });
    expect(r.importedConversations).toBe(1);
    expect(r.importedMessages).toBe(1);
    // 新消息拿到副本 ID，原 m1 内容不变
    const msgs = repo.getMessages("c9");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).not.toBe("m1");
    expect(repo.getMessages("c1").map((m) => m.content)).toEqual(["原"]);
  });
});

describe("UX3 手动排序（sortIndex）", () => {
  it("批量写排序后按编号升序排在未排序行之前", () => {
    seedConversations(4);
    // 手动把 c3、c1 排到最前
    repo.setSortIndexes([
      { id: "c3", sortIndex: 0 },
      { id: "c1", sortIndex: 1 },
    ]);
    const list = repo.listConversations(0, { limit: 10 });
    expect(list[0].id).toBe("c3");
    expect(list[1].id).toBe("c1");
    // 其余未排序行（sortIndex null）按时间排在编号行之后
    expect(list.slice(2).map((c) => c.id)).toContain("c0");
    expect(list.slice(2).map((c) => c.id)).toContain("c2");
  });

  it("setSortIndexes 不刷新 updatedAt（排序不算内容更新）", () => {
    repo.upsertConversation({ id: "c1", title: "甲" });
    const before = repo.listConversations(0, { limit: 1 })[0].updatedAt;
    repo.setSortIndexes([{ id: "c1", sortIndex: 3 }]);
    const after = repo.listConversations(0, { limit: 1 })[0];
    expect(after.sortIndex).toBe(3);
    expect(after.updatedAt).toBe(before);
  });

  it("patchFlags 写 sortIndex 为 null 可清回未排序态", () => {
    repo.upsertConversation({ id: "c1", sortIndex: 0 });
    expect(repo.listConversations(0, { limit: 1 })[0].sortIndex).toBe(0);
    repo.patchFlags("c1", { sortIndex: null });
    expect(repo.listConversations(0, { limit: 1 })[0].sortIndex).toBeNull();
  });

  it("upsert 显式传 sortIndex 落库，undefined 不覆盖已有值", () => {
    repo.upsertConversation({ id: "c1", sortIndex: 2 });
    // 不带 sortIndex 的更新（如改标题）不应把手动排序冲掉
    repo.upsertConversation({ id: "c1", title: "改名" });
    const row = repo.listConversations(0, { limit: 1 })[0];
    expect(row.title).toBe("改名");
    expect(row.sortIndex).toBe(2);
  });

  it("排序与置顶共存：置顶行恒在最前", () => {
    seedConversations(3);
    repo.setSortIndexes([{ id: "c1", sortIndex: 0 }]);
    repo.upsertConversation({ id: "c2", pinned: true });
    const list = repo.listConversations(0, { limit: 10 });
    expect(list[0].id).toBe("c2");
    expect(list[1].id).toBe("c1");
  });
});
