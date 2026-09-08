"use client";

import { useEffect, useRef } from "react";

/**
 * A11Y2: 弹窗焦点陷阱。
 *
 * 屏幕阅读器与键盘用户在弹窗打开时必须被困在弹窗内部 —— Tab 走到
 * 遮罩尽头要折回弹窗第一个可聚焦元素，Shift+Tab 同理折回最后一个；
 * 关闭后焦点归还给打开弹窗前的触发元素（否则焦点落到 body，
 * 键盘用户会「丢失」自己刚才的位置，得从头再 Tab 一遍）。
 *
 * 用法：把 ref 挂在弹窗最外层（含遮罩）的元素上。
 * open=false 时全部失效，同一组件多弹窗实例互不干扰。
 */
export function useFocusTrap(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const container = ref.current;
    if (!container) return;

    // 打开瞬间记下触发元素，供关闭后归还
    const opener = document.activeElement as HTMLElement | null;

    // 可见性过滤：真实浏览器里 display:none 元素两判定皆空，挡掉不参与循环；
    // jsdom 里 offsetParent/getClientRects 恒空（连 body 都没有布局盒），此时退化全放行
    const canProbeLayout = (() => {
      try {
        return document.body.getClientRects().length > 0;
      } catch {
        return false;
      }
    })();
    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (el) => !canProbeLayout || el.offsetParent !== null || el.getClientRects().length > 0
      );

    // 初始焦点：第一个可聚焦元素（调用方可主动 focus 特定元素覆盖此行为）
    const els = focusables();
    if (els.length) els[0].focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        // 折回到最后一个：焦点在弹窗外或第一个元素上时
        if (!container.contains(active) || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!container.contains(active) || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // 归还焦点：触发元素还在 DOM 里才还（可能已被一起卸载），否则退到 body
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  return ref;
}