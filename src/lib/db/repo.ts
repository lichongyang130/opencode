import { getDb } from "./sqlite";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { BackupConflictError, validateBackup, type BackupImportResult } from "../backup";
import { externalizeImages, removeExternalImages } from "./image-store";
import { cjkSeg } from "./migrations";

export interface StoredConversation {
  id: string;
  title: string;
  mode: string;
  model: string;
  modelProvider: string | null;
  deck: unknown | null;
  deckStatus: string | null;
  images: StoredImage[];
  report: unknown | null;
  doc: unknown | null;
  video: unknown | null;
  videoStatus: string | null;
  personaId: string | null;
  archived: boolean;
  pinned: boolean;
  deletedAt: number | null;
  folderId: string | null;
  /** UX3 手动排序：NULL = 未排过（按默认 pinned/updatedAt 倒序） */
  sortIndex: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  error: boolean;
  createdAt: number;
}

export interface SearchHit {
  messageId: string;
  conversationId: string;
  snippet: string;
}

export interface StoredTag {
  id: string;
  name: string;
  color: string | null;
  createdAt: number;
}

export interface StoredImage {
  id: string;
  prompt: string;
  model: string;
  url: string; // data: 或 http(s)
  createdAt: number;
}

const parseJson = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

/** 会话列表 keyset 分页游标（DB1）：以 (pinned, updatedAt, id) 唯一定位一行 */
interface ConversationCursor {
  pinned: number;
  updatedAt: number;
  id: string;
}

function encodeConversationCursor(c: Pick<StoredConversation, "pinned" | "updatedAt" | "id">): string {
  return Buffer.from(
    JSON.stringify([c.pinned ? 1 : 0, c.updatedAt, c.id])
  ).toString("base64url");
}

function decodeConversationCursor(raw: string): ConversationCursor | null {
  try {
    const [pinned, updatedAt, id] = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as [
      number,
      number,
      string
    ];
    if (typeof pinned !== "number" || typeof updatedAt !== "number" || typeof id !== "string") {
      return null;
    }
    return { pinned, updatedAt, id };
  } catch {
    return null;
  }
}

/** 由一页结果生成下一页游标；不足一页时返回 null 表示没有更多 */
export function conversationPageCursor(rows: StoredConversation[], limit: number): string | null {
  if (rows.length < limit) return null;
  const last = rows[rows.length - 1];
  return encodeConversationCursor(last);
}

function rowToConversation(r: Record<string, unknown>): StoredConversation {
  return {
    id: r.id as string,
    title: r.title as string,
    mode: r.mode as string,
    model: r.model as string,
    modelProvider: (r.modelProvider as string | null) ?? null,
    deck: parseJson(r.deck as string | null, null),
    deckStatus: (r.deckStatus as string | null) ?? null,
    images: parseJson<StoredImage[]>(r.images as string | null, []),
    report: parseJson(r.report as string | null, null),
    doc: parseJson(r.doc as string | null, null),
    video: parseJson(r.video as string | null, null),
    videoStatus: (r.videoStatus as string | null) ?? null,
    personaId: (r.personaId as string | null) ?? null,
    archived: Boolean(r.archived),
    pinned: Boolean(r.pinned),
    deletedAt: (r.deletedAt as number | null) ?? null,
    folderId: (r.folderId as string | null) ?? null,
    sortIndex: (r.sortIndex as number | null) ?? null,
    createdAt: r.createdAt as number,
    updatedAt: r.updatedAt as number,
  };
}

/**
 * Restore only missing conversations, atomically. Injectable DB keeps offline tests
 * away from the application database. Plain INSERTs must never become upserts:
 * a message ID collision is an error, not permission to modify another conversation.
 *
 * onConflict 控制 ID 撞车时的策略：
 * - "skip"（默认）：跳过已存在的会话，保留现有数据不动；
 * - "rename"（DB15）：给冲突的会话/消息分配新 ID 作为副本导入，不覆盖也不丢数据。
 */
export interface ImportOptions {
  onConflict?: "skip" | "rename";
}

