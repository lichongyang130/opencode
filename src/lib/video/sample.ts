import type { Storyboard, StoryboardShot } from "./types";

/** 内置示例分镜（V2 demo 路径 / V10 空状态示例共用） */

export function buildSampleStoryboard(topic: string, targetSec?: number, style?: string): Storyboard {
  const t = topic.slice(0, 24) || "演示短片";
  const shots: StoryboardShot[] = [
    {
      id: "demo-1",
      scene: "城市-白天",
      visual: "航拍大远景，清晨的城市天际线，阳光穿过楼宇间隙",
      narration: `每天，这座城市都在讲述 ${t} 的故事。`,
      subtitle: `每天，这座城市都在讲述 ${t} 的故事`,
      durationSec: 4,
      transition: "fade",
      imagePrompt: "aerial view of city skyline at sunrise, cinematic, warm light",
    },
    {
      id: "demo-2",
      scene: "工作室-白天",
      visual: "中景，固定机位，主角坐在工作台前专注打磨作品",
      narration: "而所有的故事，都始于一次专注的投入。",
      subtitle: "始于专注",
      durationSec: 5,
      transition: "cut",
      imagePrompt: "medium shot, person crafting at workbench, focused, soft window light",
    },
    {
      id: "demo-3",
      scene: "街头-傍晚",
      visual: "近景，手持跟拍，主角穿过人流，脚步轻快",
      narration: "当作品走上街头，故事才真正开始。",
      durationSec: 4,
      transition: "dissolve",
      imagePrompt: "close up tracking shot, person walking through evening street crowd",
    },
    {
      id: "demo-4",
      scene: "舞台-夜晚",
      visual: "全景，缓慢推镜，聚光灯下的主角展示成果",
      narration: `${t}，此刻，被看见。`,
      subtitle: "被看见",
      durationSec: 5,
      transition: "zoom",
      imagePrompt: "wide shot, spotlight on stage, dramatic presentation moment",
    },
    {
      id: "demo-5",
      scene: "城市-夜晚",
      visual: "大远景，固定机位，城市灯火渐次亮起，画面渐黑",
      narration: "每一个认真讲述的人，都值得被听见。",
      subtitle: "值得被听见",
      durationSec: 4,
      transition: "fade",
      imagePrompt: "night city lights panorama, cinematic ending shot",
    },
  ];
  return {
    title: `《${t}》`,
    targetSec: targetSec ?? 22,
    style: style ?? "电影感 · 温暖叙事",
    shots,
  };
}