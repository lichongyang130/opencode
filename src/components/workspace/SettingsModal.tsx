"use client";

import { X } from "lucide-react";
import { SettingsCenter, type SettingsTabId } from "./SettingsCenter";

/**
 * 设置中心弹窗。
 * 与 /settings 页面共用 SettingsCenter，保证两处行为与文案完全一致。
 */
export function SettingsModal({
  open,
  onClose,
  initialTab = "models",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/45 p-4 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="my-6 flex w-full max-w-4xl overflow-hidden rounded-3xl border border-stone-200/80 bg-[#fdfaf6] shadow-2xl shadow-stone-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative max-h-[86vh] w-full md:max-h-[88vh]">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-20 rounded-lg bg-white/80 p-1.5 text-stone-400 transition hover:bg-white hover:text-stone-700"
            title="关闭（Esc）"
          >
            <X className="h-5 w-5" />
          </button>
          <SettingsCenter variant="modal" onClose={onClose} initialTab={initialTab} />
        </div>
      </div>
    </div>
  );
}
