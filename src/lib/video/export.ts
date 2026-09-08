import type { Storyboard } from "./types";
import { formatDuration, totalDuration } from "./types";
import { downloadFile } from "./download";

/**
 * 分镜导出（V7）：
 * - Markdown 脚本：给编剧/导演看的完整台本
 * - CSV 拍摄清单：给统筹/场记逐镜打勾用
 * CSV 转义遵循 RFC 4180：引号包裹 + 内部引号翻倍。
 */

const csvCell = (v: string | number | undefined): string => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function storyboardToMarkdown(sb: Storyboard): string {
  const lines: string[] = [];
  lines.push(`# ${sb.title}`, "");
  if (sb.style) lines.push(`> 风格：${sb.style}`, "");
  lines.push(
    `**目标时长**：${sb.targetSec ? formatDuration(sb.targetSec) : "未设定"} · **实际总时长**：${formatDuration(totalDuration(sb))} · **共 ${sb.shots.length} 镜**`,
    "",
    "---",
    ""
  );
  sb.shots.forEach((shot, i) => {
    lines.push(`## 镜头 ${i + 1}（${shot.scene}·${shot.durationSec}s）`, "");
    lines.push(`- **画面**：${shot.visual}`);
    if (shot.narration) lines.push(`- **旁白**：${shot.narration}`);
    if (shot.subtitle) lines.push(`- **字幕**：${shot.subtitle}`);
    lines.push(`- **转场**：${shot.transition}`);
    lines.push("");
  });
  return lines.join("\n");
}

export function storyboardToCsv(sb: Storyboard): string {
  const header = ["镜号", "场景", "画面描述", "旁白", "字幕", "时长(秒)", "转场", "拍摄状态", "备注"];
  const rows = sb.shots.map((s, i) => [
    i + 1,
    s.scene,
    s.visual,
    s.narration ?? "",
    s.subtitle ?? "",
    s.durationSec,
    s.transition,
    "未拍",
    "",
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadStoryboardMarkdown(sb: Storyboard): void {
  downloadFile(`${sb.title}-分镜脚本.md`, storyboardToMarkdown(sb), "text/markdown;charset=utf-8");
}

export function downloadStoryboardCsv(sb: Storyboard): void {
  // BOM 让 Excel 正确识别 UTF-8（拍摄清单大概率会被粘进 Excel）
  downloadFile(`${sb.title}-拍摄清单.csv`, storyboardToCsv(sb), "text/csv;charset=utf-8");
}