export function importBackup(
  input: unknown,
  database?: DatabaseSync,
  opts?: ImportOptions
): BackupImportResult {
  const backup = validateBackup(input);
  const db = database ?? getDb();
  const onConflict = opts?.onConflict ?? "skip";
  const result: BackupImportResult = {
    importedConversations: 0,
    importedMessages: 0,
    skippedConversations: 0,
    skippedMessages: 0,
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    const exists = db.prepare("SELECT id FROM conversations WHERE id = ?");
    const messageExists = db.prepare("SELECT conversationId FROM messages WHERE id = ?");
    const insertConversation = db.prepare(
      `INSERT INTO conversations (id, title, mode, model, modelProvider, deck, deckStatus, images, report, doc, video, videoStatus, personaId, archived, pinned, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMessage = db.prepare(
      "INSERT INTO messages (id, conversationId, role, content, error, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    );
    // rename 策略下 ID 撞车时迭代追加序号直到空闲
    const uniqueConversationId = (base: string): string => {
      let candidate = base;
      let i = 1;
      while (exists.get(candidate)) {
        candidate = `${base}-副本-${i}`;
        i += 1;
      }
      return candidate;
    };
    const uniqueMessageId = (base: string): string => {
      let candidate = base;
      let i = 1;
      while (messageExists.get(candidate)) {
        candidate = `${base}-副本-${i}`;
        i += 1;
      }
      return candidate;
    };
    // 备份里缺失的可选字段是 undefined，SQLite 只接受 null，统一归一化
    const json = (value: unknown) => (value === null || value === undefined ? null : JSON.stringify(value));
    const orNull = <T>(value: T | null | undefined): T | null => value ?? null;
    for (const c of backup.conversations) {
      if (exists.get(c.id)) {
        if (onConflict === "rename") {
          const newId = uniqueConversationId(c.id);
          insertConversation.run(
            newId, c.title, c.mode, c.model, orNull(c.modelProvider), json(c.deck), orNull(c.deckStatus),
            JSON.stringify(externalizeImages(c.images ?? [])), json(c.report), json(c.doc), json(c.video), orNull(c.videoStatus),
            orNull(c.personaId), c.archived ? 1 : 0, c.pinned ? 1 : 0, c.createdAt, c.updatedAt
          );
          result.importedConversations += 1;
          for (const m of c.messages) {
            const msgId = messageExists.get(m.id) ? uniqueMessageId(m.id) : m.id;
            insertMessage.run(msgId, newId, m.role, m.content, m.error ? 1 : 0, m.createdAt);
            result.importedMessages += 1;
          }
          continue;
        }
        result.skippedConversations += 1;
        result.skippedMessages += c.messages.length;
        continue;
      }
      insertConversation.run(
        c.id, c.title, c.mode, c.model, orNull(c.modelProvider), json(c.deck), orNull(c.deckStatus),
        JSON.stringify(externalizeImages(c.images ?? [])), json(c.report), json(c.doc), json(c.video), orNull(c.videoStatus),
        orNull(c.personaId), c.archived ? 1 : 0, c.pinned ? 1 : 0, c.createdAt, c.updatedAt
      );
      result.importedConversations += 1;
      for (const m of c.messages) {
        // skip 语义下消息 ID 撞车仍是硬错误：普通 INSERT 不能退化成覆盖他人会话；
        // rename 语义下消息撞车同样副本化，导入不因冲突中断
        if (messageExists.get(m.id)) {
          if (onConflict !== "rename") {
            throw new BackupConflictError(`消息 ID「${m.id}」已存在；为保护现有数据，本次导入已全部回滚`);
          }
          const msgId = uniqueMessageId(m.id);
          insertMessage.run(msgId, c.id, m.role, m.content, m.error ? 1 : 0, m.createdAt);
          result.importedMessages += 1;
          continue;
        }
        insertMessage.run(m.id, c.id, m.role, m.content, m.error ? 1 : 0, m.createdAt);
        result.importedMessages += 1;
      }
    }
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export const repo = {
  importBackup,
  /** archivedFilter: 0=活跃 1=归档 undefined=全部（默认排除软删除的会话，见 includeDeleted） */
  listConversations(
    archivedFilter?: 0 | 1,
    opts?: { limit?: number; cursor?: string; includeDeleted?: boolean }
  ): StoredConversation[] {
    const cursor = opts?.cursor ? decodeConversationCursor(opts.cursor) : null;
    const limit = opts?.limit;
    const includeDeleted = opts?.includeDeleted === true;

    const where: string[] = [];
    const params: (string | number)[] = [];
    if (archivedFilter !== undefined) {
      where.push("archived = ?");
      params.push(archivedFilter ? 1 : 0);
    }
    if (!includeDeleted) {
      where.push("deletedAt IS NULL");
    }
    // keyset 分页：以 (pinned, updatedAt, id) 复合游标精确定位下一页，置顶语义不受影响
    if (cursor) {
      where.push(
        "(pinned < ? OR (pinned = ? AND updatedAt < ?) OR (pinned = ? AND updatedAt = ? AND id < ?))"
      );
      params.push(cursor.pinned, cursor.pinned, cursor.updatedAt, cursor.pinned, cursor.updatedAt, cursor.id);
    }

    let sql = "SELECT * FROM conversations";
    if (where.length > 0) sql += ` WHERE ${where.join(" AND ")}`;
    // UX3 手动排序：排过序的行（sortIndex 非空）按编号升序在最前，
    // 未排序的行仍按时间倒序排在后面。游标分页按 (pinned, updatedAt, id)
    // 定位 —— 对手动排序过的行可能产生跨页跳行，但侧栏拖拽后前端会整体
    // 重拉，且 limit=30 的常规场景一页装得下绝大多数会话，此边界可接受。
    sql += " ORDER BY pinned DESC, CASE WHEN sortIndex IS NOT NULL THEN 0 ELSE 1 END, sortIndex ASC, updatedAt DESC, id DESC";
    if (limit !== undefined) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    const rows = getDb().prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(rowToConversation);
  },

  getConversation(id: string): StoredConversation | null {
    const row = getDb()
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToConversation(row) : null;
  },

  getMessages(conversationId: string, opts?: { limit?: number; before?: number }): StoredMessage[] {
    // DB4：超长会话只取最近 limit 条，before 游标用于向上补拉更早的历史；
    // 不带 limit 时保持旧行为——按时间升序返回全部
    const limit = opts?.limit;
    const before = opts?.before;
    const where: string[] = ["conversationId = ?"];
    const params: (string | number)[] = [conversationId];
    if (before !== undefined) {
      where.push("createdAt < ?");
      params.push(before);
    }
    const paged = limit !== undefined;
    let sql = `SELECT * FROM messages WHERE ${where.join(" AND ")} ORDER BY createdAt ${paged ? "DESC" : "ASC"}`;
    if (paged) {
      sql += " LIMIT ?";
      params.push(limit);
    }
    const rows = getDb().prepare(sql).all(...params) as Record<string, unknown>[];
    // 分页时倒序取回后翻转，保证最终仍按时间升序返回
    const ordered = paged ? rows.reverse() : rows;
    return ordered.map((r) => ({
      id: r.id as string,
      conversationId: r.conversationId as string,
      role: r.role as "user" | "assistant",
      content: r.content as string,
      error: Boolean(r.error),
      createdAt: r.createdAt as number,
    }));
  },

  upsertConversation(c: {
    id: string;
    title?: string;
    mode?: string;
    model?: string;
    modelProvider?: string | null;
    deck?: unknown;
    deckStatus?: string | null;
    images?: StoredImage[];
    report?: unknown;
    doc?: unknown;
    video?: unknown;
    videoStatus?: string | null;
    personaId?: string | null;
    archived?: boolean;
    pinned?: boolean;
    folderId?: string | null;
    sortIndex?: number | null;
  }): void {
    const db = getDb();
    const now = Date.now();
    // 大图先转存磁盘再入库：整条 data URI 落在 JSON 列里会让侧栏的 SELECT * 拖垮界面
    const images = c.images === undefined ? undefined : externalizeImages(c.images);
    const existing = db
      .prepare("SELECT id FROM conversations WHERE id = ?")
      .get(c.id) as Record<string, unknown> | undefined;

    if (existing) {
      // 动态拼 SET：undefined = 不改动；显式 null = 清空为 NULL。
      // （旧版用 COALESCE(?, col)，导致任何字段都写不进 NULL，
      //   「取消角色 / 清空 deckStatus」等静默失效。）
      const sets: string[] = [];
      const params: (string | number | null)[] = [];
      const set = (col: string, val: string | number | null) => {
        sets.push(`${col} = ?`);
        params.push(val);
      };
      if (c.title !== undefined) set("title", c.title);
      if (c.mode !== undefined) set("mode", c.mode);
      if (c.model !== undefined) set("model", c.model);
      if (c.modelProvider !== undefined) set("modelProvider", c.modelProvider);
      if (c.deck !== undefined) set("deck", c.deck === null ? null : JSON.stringify(c.deck));
      if (c.deckStatus !== undefined) set("deckStatus", c.deckStatus);
      if (c.images !== undefined) set("images", JSON.stringify(images));
      if (c.report !== undefined) set("report", c.report === null ? null : JSON.stringify(c.report));
      if (c.doc !== undefined) set("doc", c.doc === null ? null : JSON.stringify(c.doc));
      if (c.video !== undefined) set("video", c.video === null ? null : JSON.stringify(c.video));
      if (c.videoStatus !== undefined) set("videoStatus", c.videoStatus);
      if (c.personaId !== undefined) set("personaId", c.personaId);
      if (c.archived !== undefined) set("archived", c.archived ? 1 : 0);
      if (c.pinned !== undefined) set("pinned", c.pinned ? 1 : 0);
      if (c.folderId !== undefined) set("folderId", c.folderId);
      // UX3: sortIndex 显式传 null 可清回「未手动排序」态
      if (c.sortIndex !== undefined) set("sortIndex", c.sortIndex);

      if (sets.length > 0) {
        sets.push("updatedAt = ?");
        params.push(now, c.id);
        db.prepare(`UPDATE conversations SET ${sets.join(", ")} WHERE id = ?`).run(...params);
      }
    } else {
      db.prepare(
        `INSERT INTO conversations (id, title, mode, model, modelProvider, deck, deckStatus, images, report, doc, video, videoStatus, personaId, archived, pinned, folderId, sortIndex, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        c.id,
        c.title ?? "新任务",
        c.mode ?? "chat",
        c.model ?? "demo",
        c.modelProvider ?? null,
        c.deck === undefined || c.deck === null ? null : JSON.stringify(c.deck),
        c.deckStatus ?? null,
        c.images === undefined ? "[]" : JSON.stringify(images),
        c.report === undefined || c.report === null ? null : JSON.stringify(c.report),
        c.doc === undefined || c.doc === null ? null : JSON.stringify(c.doc),
        c.video === undefined || c.video === null ? null : JSON.stringify(c.video),
        c.videoStatus ?? null,
        c.personaId ?? null,
        c.archived ? 1 : 0,
        c.pinned ? 1 : 0,
        c.folderId ?? null,
        c.sortIndex ?? null,
        now,
        now
      );
    }
  },

  insertMessage(m: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    error?: boolean;
  }): void {
    getDb()
      .prepare(
        "INSERT INTO messages (id, conversationId, role, content, error, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(m.id, m.conversationId, m.role, m.content, m.error ? 1 : 0, Date.now());
    getDb().prepare("UPDATE conversations SET updatedAt = ? WHERE id = ?").run(Date.now(), m.conversationId);
  },

  /** 更新消息内容（重新生成时覆盖同一条，避免历史里堆叠旧版本） */
  updateMessage(id: string, content: string, error?: boolean): void {
    getDb()
      .prepare("UPDATE messages SET content = ?, error = ? WHERE id = ?")
      .run(content, error ? 1 : 0, id);
  },

  /** 删除单条消息（编辑重发时移除旧的对话片段） */
  deleteMessage(id: string): void {
    getDb().prepare("DELETE FROM messages WHERE id = ?").run(id);
  },

  /** 更新归档/置顶/标题等标记 */
  patchFlags(id: string, flags: { archived?: boolean; pinned?: boolean; title?: string; sortIndex?: number | null }): void {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (flags.archived !== undefined) {
      sets.push("archived = ?");
      params.push(flags.archived ? 1 : 0);
    }
    if (flags.pinned !== undefined) {
      sets.push("pinned = ?");
      params.push(flags.pinned ? 1 : 0);
    }
    if (flags.title !== undefined) {
      sets.push("title = ?");
      params.push(flags.title);
    }
    if (flags.sortIndex !== undefined) {
      sets.push("sortIndex = ?");
      params.push(flags.sortIndex);
    }
    if (sets.length === 0) return;
    sets.push("updatedAt = ?");
    params.push(Date.now(), id);
    getDb().prepare(`UPDATE conversations SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  },

  /**
   * UX3 批量写手动排序。一次拖拽要重排列表内多行，逐行 patchFlags 会把
   * 每行 updatedAt 都刷成「现在」，历史列表的时间分组会立刻乱掉；
   * 这里固定不动 updatedAt，只写 sortIndex。
   */
  setSortIndexes(entries: Array<{ id: string; sortIndex: number | null }>): void {
    if (entries.length === 0) return;
    const stmt = getDb().prepare("UPDATE conversations SET sortIndex = ? WHERE id = ?");
    for (const e of entries) stmt.run(e.sortIndex, e.id);
  },

  setArchivedBatch(ids: string[], archived: boolean): void {
    const db = getDb();
    const stmt = db.prepare("UPDATE conversations SET archived = ?, updatedAt = ? WHERE id = ?");
    for (const id of ids) stmt.run(archived ? 1 : 0, Date.now(), id);
  },

  /** 软删除：仅标记 deletedAt，数据保留在回收站里，可恢复（DB11） */
  deleteConversation(id: string): void {
    getDb()
      .prepare("UPDATE conversations SET deletedAt = ? WHERE id = ? AND deletedAt IS NULL")
      .run(Date.now(), id);
  },

  deleteConversations(ids: string[]): void {
    const db = getDb();
    const stmt = db.prepare("UPDATE conversations SET deletedAt = ? WHERE id = ? AND deletedAt IS NULL");
    const now = Date.now();
    for (const id of ids) stmt.run(now, id);
  },

  /** 回收站列表：软删除的会话，按删除时间倒序（DB12） */
  listDeletedConversations(): StoredConversation[] {
    const rows = getDb()
      .prepare("SELECT * FROM conversations WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC")
      .all() as Record<string, unknown>[];
    return rows.map(rowToConversation);
  },

  restoreConversation(id: string): void {
    getDb().prepare("UPDATE conversations SET deletedAt = NULL WHERE id = ?").run(id);
  },

  restoreConversations(ids: string[]): void {
    const db = getDb();
    const stmt = db.prepare("UPDATE conversations SET deletedAt = NULL WHERE id = ?");
    for (const id of ids) stmt.run(id);
  },

  /** 彻底删除会话：级联删消息并清理磁盘图片，不可恢复（DB12） */
  purgeConversation(id: string): void {
    const db = getDb();
    removeExternalImages(repo.getConversation(id)?.images ?? []);
    docVersionRepo.deleteByConversation(id);
    db.prepare("DELETE FROM messages WHERE conversationId = ?").run(id);
    db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  },

  purgeConversations(ids: string[]): void {
    const db = getDb();
    for (const id of ids) {
      removeExternalImages(repo.getConversation(id)?.images ?? []);
      docVersionRepo.deleteByConversation(id);
      db.prepare("DELETE FROM messages WHERE conversationId = ?").run(id);
      db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
    }
  },

  /** 清除软删除超过 ttlMs 的会话，返回清理数量（DB12 的 30 天自动清理） */
  purgeExpiredConversations(ttlMs: number): number {
    const db = getDb();
    const cutoff = Date.now() - ttlMs;
    const rows = db
      .prepare("SELECT id FROM conversations WHERE deletedAt IS NOT NULL AND deletedAt <= ?")
      .all(cutoff) as { id: string }[];
    for (const { id } of rows) {
      removeExternalImages(repo.getConversation(id)?.images ?? []);
      docVersionRepo.deleteByConversation(id);
      db.prepare("DELETE FROM messages WHERE conversationId = ?").run(id);
      db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
    }
    return rows.length;
  },

  /** 对消息正文做 FTS5 全文搜索，返回高亮片段（DB8/DB9） */
  searchMessages(q: string, limit = 20): SearchHit[] {
    const query = q.trim();
    if (!query) return [];
    // 查询侧同样过 cjkSeg：索引里的中文是单字 token，搜索词也必须切成
    // "苹 果" 才能以相邻词组命中；双引号包裹规避 FTS5 语法注入。
    const match = cjkSeg(query)
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, '""')}"`)
      .join(" OR ");
    try {
      const rows = getDb()
        .prepare(
          `SELECT messageId, conversationId, snippet(messages_fts, 2, '[[', ']]', '…', 16) AS snippet
           FROM messages_fts WHERE content MATCH ? ORDER BY rank LIMIT ?`
        )
        .all(match, limit) as SearchHit[];
      // 切词在字间插了空格，展示前还原自然文本：
      // 1) 相邻高亮段合并（]] [[ → 无），让 [[苹]][[果]] 显示成 [[苹果]]；
      // 2) 删除汉字间因切词插入的空格；英文单词间的空格属于原文，保留。
      const cjk = "\\u3400-\\u9FFF\\uF900-\\uFAFF";
      const restore = (s: string) =>
        s
          .replace(/\]\] *\[\[/g, "")
          .replace(new RegExp(`([${cjk}]) +(?=[${cjk}])`, "g"), "$1")
          .trim();
      return rows.map((h) => ({ ...h, snippet: restore(h.snippet) }));
    } catch {
      // 异常查询（纯符号等）降级为空结果，不让搜索把请求打挂
      return [];
    }
  },

  /**
   * 手动压缩数据库（DB16）：VACUUM 重建文件消除空洞，随后 wal_checkpoint
   * 把 WAL 日志合并回主文件，两者配合才真正缩小磁盘占用。
   */
  vacuum(): void {
    const db = getDb();
    db.exec("VACUUM");
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  },

  /** 低成本查询计划优化（DB16）：官方建议低频调用，避免每请求都跑 */
  optimize(): void {
    getDb().exec("PRAGMA optimize");
  },
};

