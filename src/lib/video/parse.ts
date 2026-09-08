import { randomUUID } from "node:crypto";
import type { Storyboard, StoryboardShot } from "./types";
import { transitionOrDefault } from "./prompt";
import { looseParseJson } from "@/lib/json-loose";

/**
 * 分镜解析（V2）：与 slides/parse 同一套三级降级——
 * 合法 JSON → 修复后的 JSON → 纯文本切镜。任何一级都不抛错。
 */

export interface StoryboardParseResult {
  storyboard: Storyboard;
  /** 走了纯文本兜底，内容质量不保证 */
  degraded: boolean;
  /** 动过 JSON 修复（截断补齐等），内容可能不完整 */
  repaired: boolean;
}

function toShot(s: Record<string, unknown>): StoryboardShot | null {
  const visual = typeof s.visual === "string" ? s.visual.trim() : "";
  if (!visual) return null;
  const durationRaw = Number(s.durationSec);
  return {
    id: typeof s.id === "string" && s.id ? s.id : randomUUID(),
    scene: typeof s.scene === "string" && s.scene ? s.scene : "未命名场景",
    visual: visual.slice(0, 300),
    narration: typeof s.narration === "string" ? s.narration : undefined,
    subtitle: typeof s.subtitle === "string" ? s.subtitle : undefined,
    // 畸形时长钳到 1~60s：0 秒镜头没有意义，超长镜头拆成多镜是剪辑常识
    durationSec: Number.isFinite(durationRaw) ? Math.min(60, Math.max(1, Math.round(durationRaw))) : 3,
    transition: transitionOrDefault(s.transition),
    imagePrompt: typeof s.imagePrompt === "string" ? s.imagePrompt : undefined,
    imageUrl: typeof s.imageUrl === "string" ? s.imageUrl : undefined,
    audioUrl: typeof s.audioUrl === "string" ? s.audioUrl : undefined,
  };
}

/**
 * 纯文本兜底：模型没按 JSON 输出时按行切镜。
 * 「镜头 1 / Shot 1 / 1.」开头的行当镜号，其余行按「画面：」「旁白：」前缀归类；
 * 都认不出来时按空行分段，每段独立成镜。宁可给一份能编辑的草稿也不让用户白等。
 */
function storyboardFromText(raw: string, fallbackTitle: string): StoryboardShot[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const shots: StoryboardShot[] = [];
  let current: StoryboardShot | null = null;

  const push = () => {
    if (current && (current.visual || current.narration)) shots.push(current);
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^(?:镜头\s*(\d+)|(?:Shot|SHOT)\s*(\d+)|(\d+)[.、)])\s*(.*)$/) ?? null;
    const labeled = line.match(/^(?:画面|视觉)[：:]\s*(.*)$/) ?? null;
    const narration = line.match(/^(?:旁白|口播|VO)[：:]\s*(.*)$/) ?? null;
    const subtitle = line.match(/^(?:字幕)[：:]\s*(.*)$/) ?? null;
    const duration = line.match(/^(?:时长|约)\s*(\d+)\s*秒/) ?? null;

    if (heading) {
      push();
      current = {
        id: randomUUID(),
        scene: "未命名场景",
        visual: (heading[4] ?? "").trim().slice(0, 300),
        durationSec: 3,
        transition: "cut",
      };
      continue;
    }
    if (labeled || narration || subtitle || duration) {
      if (!current) {
        current = { id: randomUUID(), scene: "未命名场景", visual: "", durationSec: 3, transition: "cut" };
      }
      if (labeled) current.visual = labeled[1].slice(0, 300);
      else if (narration) current.narration = narration[1].slice(0, 200);
      else if (subtitle) current.subtitle = subtitle[1].slice(0, 100);
      else if (duration) current.durationSec = Math.min(60, Math.max(1, Number(duration[1])));
      continue;
    }
    // 普通行：归属当前镜的画面描述
    if (current) {
      current.visual = `${current.visual} ${line}`.trim().slice(0, 300);
    } else {
      current = {
        id: randomUUID(),
        scene: "未命名场景",
        visual: line.slice(0, 300),
        durationSec: 3,
        transition: "cut",
      };
    }
  }
  push();

  if (shots.length === 0) {
    shots.push({
      id: randomUUID(),
      scene: "未命名场景",
      visual: raw.trim().slice(0, 300) || "模型未返回可用内容，请重新生成",
      durationSec: 3,
      transition: "cut",
    });
  }
  void fallbackTitle;
  return shots;
}

export function parseStoryboard(raw: string, fallbackTitle = "未命名脚本"): StoryboardParseResult {
  const { value: obj, repaired } = looseParseJson(raw);

  const title =
    typeof obj?.title === "string" && obj.title ? (obj.title as string) : fallbackTitle;
  const targetRaw = Number(obj?.targetSec);
  const targetSec = Number.isFinite(targetRaw) && targetRaw > 0 ? Math.round(targetRaw) : undefined;
  const style = typeof obj?.style === "string" ? (obj.style as string) : undefined;

  const rawShots = Array.isArray(obj?.shots) ? (obj!.shots as unknown[]) : [];
  const shots = rawShots
    .map((s) => s as Record<string, unknown>)
    .filter((s) => s && typeof s === "object")
    .map(toShot)
    .filter((s): s is StoryboardShot => s !== null);

  if (shots.length > 0) {
    return { storyboard: { title, targetSec, style, shots }, degraded: false, repaired };
  }

  return {
    storyboard: { title, targetSec, style, shots: storyboardFromText(raw, title) },
    degraded: true,
    repaired,
  };
}