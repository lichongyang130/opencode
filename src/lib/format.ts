/**
 * 时间与数字格式化统一工具（UX19）。
 *
 * 此前同类逻辑散在 6+ 个文件里且口径不一（HistoryPanel 的 HH:mm/MM-DD、
 * ShellSidebar 的今天/昨天、membership 的 toLocaleDateString 全日期……），
 * 改一处文案要全局搜。这里收敛成唯一出口，全部为纯函数：
 *  - formatRelativeTime：历史列表/消息时间戳（今天 HH:mm / 昨天 / MM-DD / YYYY-MM-DD）
 *  - formatDateTime：完整时间（设置中心、用量记录）
 *  - formatBytes：文件体积（图片/备份大小）
 *  - formatNumber：千分位（积分、用量统计）
 *
 * 刻意不用 Intl.RelativeTimeFormat：项目零依赖原则下它对「刚刚/分钟前」
 * 的粒度控制太粗，且各浏览器实现细节不一致，手写规则更可控。
 */

/** 历史列表时间：当天只给 HH:mm，跨天逐步放宽到日期（UX2 分组标题用同源的 dayKey） */
export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const d = new Date(ts);
  if (sameDay(ts, now)) {
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  // 昨天也不给 HH:mm —— 列表是按时间倒序的，用户对「昨天」关心的是哪天而不是几点
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(ts, yesterday.getTime())) {
    return "昨天";
  }
  if (d.getFullYear() === new Date(now).getFullYear()) {
    return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** UX2 分组键：今天 / 昨天 / 7 天内 / 更早，与 formatRelativeTime 同一套「天」判定 */
export type DayBucket = "today" | "yesterday" | "week" | "older";

export function dayBucketOf(ts: number, now: number = Date.now()): DayBucket {
  if (sameDay(ts, now)) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(ts, yesterday.getTime())) return "yesterday";
  // 7 天内：含今天往回数 7 个自然日（今天算第 1 天）；边界含当天零点对齐
  const diff = now - ts;
  if (diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000) return "week";
  return "older";
}

export const DAY_BUCKET_LABELS: Record<DayBucket, string> = {
  today: "今天",
  yesterday: "昨天",
  week: "7 天内",
  older: "更早",
};

/** 完整时间：YYYY-MM-DD HH:mm（跨天场景与详情页） */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 文件体积：B/KB/MB/GB，1 位小数（0 体积与 <1KB 直接给 B） */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  // B 档不带小数；其余档 1 位小数但抹掉尾随的 .0
  const text = i === 0 ? String(v) : v.toFixed(1).replace(/\.0$/, "");
  return `${text} ${units[i]}`;
}

/** 千分位：1234567 → "1,234,567"。负数与非有限值原样返回字符串 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const [int, frac] = String(Math.abs(n)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = n < 0 ? "-" : "";
  return sign + grouped + (frac ? "." + frac : "");
}

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}