/** 案例分享（方案 B：服务器公开链接） */
export interface CaseShareRecord {
  code: string;
  templateId: string;
  label: string;
  prompt: string;
  values: Record<string, string>;
  output?: string;
  image?: string;
  source?: string;
}

export function createCaseShare(rec: Omit<CaseShareRecord, "code">): string {
  const db = getDb();
  const code = randomUUID().replace(/-/g, "").slice(0, 12);
  db.prepare("INSERT INTO case_shares (code, data, createdAt) VALUES (?, ?, ?)").run(
    code,
    JSON.stringify(rec),
    Date.now()
  );
  return code;
}

export function getCaseShare(code: string): CaseShareRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT data FROM case_shares WHERE code = ?").get(code) as
    | { data: string }
    | undefined;
  if (!row) return null;
  try {
    return { code, ...(JSON.parse(row.data) as Omit<CaseShareRecord, "code">) };
  } catch {
    return null;
  }
}

/* ---------------- 标签（DB13） ---------------- */

function rowToTag(r: Record<string, unknown>): StoredTag {
  return {
    id: r.id as string,
    name: r.name as string,
    color: (r.color as string | null) ?? null,
    createdAt: r.createdAt as number,
  };
}

export const tagRepo = {
  listTags(): StoredTag[] {
    const rows = getDb()
      .prepare("SELECT * FROM tags ORDER BY createdAt ASC")
      .all() as Record<string, unknown>[];
    return rows.map(rowToTag);
  },

  createTag(name: string, color?: string | null): StoredTag {
    const db = getDb();
    const id = randomUUID();
    const now = Date.now();
    db.prepare("INSERT INTO tags (id, name, color, createdAt) VALUES (?, ?, ?, ?)").run(
      id,
      name,
      color ?? null,
      now
    );
    return { id, name, color: color ?? null, createdAt: now };
  },

  deleteTag(id: string): void {
    const db = getDb();
    db.prepare("DELETE FROM conversation_tags WHERE tagId = ?").run(id);
    db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  },

  /** 覆盖式绑定：传入完整 tagIds 列表，旧的关联先清掉再写入 */
  setConversationTags(conversationId: string, tagIds: string[]): void {
    const db = getDb();
    const now = Date.now();
    const assoc = db.prepare(
      "INSERT OR IGNORE INTO conversation_tags (conversationId, tagId, createdAt) VALUES (?, ?, ?)"
    );
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("DELETE FROM conversation_tags WHERE conversationId = ?").run(conversationId);
      for (const tagId of tagIds) assoc.run(conversationId, tagId, now);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  },

  getConversationTags(conversationId: string): StoredTag[] {
    const rows = getDb()
      .prepare(
        "SELECT t.* FROM tags t JOIN conversation_tags ct ON ct.tagId = t.id WHERE ct.conversationId = ? ORDER BY t.createdAt ASC"
      )
      .all(conversationId) as Record<string, unknown>[];
    return rows.map(rowToTag);
  },

  listConversationsByTag(tagId: string): StoredConversation[] {
    const rows = getDb()
      .prepare(
        "SELECT c.* FROM conversations c JOIN conversation_tags ct ON ct.conversationId = c.id WHERE ct.tagId = ? AND c.deletedAt IS NULL ORDER BY c.pinned DESC, c.updatedAt DESC"
      )
      .all(tagId) as Record<string, unknown>[];
    return rows.map(rowToConversation);
  },
};

