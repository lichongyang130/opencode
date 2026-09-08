/**
 * 结构化版本数据库迁移管理（DB5/DB6/DB7）。
 *
 * 基于 SQLite PRAGMA user_version 管理架构演进：
 * - 顺序执行版本迁移脚本，每个脚本处于独立事务中；
 * - 迁移失败抛出异常并自动回滚事务，杜绝数据库处于中间破损状态；
 * - 兼容历史既有老库并补齐 soft delete (deletedAt)、FTS5 全文搜索、标签系统、置顶排序等。
 */
import type { DatabaseSync } from "node:sqlite";
import { logger } from "../logger";

/**
 * 汉字单字切分的 JS 实现：注册为 SQL 函数 oc_cjk_seg，供 FTS 触发器与查询共用。
 *
 * 为什么这么改：SQLite 内置的 unicode61 分词器把整句连续中文当作一个 token，
 * 「苹果」永远匹配不上「苹果发布了新款手机」；trigram 又只出三字 token，
 * 两字搜索词同样落空。应用层把每个汉字拆成独立 token 后，"苹 果" 的相邻
 * 词组（phrase）查询即可命中。写入侧（触发器内）与查询侧（MATCH 前）
 * 都调用它，两侧切分规则天然一致，避免索引内容与查询词形对不上。
 */
