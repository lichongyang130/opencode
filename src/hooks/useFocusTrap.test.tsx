/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { useFocusTrap } from "./useFocusTrap";

/**
 * A11Y2 焦点陷阱行为：
 * Tab/Shift+Tab 在弹窗内循环、外部焦点拉回、关闭后归还触发元素。
 * jsdom 里 element.focus() 真实生效（document.activeElement 同步更新）。
 */

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  const trap = useFocusTrap(open);
  if (!open) return <div>已关闭</div>;
  return (
    <div ref={trap} data-testid="dialog">
      <button onClick={onClose}>取消</button>
      <input aria-label="名称" />
      <button>确定</button>
    </div>
  );
}

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button data-testid="opener" onClick={() => setOpen(true)}>
        打开弹窗
      </button>
      <button>页面里另一个按钮</button>
      <Harness open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

/** 直开的弹窗（无触发流程，用于循环测试） */
function OpenDialog() {
  const trap = useFocusTrap(true);
  return (
    <div ref={trap} data-testid="dialog">
      <button>取消</button>
      <input aria-label="名称" />
      <button>确定</button>
    </div>
  );
}

const tab = (shift = false) =>
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift, bubbles: true, cancelable: true })
  );

afterEach(() => {
  cleanup();
});

describe("useFocusTrap", () => {
  it("打开后初始焦点落在弹窗内第一个可聚焦元素", () => {
    render(<OpenDialog />);
    const first = document.querySelector('[data-testid="dialog"] button') as HTMLButtonElement;
    expect(document.activeElement).toBe(first);
  });

  it("Tab 从最后一个元素折回第一个", () => {
    render(<OpenDialog />);
    const dialog = document.querySelector('[data-testid="dialog"]')!;
    const buttons = [...dialog.querySelectorAll("button")] as HTMLButtonElement[];
    act(() => buttons[buttons.length - 1].focus());
    tab();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("Shift+Tab 从第一个元素折回最后一个", () => {
    render(<OpenDialog />);
    const dialog = document.querySelector('[data-testid="dialog"]')!;
    const buttons = [...dialog.querySelectorAll("button")] as HTMLButtonElement[];
    act(() => buttons[0].focus());
    tab(true);
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it("焦点在弹窗外时 Tab 拉回弹窗内", () => {
    render(<OpenDialog />);
    // 把焦点移出弹窗（body）再 Tab，应拉回弹窗第一个元素
    act(() => (document.body as unknown as HTMLElement).focus?.());
    tab();
    const first = document.querySelector('[data-testid="dialog"] button')!;
    expect(document.activeElement).toBe(first);
  });

  it("关闭后焦点归还触发元素", async () => {
    const { findByText } = render(<Page />);
    const opener = document.querySelector('[data-testid="opener"]') as HTMLButtonElement;
    act(() => {
      opener.focus();
      fireEvent.click(opener);
    });
    expect(document.querySelector('[data-testid="dialog"]')).toBeTruthy();
    const cancel = [...document.querySelectorAll('[data-testid="dialog"] button')].find(
      (b) => b.textContent === "取消"
    )!;
    act(() => fireEvent.click(cancel));
    await findByText("已关闭");
    expect(document.activeElement).toBe(opener);
  });

  it("open=false 时不拦截 Tab", () => {
    render(<Harness open={false} onClose={() => {}} />);
    const outerBtn = document.createElement("button");
    document.body.appendChild(outerBtn);
    outerBtn.focus();
    tab();
    // 没有陷阱拦截，焦点保持在外部按钮
    expect(document.activeElement).toBe(outerBtn);
  });

  it("空弹窗（无可聚焦元素）Tab 不抛错", () => {
    function Empty() {
      const trap = useFocusTrap(true);
      return <div ref={trap}>只有文字</div>;
    }
    render(<Empty />);
    expect(() => tab()).not.toThrow();
  });
});