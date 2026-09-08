"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { ShellSidebar } from "@/components/mockup/ShellSidebar";
import { SettingsCenter } from "@/components/workspace/SettingsCenter";
import { Toaster } from "@/components/Toaster";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4] text-stone-800">
      <ShellSidebar active="settings" />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#f0eadf] bg-[#fbf8f4] px-5 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.back()}
              title="返回"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-orange-300 hover:text-orange-600"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[18px] font-semibold text-stone-900">
                <SettingsIcon className="h-[18px] w-[18px] text-stone-400" />
                设置中心
              </h1>
              <p className="mt-0.5 truncate text-[12.5px] text-stone-400">
                模型密钥、联网搜索、数据备份与存储占用
              </p>
            </div>
          </div>
        </header>

        {/* 主体：设置面板 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-[#fdfaf6] shadow-sm">
            <SettingsCenter variant="page" />
          </div>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