export function cjkSeg(input: string | null | undefined): string {
  return String(input ?? "").replace(/([\u3400-\u9FFF\uF900-\uFAFF])/g, " $1 ");
}

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "baseline_schema_and_column_backfill",
    up: (db) => {
      // 1. 基础表结构
      db.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
          id            TEXT PRIMARY KEY,
          title         TEXT NOT NULL DEFAULT '新任务',
          mode          TEXT NOT NULL DEFAULT 'chat',
          model         TEXT NOT NULL DEFAULT 'demo',
          modelProvider TEXT,
          deck          TEXT,
          deckStatus    TEXT,
          images        TEXT,
          report        TEXT,
          doc           TEXT,
          personaId     TEXT,
          archived      INTEGER NOT NULL DEFAULT 0,
          pinned        INTEGER NOT NULL DEFAULT 0,
          createdAt     REAL NOT NULL,
          updatedAt     REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
          id             TEXT PRIMARY KEY,
          conversationId TEXT NOT NULL,
          role           TEXT NOT NULL,
          content        TEXT NOT NULL,
          error          INTEGER NOT NULL DEFAULT 0,
          createdAt      REAL NOT NULL,
          FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS case_shares (
          code      TEXT PRIMARY KEY,
          data      TEXT NOT NULL,
          createdAt REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS membership (
          id        TEXT PRIMARY KEY,
          plan      TEXT NOT NULL DEFAULT 'free',
          autoRenew INTEGER NOT NULL DEFAULT 1,
          renewAt   REAL,
          createdAt REAL NOT NULL,
          updatedAt REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
          id        TEXT PRIMARY KEY,
          plan      TEXT NOT NULL,
          amount    INTEGER NOT NULL,
          status    TEXT NOT NULL,
          createdAt REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updatedAt);
        CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversationId);
        CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);
      `);

      // 2. 兼容历史无 user_version 老库遗漏的列
      const cols = db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[];
      const colNames = new Set(cols.map((c) => c.name));

      if (!colNames.has("archived")) {
        db.exec("ALTER TABLE conversations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
      }
      if (!colNames.has("pinned")) {
        db.exec("ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
      }
      if (!colNames.has("report")) {
        db.exec("ALTER TABLE conversations ADD COLUMN report TEXT");
      }
      if (!colNames.has("modelProvider")) {
        db.exec("ALTER TABLE conversations ADD COLUMN modelProvider TEXT");
      }
      if (!colNames.has("doc")) {
        db.exec("ALTER TABLE conversations ADD COLUMN doc TEXT");
      }
      if (!colNames.has("personaId")) {
        db.exec("ALTER TABLE conversations ADD COLUMN personaId TEXT");
      }
    },
  },
  {
    version: 2,
    name: "soft_delete_and_tags",
    up: (db) => {
      // DB11: 软删除 deletedAt
      const cols = db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[];
      if (!cols.some((c) => c.name === "deletedAt")) {
        db.exec("ALTER TABLE conversations ADD COLUMN deletedAt REAL");
      }
      db.exec("CREATE INDEX IF NOT EXISTS idx_conversations_deleted ON conversations(deletedAt);");

      // DB13: 标签系统
      db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id        TEXT PRIMARY KEY,
          name      TEXT NOT NULL UNIQUE,
          color     TEXT,
          createdAt REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conversation_tags (
          conversationId TEXT NOT NULL,
          tagId          TEXT NOT NULL,
          createdAt      REAL NOT NULL,
          PRIMARY KEY (conversationId, tagId),
          FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_convo_tags_tag ON conversation_tags(tagId);
      `);
    },
  },
  {
    version: 3,
    name: "fts5_fulltext_search",
    up: (db) => {
      // DB8: FTS5 虚拟表及触发器。content 列写入前用 oc_cjk_seg 把汉字拆成
      // 单字 token（函数注册见 sqlite.ts getDb），否则连续中文是一整个 token 无法搜索。
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          messageId UNINDEXED,
          conversationId UNINDEXED,
          content,
          tokenize = 'unicode61'
        );

        -- 插入触发器
        CREATE TRIGGER IF NOT EXISTS trg_messages_ai AFTER INSERT ON messages BEGIN
          INSERT INTO messages_fts(messageId, conversationId, content)
          VALUES (new.id, new.conversationId, oc_cjk_seg(new.content));
        END;

        -- 更新触发器
        CREATE TRIGGER IF NOT EXISTS trg_messages_au AFTER UPDATE ON messages BEGIN
          DELETE FROM messages_fts WHERE messageId = old.id;
          INSERT INTO messages_fts(messageId, conversationId, content)
          VALUES (new.id, new.conversationId, oc_cjk_seg(new.content));
        END;

        -- 删除触发器
        CREATE TRIGGER IF NOT EXISTS trg_messages_ad AFTER DELETE ON messages BEGIN
          DELETE FROM messages_fts WHERE messageId = old.id;
        END;
      `);

      // 为历史既有数据灌入全文索引（同样过切词函数，与触发器写入口径一致）
      db.exec(`
        INSERT INTO messages_fts(messageId, conversationId, content)
        SELECT id, conversationId, oc_cjk_seg(content) FROM messages
        WHERE id NOT IN (SELECT messageId FROM messages_fts);
      `);
    },
  },
  {
    version: 4,
    name: "composite_indexes_and_maintenance",
    up: (db) => {
      // DB15: 查询热点的复合索引。分页游标按 (pinned, updatedAt, id) 排序，
      // 单列 idx_conversations_updated 需要额外排序；复合索引让 keyset 分页
      // 与置顶列表直接走索引扫描。消息侧 (conversationId, createdAt) 覆盖
      // getMessages 的会话内时间序拉取与超长会话分页（before 游标）。
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_conversations_page
          ON conversations(pinned, updatedAt, id);
        CREATE INDEX IF NOT EXISTS idx_messages_convo_created
          ON messages(conversationId, createdAt);
      `);
    },
  },
  {
    version: 5,
    name: "folder_grouping",
    up: (db) => {
      // DB14: 文件夹/项目分组。先建 folders 再加 folderId 列（外键引用它）；
      // folderId 可空 = 未分组；删除文件夹时会话回到未分组（SET NULL）而非跟着消失。
      db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
          id        TEXT PRIMARY KEY,
          name      TEXT NOT NULL,
          createdAt REAL NOT NULL,
          updatedAt REAL NOT NULL
        );
      `);
      const cols = db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[];
      if (!cols.some((c) => c.name === "folderId")) {
        db.exec("ALTER TABLE conversations ADD COLUMN folderId TEXT REFERENCES folders(id) ON DELETE SET NULL");
      }
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_conversations_folder ON conversations(folderId);
      `);
    },
  },
  {
    version: 6,
    name: "usage_and_credits_ledger",
    up: (db) => {
      // AI8: 模型调用用量落库。每一次网关调用（无论成败）都记一行，
      // 看板按天/模型聚合全靠它；成败标记用于排障（失败调用不产生积分扣减）。
      db.exec(`
        CREATE TABLE IF NOT EXISTS usage_records (
          id              TEXT PRIMARY KEY,
          conversationId  TEXT,
          model           TEXT NOT NULL,
          provider        TEXT NOT NULL,
          inputTokens    INTEGER NOT NULL,
          outputTokens    INTEGER NOT NULL,
          costUsd         REAL NOT NULL,
          credits         INTEGER NOT NULL,
          success         INTEGER NOT NULL,
          durationMs      INTEGER NOT NULL,
          createdAt       REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_records(createdAt);
        CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_records(model);
      `);

      // AI11: 积分账本。reserve（预扣挂起）→ settle（结算）→ refund（失败回滚），
      // 替代原内存模拟；剩余额度 = grant 总额 - 未回滚的预扣 - 已结算消耗。
      db.exec(`
        CREATE TABLE IF NOT EXISTS credit_ledger (
          id        TEXT PRIMARY KEY,
          kind      TEXT NOT NULL CHECK (kind IN ('grant', 'reserve', 'settle', 'refund')),
          amount    INTEGER NOT NULL,
          usageId   TEXT,
          note      TEXT,
          createdAt REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ledger_created ON credit_ledger(createdAt);
      `);
    },
  },
  {
    version: 7,
    name: "storyboard_column",
    up: (db) => {
      // V3: video 模式的分镜脚本持久化。与 deck/report 同为 JSON TEXT 列，
      // 水合时由前端按 mode 推导展示；会话中途被删除的既有约定不变。
      const cols = db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[];
      if (!cols.some((c) => c.name === "video")) {
        db.exec("ALTER TABLE conversations ADD COLUMN video TEXT");
      }
      // 分镜状态标记（idle/loading/done/error），与 deckStatus 同构
      if (!cols.some((c) => c.name === "videoStatus")) {
        db.exec("ALTER TABLE conversations ADD COLUMN videoStatus TEXT");
      }
    },
  },
  {
    version: 8,
    name: "doc_versions",
    up: (db) => {
      // DOC5: 文档版本历史。每次保存留快照，可回滚；content 存完整 Markdown，
      // 频率低且行数有限（每会话封顶），TEXT 列足够。
      // 软删除的会话不动版本（回收站恢复后历史仍在）；彻底删除时由
      // repo.purgeConversation 级联清理。
      db.exec(`
        CREATE TABLE IF NOT EXISTS doc_versions (
          id              TEXT PRIMARY KEY,
          conversationId  TEXT NOT NULL,
          title           TEXT NOT NULL,
          content         TEXT NOT NULL,
          createdAt       REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_doc_versions_convo ON doc_versions(conversationId, createdAt);
      `);
    },
  },
  {
    version: 9,
    name: "manual_sort_order",
    up: (db) => {
      // UX3: 手动排序。NULL = 从未手动排过（默认按 pinned/updatedAt 倒序），
      // 一旦拖拽过则整列表按 sortIndex 升序展示；迁移时不动存量数据 ——
      // 旧会话保持 NULL，与手动排过的会话天然分段，不产生全量重写。
      const cols = db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[];
      if (!cols.some((c) => c.name === "sortIndex")) {
        db.exec("ALTER TABLE conversations ADD COLUMN sortIndex INTEGER");
      }
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_conversations_sort ON conversations(sortIndex);
      `);
    },
  },
];

export function runMigrations(db: DatabaseSync): void {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  let currentVersion = row?.user_version ?? 0;

  for (const mig of migrations) {
    if (mig.version > currentVersion) {
      logger.info(`正在执行数据库迁移: v${mig.version} [${mig.name}]`);
      try {
        db.exec("BEGIN IMMEDIATE;");
        mig.up(db);
        db.exec(`PRAGMA user_version = ${mig.version};`);
        db.exec("COMMIT;");
        currentVersion = mig.version;
      } catch (err) {
        db.exec("ROLLBACK;");
        logger.error(`数据库迁移失败: v${mig.version} [${mig.name}]`, { err });
        throw new Error(
          `数据库升级至版本 ${mig.version} 失败，已安全回滚：${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }
}