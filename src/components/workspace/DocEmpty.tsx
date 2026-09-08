"use client";

import { CalendarCheck, FileText, Presentation, RefreshCcw } from "lucide-react";
import { useChatStore } from "@/lib/store/chat";
import { DOC_SKELETONS } from "@/lib/docs/templates";

/**
 * docs 模式空状态（DOC12）：四套起始骨架 + AI 生成入口。
 * 与 StoryboardEmpty 不同：文档模板是「填空骨架」而非「生成 prompt」——
 * 点击直接把骨架写入 doc（走 generateDocs 的 seed 参数走 AI 演示路径会太慢），
 * 用户在骨架上改比从白纸开始写容易得多。
 */
export function DocEmpty() {
  const { generateDocs, setDoc, activeId } = useChatStore();

  const applySkeleton = (content: string, title: string) => {
    if (activeId) {
      // 有活跃会话：就地写入骨架开始编辑（setDoc 内部自带 600ms 防抖落库）
      setDoc({ title, content, updatedAt: Date.now() });
    } else {
      // 无会话：走一次生成让 store 补建会话（generateDocs 无活跃会话时会 newConversation("docs")），
      // 骨架作为 seed 传入——示例文档太慢，seed 直接给定骨架内容即时可用
      void generateDocs(title, content);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
        <FileText className="h-6 w-6 text-stone-400" />
      </div>
      <p className="text-center text-sm text-stone-500">
        在左侧描述要写的文档<br />
        或选一套骨架直接开始编辑
      </p>
      <div className="mt-6 grid w-full max-w-sm gap-2.5">
        {DOC_SKELETONS.map((sk) => (
          <button
            key={sk.id}
            onClick={() => applySkeleton(sk.content, sk.title)}
            className="group flex items-start gap-3 rounded-xl border border-stone-200/80 bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
              {sk.id === "weekly" ? (
                <CalendarCheck className="h-4 w-4" />
              ) : sk.id === "competitor" ? (
                <Presentation className="h-4 w-4" />
              ) : sk.id === "prd" ? (
                <FileText className="h-4 w-4" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-stone-800">{sk.title}骨架</span>
              <span className="mt-0.5 block text-[11.5px] text-stone-400">{sk.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2 border-t border-stone-100 pt-3 text-center">
        <button
          onClick={() => void generateDocs("产品使用手册")}
          className="text-[11.5px] text-stone-400 underline-offset-2 transition hover:text-brand-600 hover:underline"
        >
          或让 AI 从零生成一篇示例文档 →
        </button>
      </div>
    </div>
  );
}