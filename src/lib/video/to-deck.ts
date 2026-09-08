import type { Storyboard } from "./types";
import { formatDuration, totalDuration } from "./types";
import type { SlideDeck } from "@/lib/slides/types";

/**
 * 分镜转 PPT（V8）：把故事板映射成 SlideDeck，
 * 复用 /api/slides/export 的 PPTX 导出链路（含主题、页码、安全文件名）。
 * 每镜一页 content：标题 = 镜号 + 场景，要点 = 画面/旁白/字幕/时长/转场。
 */
export function storyboardToDeck(sb: Storyboard): SlideDeck {
  return {
    title: `${sb.title}（分镜）`,
    subtitle: sb.style ? `风格：${sb.style}` : undefined,
    theme: "ink",
    slides: [
      {
        layout: "cover",
        title: sb.title,
        subtitle: `分镜脚本 · 共 ${sb.shots.length} 镜 · 总时长 ${formatDuration(totalDuration(sb))}`,
      },
      ...sb.shots.map((shot, i) => ({
        layout: "content" as const,
        title: `镜头 ${i + 1} · ${shot.scene}（${shot.durationSec}s）`,
        bullets: [
          `画面：${shot.visual}`,
          ...(shot.narration ? [`旁白：${shot.narration}`] : []),
          ...(shot.subtitle ? [`字幕：${shot.subtitle}`] : []),
          `转场：${shot.transition}`,
        ],
        imagePrompt: shot.imagePrompt,
      })),
      { layout: "end", title: "完" },
    ],
  };
}