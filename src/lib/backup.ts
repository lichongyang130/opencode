import type { StoredConversation, StoredMessage } from "./db/repo";

export interface Backup {
  app: "opencanvas";
  version: 1;
  exportedAt: string;
  conversations: (StoredConversation & { messages: StoredMessage[] })[];
}

export interface BackupImportResult {
  importedConversations: number;
  importedMessages: number;
  skippedConversations: number;
  skippedMessages: number;
}

export class BackupValidationError extends Error {}
export class BackupConflictError extends Error {}

type RecordValue = Record<string, unknown>;
function fail(path: string, expected: string): never {
  throw new BackupValidationError(`${path}：${expected}`);
}
function object(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "必须是对象");
  return value as RecordValue;
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "必须是数组");
  return value;
}
function string(value: unknown, path: string, nonempty = false): string {
  if (typeof value !== "string" || (nonempty && !value.trim())) fail(path, "必须是有效字符串");
  return value;
}
function boolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") fail(path, "必须是布尔值");
}
function timestamp(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 8640000000000000) {
    fail(path, "必须是有效的毫秒时间戳");
  }
}
function oneOf(value: unknown, values: string[], path: string): void {
  if (typeof value !== "string" || !values.includes(value)) fail(path, `仅支持 ${values.join(" / ")}`);
}
function strings(value: unknown, path: string): void {
  array(value, path).forEach((item, i) => string(item, `${path}[${i}]`));
}
function optionalStrings(value: RecordValue, fields: string[], path: string): void {
  // null（如尚未生成 TTS 的 audioUrl）与缺失都视为「未设置」，与 repo 侧可空字段语义一致
  for (const field of fields)
    if (value[field] !== undefined && value[field] !== null) string(value[field], `${path}.${field}`);
}

function validateDeck(value: unknown, path: string): void {
  if (value === null) return;
  const deck = object(value, path);
  string(deck.title, `${path}.title`);
  optionalStrings(deck, ["subtitle"], path);
  // PPT8：主题市场扩充后的完整主题白名单
  oneOf(
    deck.theme,
    ["violet", "ocean", "sunset", "forest", "ink", "rose", "amber", "slate", "midnight", "emerald"],
    `${path}.theme`
  );
  array(deck.slides, `${path}.slides`).forEach((value, i) => {
    const p = `${path}.slides[${i}]`;
    const slide = object(value, p);
    // PPT5：新增五种版式的 layout 白名单
    oneOf(
      slide.layout,
      ["cover", "toc", "content", "twoCol", "stats", "timeline", "compare", "process", "quote", "team", "end"],
      `${p}.layout`
    );
    optionalStrings(slide, ["title", "subtitle", "twoColTitle", "imagePrompt", "imageUrl", "note", "quote", "quoteBy"], p);
    for (const field of ["bullets", "bulletsRight"]) {
      if (slide[field] !== undefined) strings(slide[field], `${p}.${field}`);
    }
    if (slide.stats !== undefined) array(slide.stats, `${p}.stats`).forEach((value, j) => {
      const stat = object(value, `${p}.stats[${j}]`);
      string(stat.value, `${p}.stats[${j}].value`);
      string(stat.label, `${p}.stats[${j}].label`);
    });
    // PPT5：timeline/process 的 steps
    if (slide.steps !== undefined) array(slide.steps, `${p}.steps`).forEach((value, j) => {
      const step = object(value, `${p}.steps[${j}]`);
      string(step.item, `${p}.steps[${j}].item`);
      if (step.detail !== undefined) string(step.detail, `${p}.steps[${j}].detail`);
    });
  });
}

function validateReport(value: unknown, path: string): void {
  if (value === null) return;
  const report = object(value, path);
  string(report.topic, `${path}.topic`);
  string(report.summary, `${path}.summary`);
  timestamp(report.createdAt, `${path}.createdAt`);
  if (report.demo !== undefined) boolean(report.demo, `${path}.demo`);
  strings(report.takeaways, `${path}.takeaways`);
  array(report.sections, `${path}.sections`).forEach((value, i) => {
    const section = object(value, `${path}.sections[${i}]`);
    string(section.heading, `${path}.sections[${i}].heading`);
    string(section.body, `${path}.sections[${i}].body`);
  });
  array(report.sources, `${path}.sources`).forEach((value, i) => {
    const p = `${path}.sources[${i}]`;
    const source = object(value, p);
    for (const field of ["title", "url", "snippet"]) string(source[field], `${p}.${field}`);
    if (source.demo !== undefined) boolean(source.demo, `${p}.demo`);
  });
}

/** V3: 分镜脚本校验。字段宽松（前端 parseStoryboard 已保证形状），这里只锁结构骨架；
 *  null 与缺失（undefined）都视为「未设置」——旧版本导出的备份没有该键 */
