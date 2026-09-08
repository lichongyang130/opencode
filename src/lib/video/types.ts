/** 分镜脚本 —— 数据结构（V1） */

/** 转场方式：默认 cut，特殊场景才需要花哨转场 */
export type StoryboardTransition = "cut" | "fade" | "dissolve" | "wipe" | "zoom";

/** 单个镜头（一「卡」） */
export interface StoryboardShot {
  id: string;
  /** 场景名（如「办公室-白天」），同一场景的镜头拍摄时共用机位与布光 */
  scene: string;
  /** 画面描述：景别 + 机位 + 主体动作，给拍摄/AI 生图直接用 */
  visual: string;
  /** 旁白 / 口播文案；纯画面镜头可为空 */
  narration?: string;
  /** 屏幕字幕（短视频常见：旁白与字幕分离） */
  subtitle?: string;
  /** 预计时长（秒） */
  durationSec: number;
  /** 到下一镜的转场；最后一镜的该字段无意义 */
  transition: StoryboardTransition;
  /** AI 生图提示词（英文短语，V5 生成画面用） */
  imagePrompt?: string;
  /** V5 生成画面的结果（data: 或 http(s) URL）；未生成为空 */
  imageUrl?: string;
  /** V6 旁白转 TTS 的音频结果；未生成为空 */
  audioUrl?: string;
}

export interface Storyboard {
  title: string;
  /** 整片目标时长（秒），供 V9 超时长提醒对比 */
  targetSec?: number;
  /** 风格基调提示（如「科技感 / 温暖 / 快节奏」），影响生图与配乐 */
  style?: string;
  shots: StoryboardShot[];
}

/** 时长格式化：90 → "1:30"；V9 汇总与超时提醒共用 */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** 全片总时长（秒）；V9 汇总 */
export function totalDuration(sb: Pick<Storyboard, "shots">): number {
  return sb.shots.reduce((sum, s) => sum + (s.durationSec > 0 ? s.durationSec : 0), 0);
}

/**
 * 总时长与目标时长的偏差提示（V9）。
 * 超过目标 20% 提醒删减，不足 80% 提示加镜；范围内返回 null 不打扰。
 */
export function durationWarning(sb: Storyboard): string | null {
  if (!sb.targetSec || sb.targetSec <= 0) return null;
  const total = totalDuration(sb);
  if (total > sb.targetSec * 1.2) {
    return `当前总时长 ${formatDuration(total)}，超出目标 ${formatDuration(sb.targetSec)} 的 20%，建议删减镜头`;
  }
  if (total < sb.targetSec * 0.8) {
    return `当前总时长 ${formatDuration(total)}，不足目标 ${formatDuration(sb.targetSec)} 的 80%，建议补充镜头`;
  }
  return null;
}