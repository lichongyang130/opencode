import type { StoryboardTransition } from "./types";

/**
 * 分镜生成的系统提示词（V2）。
 * 与 slides 同思路：逼模型只输出一个 JSON，解析侧三级降级兜底。
 */
export function buildStoryboardPrompt(
  topic: string,
  opts?: { targetSec?: number; style?: string }
): { system: string; user: string } {
  const system = `你是专业的短视频分镜编剧。根据用户主题产出一份可直接开拍的结构化分镜脚本。

严格要求：
1. 只输出一个 JSON 对象，不要输出 markdown 代码块、不要任何解释或前后缀文字。
2. JSON 结构如下：
{
  "title": "片名",
  "targetSec": 60,
  "style": "整体风格（如：科技感 / 温暖治愈 / 快节奏剪辑）",
  "shots": [
    {
      "scene": "场景名-时段（如：办公室-白天）",
      "visual": "画面描述：景别+机位+主体动作（如：中景，手持跟拍，主角推门走进办公室）",
      "narration": "旁白文案（无旁白的纯画面镜头可省略）",
      "subtitle": "屏幕字幕（与旁白不同时可省略）",
      "durationSec": 5,
      "transition": "cut",
      "imagePrompt": "english visual prompt for ai image generation"
    }
  ]
}
3. 镜头数 6~12 个，每个 durationSec 在 2~15 之间且为整数；全片 durationSec 总和接近 targetSec。
4. transition 只能取：cut / fade / dissolve / wipe / zoom；默认 cut，需要强调情绪转换时才用其他。
5. visual 要具体可拍：包含景别（远/全/中/近/特写）、机位/运镜（固定/手持/推拉/跟拍）、主体动作。
6. narration 是口播文案，单镜不超过 2 句；短视频口播语速按每秒 4~5 个字估时。
7. imagePrompt 用英文短语（主体+风格+构图+光线），供 AI 生图直接使用。
8. 内容要专业、有节奏感，符合商业短片标准。`;

  const lines = [`请为以下需求生成分镜脚本：${topic}`];
  if (opts?.targetSec) lines.push(`目标总时长：${opts.targetSec} 秒`);
  if (opts?.style) lines.push(`整体风格偏好：${opts.style}`);
  return { system, user: lines.join("\n") };
}

/** transition 白名单归一：未知值降级为 cut（剪辑软件里 cut 永远安全） */
export function transitionOrDefault(t: unknown): StoryboardTransition {
  const valid: StoryboardTransition[] = ["cut", "fade", "dissolve", "wipe", "zoom"];
  return valid.includes(t as StoryboardTransition) ? (t as StoryboardTransition) : "cut";
}