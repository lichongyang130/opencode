"use client";

import { useRouter } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  Presentation,
  Search,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { useChatStore, type WorkspaceMode } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";

const SKILLS: {
  key: string;
  label: string;
  desc: string;
  mode: WorkspaceMode;
  icon: LucideIcon;
}[] = [
  { key: "docs", label: "文档", desc: "长文、方案、纪要、合同草稿", mode: "docs", icon: FileText },
  { key: "ppt", label: "PPT", desc: "可翻页汇报稿与演示文稿", mode: "slides", icon: Presentation },
  { key: "image", label: "图片", desc: "产品图、海报、氛围视觉", mode: "image", icon: ImageIcon },
  { key: "video", label: "视频", desc: "分镜脚本与动态成片", mode: "video", icon: Video },
  { key: "research", label: "深度研究", desc: "资料检索、对比与结论", mode: "research", icon: Search },
  { key: "chat", label: "智能对话", desc: "通用问答与多轮协作", mode: "chat", icon: Sparkles },
];

export default function SkillsPage() {
  const router = useRouter();
  const { newConversation, selectConversation } = useChatStore();

  const start = async (mode: WorkspaceMode, label: string) => {
    const id = await newConversation(mode);
    await selectConversation(id);
    toast(`已打开「${label}」技能`, "success");
    router.push("/chat");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6efe4] text-stone-800">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-7 lg:px-10">
        <h1 className="text-[36px] font-extrabold tracking-tight text-stone-900">技能</h1>
        <p className="mt-1 text-[13px] text-stone-500">选择一种产出技能，进入对应工作台。</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SKILLS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => void start(s.mode, s.label)}
              className="flex flex-col items-start rounded-[22px] border border-[#ece6db] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#e0b79c]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbf3ec] text-[#c05f3c]">
                <s.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-[16px] font-semibold text-stone-800">{s.label}</h2>
              <p className="mt-1 text-[13px] leading-6 text-stone-500">{s.desc}</p>
              <span className="mt-4 text-[12px] font-medium text-[#c05f3c]">开始使用 →</span>
            </button>
          ))}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