/* ---------------- 文件夹分组（DB14） ---------------- */

export interface StoredFolder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

function rowToFolder(r: Record<string, unknown>): StoredFolder {
  return {
    id: r.id as string,
    name: r.name as string,
    createdAt: r.createdAt as number,
    updatedAt: r.updatedAt as number,
  };
}

export const folderRepo = {
  listFolders(): StoredFolder[] {
    const rows = getDb()
      .prepare("SELECT * FROM folders ORDER BY createdAt ASC")
      .all() as Record<string, unknown>[];
    return rows.map(rowToFolder);
  },

  createFolder(name: string): StoredFolder {
    const db = getDb();
    const id = randomUUID();
    const now = Date.now();
    db.prepare("INSERT INTO folders (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(
      id,
      name,
      now,
      now
    );
    return { id, name, createdAt: now, updatedAt: now };
  },

  renameFolder(id: string, name: string): void {
    getDb().prepare("UPDATE folders SET name = ?, updatedAt = ? WHERE id = ?").run(
      name,
      Date.now(),
      id
    );
  },

  /** 删除文件夹：folderId 外键 ON DELETE SET NULL，会话自动回到未分组 */
  deleteFolder(id: string): void {
    getDb().prepare("DELETE FROM folders WHERE id = ?").run(id);
  },

  /** 移动会话到文件夹；folderId 传 null 表示移回未分组 */
  moveConversation(conversationId: string, folderId: string | null): void {
    getDb()
      .prepare("UPDATE conversations SET folderId = ?, updatedAt = ? WHERE id = ?")
      .run(folderId, Date.now(), conversationId);
  },
};

