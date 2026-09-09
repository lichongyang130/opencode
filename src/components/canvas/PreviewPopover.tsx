"use client";

import type { CSSProperties, ReactNode } from "react";

/** 卡片锚点：卡片在视口中的位置（由 getBoundingClientRect 提供） */
export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Hover 大图浮层：鼠标悬停示例/模板卡时，在卡片旁浮出真实预览大图。
 * 纯展示层（pointer-events-none），移开卡片即消失；触屏设备不展示。
 */
export function PreviewPopover({
  anchor,
  children,
  width = 400,
}: {
  anchor: AnchorRect | null;
  children: ReactNode;
  width?: number;
}) {
  if (!anchor) return null;

  // 视口边界钳制：优先放右侧，放不下放左侧；上下居中于卡片高度
  const gap = 16;
  const pad = 12;
  const viewW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewH = typeof window !== "undefined" ? window.innerHeight : 800;

  const anchorRight = anchor.left + anchor.width;
  const preferRight = anchorRight + gap + width + pad <= viewW;
  let left = preferRight ? anchorRight + gap : anchor.left - gap - width;
  left = Math.max(pad, Math.min(left, viewW - width - pad));

  const style: CSSProperties = { left, width };
  const popH = 420; // 近似浮层高，用于垂直钳制
  const top = Math.min(anchor.top, Math.max(pad, viewH - popH - pad));
  style.top = top;

  return (
    <div
      role="presentation"
      className="pointer-events-none fixed z-[60] hidden overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_24px_60px_-24px_rgba(28,25,23,0.45)] md:block"
      style={style}
    >
      {children}
    </div>
  );
}
