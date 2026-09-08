"use client";

import { Clapperboard, Megaphone, Wrench } from "lucide-react";
import { useChatStore } from "@/lib/store/chat";

/**
 * video 模式空状态（V10）：3 个真实可点的示例。
 * 点击即用示例 prompt 触发生成（不是只填输入框）——分镜生成是一次性任务，
 * 用户看到示例的第一直觉就是「跑一个看看效果」。
 */
const EXAMPLES: { icon: typeof Megaphone; title: string; desc: string; prompt: string }[] = [
  {
    icon: Megaphone,
    title: "产品宣传片",
    desc: "60 秒品牌片 · 航拍开场到产品特写",
    prompt: "为一款智能咖啡机拍摄 60 秒品牌宣传片：从清晨城市航拍切入，到产品打磨细节，再到用户在家享用的温暖场景，结尾定格品牌 logo",
  },
  {
    icon: Clapperboard,
    title: "带货短视频",
    desc: "15 秒口播 · 快节奏卖点轰炸",
    prompt: "为新款降噪耳机写一条 15 秒带货短视频分镜：痛点开场（地铁噪音）、产品亮相、三个卖点快闪、价格促收尾",
  },
  {
    icon: Wrench,
    title: "操作教程",
    desc: "90 秒教学 · 分步演示配旁白",
    prompt: "制作一份 90 秒的「AI 写作助手使用教程」分镜：从打开页面开始，分五步演示核心功能，每步配画面特写与旁白讲解",
  },
];

export function StoryboardEmpty() {
  const { generateStoryboard, sending } = useChatStore();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
        <Clapperboard className="h-6 w-6 text-stone-400" />
      </div>
      <p className="text-center text-sm text-stone-500">
        在左侧描述你的视频需求<br />
        AI 会拆解成可拍、可改的分镜脚本
      </p>
      <div className="mt-6 grid w-full max-w-sm gap-2.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.title}
            disabled={sending}
            onClick={() => void generateStoryboard(ex.prompt)}
            className="group flex items-start gap-3 rounded-xl border border-stone-200/80 bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
              <ex.icon className="h-4.5 w-4.5 h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-stone-800">{ex.title}</span>
              <span className="mt-0.5 block text-[11.5px] text-stone-400">{ex.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}