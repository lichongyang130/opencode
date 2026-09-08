/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

/**
 * 确认弹窗测试（R16）。
 *
 * 替掉 window.confirm 的意义在于三点：可断言、样式可控、不阻塞主线程。
 * 这里重点钉可访问性契约（alertdialog + 标题/正文关联 + 自动聚焦）与
 * 三条关闭路径（确定 / 取消 / Esc / 点遮罩），漏掉任一条都会让用户被弹窗困住。
 */

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ConfirmDialog
      open
      title="清空本机数据"
      message="该操作不可撤销。"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />
  );
  return { onConfirm, onCancel, ...utils };
}

describe("开关", () => {
  it("open 为 false 时什么都不渲染", () => {
    render(
      <ConfirmDialog
        open={false}
        title="T"
        message="M"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("open 为 true 时渲染弹窗", () => {
    setup();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("从关到开时才聚焦确认按钮", () => {
    const { rerender } = render(
      <ConfirmDialog open={false} title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    rerender(
      <ConfirmDialog open title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "确定" }));
  });
});

describe("内容与可访问性", () => {
  it("用 alertdialog 角色并声明模态", () => {
    setup();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("标题与正文通过 aria 关联到弹窗", () => {
    setup();
    const dialog = screen.getByRole("alertdialog");
    const titleId = dialog.getAttribute("aria-labelledby");
    const descId = dialog.getAttribute("aria-describedby");
    expect(document.getElementById(titleId!)?.textContent).toBe("清空本机数据");
    expect(document.getElementById(descId!)?.textContent).toBe("该操作不可撤销。");
  });

  it("打开后自动聚焦确认按钮（键盘用户可直接回车）", () => {
    setup();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "确定" }));
  });

  it("默认按钮文案是确定 / 取消", () => {
    setup();
    expect(screen.getByRole("button", { name: "确定" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "取消" })).toBeTruthy();
  });

  it("按钮文案可自定义", () => {
    setup({ confirmText: "全部删除", cancelText: "先留着" });
    expect(screen.getByRole("button", { name: "全部删除" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "先留着" })).toBeTruthy();
  });

  it("多行 message 按原样保留换行", () => {
    setup({ message: "第一行\n第二行" });
    const desc = screen.getByText(/第一行/);
    expect(desc.className).toContain("whitespace-pre-line");
    expect(desc.textContent).toBe("第一行\n第二行");
  });
});

describe("危险操作样式", () => {
  it("danger 时显示警示图标", () => {
    const { container } = setup({ tone: "danger" });
    expect(container.querySelector(".bg-red-50")).toBeTruthy();
  });

  it("danger 时确认按钮用红色", () => {
    setup({ tone: "danger" });
    expect(screen.getByRole("button", { name: "确定" }).className).toContain("bg-red-500");
  });

  it("normal 时不显示警示图标，确认按钮用品牌色", () => {
    const { container } = setup({ tone: "normal" });
    expect(container.querySelector(".bg-red-50")).toBeNull();
    expect(screen.getByRole("button", { name: "确定" }).className).toContain("bg-brand-600");
  });

  it("不传 tone 时按 normal 处理", () => {
    setup();
    expect(screen.getByRole("button", { name: "确定" }).className).toContain("bg-brand-600");
  });
});

describe("关闭路径", () => {
  it("点确定触发 onConfirm，不触发 onCancel", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("点取消触发 onCancel", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("点遮罩视为取消", () => {
    const { onCancel, container } = setup();
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("点弹窗内部不会误触取消", () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole("alertdialog"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("Esc 触发取消（绑在 document 上，不依赖焦点位置）", () => {
    const { onCancel } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("其他按键不触发关闭", () => {
    const { onCancel, onConfirm } = setup();
    for (const key of ["Enter", "Tab", "a", "ArrowDown"]) {
      fireEvent.keyDown(document, { key });
    }
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("关闭后 Esc 监听被解绑，不再回调", () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmDialog open title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />
    );
    rerender(
      <ConfirmDialog open={false} title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("卸载后不再响应 Esc（避免监听泄漏）", () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <ConfirmDialog open title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />
    );
    unmount();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});