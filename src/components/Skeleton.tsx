"use client";

import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  /** 圆角风格：text = 行高圆条（默认），box = 卡片圆角 */
  shape?: "text" | "box";
}

/**
 * UX15: 通用骨架原子。加载态用同一套底色与呼吸动画，
 * 避免各面板各画一套导致加载期视觉闪烁不一致。
 */
export function Skeleton({ className, shape = "text" }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse bg-stone-200/70",
        shape === "text" ? "rounded-md" : "rounded-xl",
        className
      )}
    />
  );
}