/* ---------------- 用量与积分账本（AI8/AI10/AI11） ---------------- */

export interface StoredUsageRecord {
  id: string;
  conversationId: string | null;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  credits: number;
  success: boolean;
  durationMs: number;
  createdAt: number;
}

/** 看板聚合行（AI10）：按天 × 模型 */
export interface UsageDailyStat {
  day: string; // YYYY-MM-DD
  model: string;
  provider: string;
  calls: number;
  successCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  credits: number;
}

export const usageRepo = {
  /** 记一次网关调用（成功或失败都记，AI8）；失败时 credits 传 0 */
  record(u: Omit<StoredUsageRecord, "id" | "createdAt"> & { id?: string }): string {
    const id = u.id ?? randomUUID();
    getDb()
      .prepare(
        `INSERT INTO usage_records
         (id, conversationId, model, provider, inputTokens, outputTokens, costUsd, credits, success, durationMs, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        u.conversationId ?? null,
        u.model,
        u.provider,
        u.inputTokens,
        u.outputTokens,
        u.costUsd,
        u.credits,
        u.success ? 1 : 0,
        u.durationMs,
        Date.now()
      );
    return id;
  },

  /** 按天 × 模型聚合，days = 最近 N 天（AI10） */
  dailyStats(days = 30): UsageDailyStat[] {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = getDb()
      .prepare(
        `SELECT substr(strftime('%Y-%m-%d', createdAt / 1000, 'unixepoch', 'localtime'), 1, 10) AS day,
                model,
                provider,
                COUNT(*) AS calls,
                SUM(success) AS successCalls,
                SUM(inputTokens) AS inputTokens,
                SUM(outputTokens) AS outputTokens,
                SUM(costUsd) AS costUsd,
                SUM(credits) AS credits
         FROM usage_records
         WHERE createdAt >= ?
         GROUP BY day, model
         ORDER BY day DESC, credits DESC`
      )
      .all(since) as Record<string, unknown>[];
    return rows.map((r) => ({
      day: r.day as string,
      model: r.model as string,
      provider: r.provider as string,
      calls: r.calls as number,
      successCalls: r.successCalls as number,
      inputTokens: r.inputTokens as number,
      outputTokens: r.outputTokens as number,
      costUsd: r.costUsd as number,
      credits: r.credits as number,
    }));
  },
};

/* ---------------- 积分账本（AI11） ---------------- */

export interface CreditBalance {
  /** 累计授予（免费额度） */
  granted: number;
  /** 仍在挂起的预扣（尚未结算也未回滚） */
  reserved: number;
  /** 已结算消耗 */
  settled: number;
  /** 可用 = granted - reserved - settled */
  available: number;
}

export const creditRepo = {
  /** 授予积分（注册赠送 / 订阅发放） */
  grant(amount: number, note?: string): void {
    const db = getDb();
    db.prepare("INSERT INTO credit_ledger (id, kind, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)").run(
      randomUUID(),
      "grant",
      amount,
      note ?? null,
      Date.now()
    );
  },

  /** 预扣积分：返回账本行 id；余额不足抛错（AI11） */
  reserve(amount: number, note?: string): string {
    const db = getDb();
    if (amount <= 0) {
      // 0 预扣也要记账吗？不记——demo 模型免费，直接给个哑 id
      return "free";
    }
    const bal = creditRepo.balance();
    if (bal.available < amount) {
      throw new Error(`积分不足：需要 ${amount}，可用 ${bal.available}`);
    }
    const id = randomUUID();
    db.prepare("INSERT INTO credit_ledger (id, kind, amount, usageId, note, createdAt) VALUES (?, ?, ?, NULL, ?, ?)").run(
      id,
      "reserve",
      amount,
      note ?? null,
      Date.now()
    );
    return id;
  },

  /** 结算：预扣转实际消耗；actual 可少于预扣（输出比预期短），差额隐式退还 */
  settle(reserveId: string, actual: number, usageId?: string): void {
    const db = getDb();
    if (reserveId === "free") return;
    const row = db
      .prepare("SELECT id, amount FROM credit_ledger WHERE id = ? AND kind = 'reserve'")
      .get(reserveId) as { id: string; amount: number } | undefined;
    if (!row) return; // 幂等：不存在（重复结算/测试哑 id）直接跳过
    const consumed = Math.min(actual, row.amount);
    const refund = row.amount - consumed;
    const now = Date.now();
    const tx = db.prepare(
      "INSERT INTO credit_ledger (id, kind, amount, usageId, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    );
    db.exec("BEGIN IMMEDIATE");
    try {
      // 预扣行转成 settle（金额 = 实际消耗），挂起额度随之释放
      db.prepare("UPDATE credit_ledger SET kind = 'settle', amount = ?, usageId = ? WHERE id = ?").run(
        consumed,
        usageId ?? null,
        reserveId
      );
      if (refund > 0) {
        tx.run(randomUUID(), "refund", refund, usageId ?? null, "结算差额退还", now);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  },

  /** 回滚未结算的预扣（调用失败，AI11）；幂等：已结算/已回滚的行不重复处理 */
  refund(reserveId: string): void {
    const db = getDb();
    if (reserveId === "free") return;
    const row = db
      .prepare("SELECT id, amount FROM credit_ledger WHERE id = ? AND kind = 'reserve'")
      .get(reserveId) as { id: string; amount: number } | undefined;
    if (!row) return;
    db.prepare("DELETE FROM credit_ledger WHERE id = ?").run(reserveId);
    db.prepare(
      "INSERT INTO credit_ledger (id, kind, amount, note, createdAt) VALUES (?, 'refund', ?, ?, ?)"
    ).run(randomUUID(), row.amount, `调用失败回滚预扣 ${row.amount} 积分`, Date.now());
  },

  /** 余额三态视图 */
  balance(): CreditBalance {
    const rows = getDb()
      .prepare("SELECT kind, SUM(amount) AS total FROM credit_ledger GROUP BY kind")
      .all() as Array<{ kind: string; total: number | null }>;
    const by = (k: string) => Number(rows.find((r) => r.kind === k)?.total ?? 0);
    const granted = by("grant");
    const reserved = by("reserve");
    const settled = by("settle");
    return { granted, reserved, settled, available: granted - reserved - settled };
  },
};

/* ---------------- 会员 & 订单 ---------------- */

export type MembershipPlan = "free" | "pro" | "team";

export interface StoredMembership {
  id: string;
  plan: MembershipPlan;
  autoRenew: boolean;
  renewAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface StoredOrder {
  id: string;
  plan: MembershipPlan;
  amount: number; // 元
  status: "paid" | "pending" | "cancelled";
  createdAt: number;
}

/* ---------------- 文档版本历史（DOC5） ---------------- */

export interface StoredDocVersion {
  id: string;
  conversationId: string;
  title: string;
  content: string;
  createdAt: number;
}

/** 每会话保留的版本数上限：快照按 30 分钟节流写入，封顶防止长期使用无限膨胀 */
export const DOC_VERSION_CAP = 30;

export const docVersionRepo = {
  /** 保存一份快照（30 分钟节流由 store 侧控制），返回行 id */
  save(v: Omit<StoredDocVersion, "id" | "createdAt">): string {
    const db = getDb();
    const id = randomUUID();
    db.prepare(
      "INSERT INTO doc_versions (id, conversationId, title, content, createdAt) VALUES (?, ?, ?, ?, ?)"
    ).run(id, v.conversationId, v.title, v.content, Date.now());
    // 封顶裁剪：同一会话只留最近 DOC_VERSION_CAP 份
    db.prepare(
      `DELETE FROM doc_versions WHERE conversationId = ? AND id NOT IN (
         SELECT id FROM doc_versions WHERE conversationId = ? ORDER BY createdAt DESC LIMIT ?
       )`
    ).run(v.conversationId, v.conversationId, DOC_VERSION_CAP);
    return id;
  },

  /** 某会话的版本列表（新→旧），供版本历史面板展示 */
  list(conversationId: string, limit = 20): StoredDocVersion[] {
    const rows = getDb()
      .prepare(
        "SELECT id, conversationId, title, content, createdAt FROM doc_versions WHERE conversationId = ? ORDER BY createdAt DESC LIMIT ?"
      )
      .all(conversationId, limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      conversationId: r.conversationId as string,
      title: r.title as string,
      content: r.content as string,
      createdAt: r.createdAt as number,
    }));
  },

  /** 会话彻底删除（回收站清空）时级联清理版本，避免孤儿行 */
  deleteByConversation(conversationId: string): void {
    getDb().prepare("DELETE FROM doc_versions WHERE conversationId = ?").run(conversationId);
  },
};

const SELF_ID = "self";

function rowToMembership(r: Record<string, unknown>): StoredMembership {
  return {
    id: r.id as string,
    plan: (r.plan as MembershipPlan) ?? "free",
    autoRenew: Boolean(r.autoRenew),
    renewAt: r.renewAt ? (r.renewAt as number) : null,
    createdAt: r.createdAt as number,
    updatedAt: r.updatedAt as number,
  };
}

function rowToOrder(r: Record<string, unknown>): StoredOrder {
  return {
    id: r.id as string,
    plan: (r.plan as MembershipPlan) ?? "free",
    amount: (r.amount as number) ?? 0,
    status: (r.status as StoredOrder["status"]) ?? "paid",
    createdAt: r.createdAt as number,
  };
}

export const membershipRepo = {
  /** 获取当前会员；若无则自动创建默认“专业版”试用会员 */
  get(): StoredMembership {
    const db = getDb();
    const row = db.prepare("SELECT * FROM membership WHERE id = ?").get(SELF_ID) as
      | Record<string, unknown>
      | undefined;
    if (row) return rowToMembership(row);

    const now = Date.now();
    const renewAt = now + 30 * 24 * 60 * 60 * 1000;
    db.prepare(
      "INSERT INTO membership (id, plan, autoRenew, renewAt, createdAt, updatedAt) VALUES (?, 'pro', 1, ?, ?, ?)"
    ).run(SELF_ID, renewAt, now, now);
    // 直接返回刚写入的值，不递归自调：INSERT 若静默失败，递归会无限展开直至栈溢出
    return {
      id: SELF_ID,
      plan: "pro",
      autoRenew: true,
      renewAt,
      createdAt: now,
      updatedAt: now,
    };
  },

  upgrade(plan: MembershipPlan, amount: number): { membership: StoredMembership; order: StoredOrder } {
    const db = getDb();
    const now = Date.now();
    const id = randomUUID();
    db.prepare("INSERT INTO orders (id, plan, amount, status, createdAt) VALUES (?, ?, ?, 'paid', ?)").run(
      id,
      plan,
      amount,
      now
    );
    const renewAt = now + 30 * 24 * 60 * 60 * 1000;
    db.prepare(
      "UPDATE membership SET plan = ?, autoRenew = 1, renewAt = ?, updatedAt = ? WHERE id = ?"
    ).run(plan, renewAt, now, SELF_ID);
    return {
      membership: membershipRepo.get(),
      order: { id, plan, amount, status: "paid", createdAt: now },
    };
  },

  cancelAutoRenew(): StoredMembership {
    const db = getDb();
    db.prepare("UPDATE membership SET autoRenew = 0, updatedAt = ? WHERE id = ?").run(Date.now(), SELF_ID);
    return membershipRepo.get();
  },

  listOrders(): StoredOrder[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM orders ORDER BY createdAt DESC").all() as Record<string, unknown>[];
    return rows.map(rowToOrder);
  },

  stats(): { conversations: number; messages: number; exports: number } {
    const db = getDb();
    const conversations = (
      db.prepare("SELECT COUNT(*) AS n FROM conversations").get() as { n: number }
    ).n;
    const messages = (db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number }).n;
    const exports = (
      db.prepare(
        "SELECT COUNT(*) AS n FROM conversations WHERE deck IS NOT NULL OR report IS NOT NULL OR doc IS NOT NULL"
      ).get() as { n: number }
    ).n;
    return { conversations, messages, exports };
  },
};
