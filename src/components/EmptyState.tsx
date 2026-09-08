"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** lucide 图标组件 */
  icon: ReactNode;
  /** 主标题 */
  title: string;
  /** 引导说明（可选） */
  description?: string;
  /** 主行动区（按钮或模板入口） */
  action?: ReactNode;
  className?: string;
}

/**
 * UX16: 统一空态组件。插画位（图标）+ 引导文案 + 主行动，
 * 取代散落各处的「暂无 XX」灰字，给用户明确的下一步。
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        {icon}
      </div>
      <p className="text-[13px] font-medium text-stone-600">{title}</p>
      {description && (
        <p className="max-w-[240px] text-xs leading-relaxed text-stone-400">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}