function validateStoryboard(value: unknown, path: string): void {
  if (value === null || value === undefined) return;
  const sb = object(value, path);
  string(sb.title, `${path}.title`);
  if (sb.targetSec !== undefined && sb.targetSec !== null) {
    const t = sb.targetSec;
    if (typeof t !== "number" || !Number.isFinite(t) || t <= 0) fail(`${path}.targetSec`, "必须是正数");
  }
  if (sb.style !== undefined && sb.style !== null) string(sb.style, `${path}.style`);
  array(sb.shots, `${path}.shots`).forEach((value, i) => {
    const p = `${path}.shots[${i}]`;
    const shot = object(value, p);
    string(shot.id, `${p}.id`, true);
    string(shot.scene, `${p}.scene`);
    string(shot.visual, `${p}.visual`);
    optionalStrings(shot, ["narration", "subtitle", "imagePrompt", "imageUrl", "audioUrl"], p);
    const d = shot.durationSec;
    if (typeof d !== "number" || !Number.isFinite(d) || d <= 0 || d > 60) {
      fail(`${p}.durationSec`, "必须是 1~60 的数字");
    }
    oneOf(shot.transition, ["cut", "fade", "dissolve", "wipe", "zoom"], `${p}.transition`);
  });
}

/** Validate the complete v1 export before opening a transaction; never coerce or drop invalid records. */
export function validateBackup(input: unknown): Backup {
  const backup = object(input, "备份");
  if (backup.app !== "opencanvas") fail("app", "不是 OpenCanvas 备份");
  if (backup.version !== 1) fail("version", "不支持的备份版本，仅支持版本 1");
  const exportedAt = string(backup.exportedAt, "exportedAt", true);
  if (!Number.isFinite(Date.parse(exportedAt))) fail("exportedAt", "必须是有效日期");
  const conversationIds = new Set<string>();
  const messageIds = new Set<string>();
  array(backup.conversations, "conversations").forEach((value, i) => {
    const p = `conversations[${i}]`;
    const c = object(value, p);
    const id = string(c.id, `${p}.id`, true);
    if (conversationIds.has(id)) fail(`${p}.id`, "备份内会话 ID 重复");
    conversationIds.add(id);
    string(c.title, `${p}.title`);
    string(c.model, `${p}.model`, true);
    oneOf(c.mode, ["chat", "research", "slides", "image", "video", "docs"], `${p}.mode`);
    for (const field of ["modelProvider", "personaId"]) {
      // null 与缺失（undefined）都视为「未设置」，与 repo.upsertConversation 的语义保持一致
      if (c[field] !== null && c[field] !== undefined) string(c[field], `${p}.${field}`);
    }
    if (c.deckStatus !== null && c.deckStatus !== undefined) {
      oneOf(c.deckStatus, ["idle", "loading", "done", "error"], `${p}.deckStatus`);
    }
    if (c.videoStatus !== null && c.videoStatus !== undefined) {
      oneOf(c.videoStatus, ["idle", "loading", "done", "error"], `${p}.videoStatus`);
    }
    for (const field of ["archived", "pinned"]) boolean(c[field], `${p}.${field}`);
    for (const field of ["createdAt", "updatedAt"]) timestamp(c[field], `${p}.${field}`);
    validateDeck(c.deck, `${p}.deck`);
    validateReport(c.report, `${p}.report`);
    validateStoryboard(c.video, `${p}.video`);
    if (c.doc !== null) {
      const doc = object(c.doc, `${p}.doc`);
      string(doc.title, `${p}.doc.title`);
      string(doc.content, `${p}.doc.content`);
      timestamp(doc.updatedAt, `${p}.doc.updatedAt`);
    }
    const imageIds = new Set<string>();
    array(c.images, `${p}.images`).forEach((value, j) => {
      const ip = `${p}.images[${j}]`;
      const image = object(value, ip);
      const imageId = string(image.id, `${ip}.id`, true);
      if (imageIds.has(imageId)) fail(`${ip}.id`, "会话内图片 ID 重复");
      imageIds.add(imageId);
      for (const field of ["prompt", "model", "url"]) string(image[field], `${ip}.${field}`);
      timestamp(image.createdAt, `${ip}.createdAt`);
    });
    array(c.messages, `${p}.messages`).forEach((value, j) => {
      const mp = `${p}.messages[${j}]`;
      const m = object(value, mp);
      const messageId = string(m.id, `${mp}.id`, true);
      if (messageIds.has(messageId)) fail(`${mp}.id`, "备份内消息 ID 重复");
      messageIds.add(messageId);
      if (m.conversationId !== id) fail(`${mp}.conversationId`, "消息不属于所在会话");
      oneOf(m.role, ["user", "assistant"], `${mp}.role`);
      string(m.content, `${mp}.content`);
      boolean(m.error, `${mp}.error`);
      timestamp(m.createdAt, `${mp}.createdAt`);
    });
  });
  return input as Backup;
}
