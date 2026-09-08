"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface PromptDialogProps {
  open: boolean;
  title: string;
  /** 输入框占位提示（可选） */
  placeholder?: string;
  /** 初始值（就地重命名时带入当前标题） */
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  /** 确认时空串是否放行（重命名要求非空，文件夹名也要求非空，默认不放行） */
  allowEmpty?: boolean;
  /** 最多字符数（可选） */
  maxLength?: number;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * UX17: 统一文本输入弹窗，替代原生 window.prompt。
 * 原生 prompt 同 confirm 一样阻塞主线程、样式不可控、jsdom 无法断言；
 * 与 ConfirmDialog 保持同一套视觉与 Esc/回车交互习惯。
 */
export function PromptDialog({
  open,
  title,
  placeholder,
  initialValue = "",
  confirmText = "确定",
  cancelText = "取消",
  allowEmpty = false,
  maxLength,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  // A11Y2: 焦点陷阱 + 关闭后归还触发元素
  const trap = useFocusTrap(open);
  // A11Y1: 标题 id 供 aria-labelledby 关联
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
    // initialValue 只在打开瞬间生效，后续外部变化不覆盖用户输入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const trimmed = value.trim();
  const canConfirm = allowEmpty || trimmed.length > 0;

  return (
    <div
      ref={trap}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-[15px] font-semibold text-stone-800">{title}</h2>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canConfirm) onConfirm(value.trim());
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-700 outline-none transition focus:border-brand-400"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-800"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(value.trim())}
            className={cn(
              "rounded-lg px-3.5 py-2 text-xs font-medium text-white transition",
              canConfirm ? "bg-brand-600 hover:bg-brand-700" : "cursor-not-allowed bg-stone-300"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}