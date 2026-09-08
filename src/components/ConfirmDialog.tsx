"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** 正文说明，可多行 */
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** danger 用于不可撤销的破坏性操作 */
  tone?: "danger" | "normal";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 统一确认弹窗，替代原生 window.confirm。
 * 原生 confirm 会阻塞主线程、样式不可控，且在 jsdom 里无法断言。
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "确定",
  cancelText = "取消",
  tone = "normal",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  // A11Y2: 焦点陷阱 + 关闭后归还触发元素（遮罩层一起被困住）
  const trap = useFocusTrap(open);

  // Esc 关闭：绑在 document 上，避免依赖弹窗内部焦点位置
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={trap}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          {tone === "danger" && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-[15px] font-semibold text-stone-800">
              {title}
            </h2>
            <p
              id="confirm-desc"
              className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-stone-500"
            >
              {message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-800"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-lg px-3.5 py-2 text-xs font-medium text-white transition",
              tone === "danger" ? "bg-red-500 hover:bg-red-600" : "bg-brand-600 hover:bg-brand-700"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}