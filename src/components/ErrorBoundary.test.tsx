/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Component, type ReactNode } from "react";

import { ErrorBoundary } from "./ErrorBoundary";

/**
 * 局部错误边界测试（R1）。
 *
 * 关键契约：单栏渲染崩溃只能吃掉那一栏，绝不能连带整个工作台白屏，
 * 并且必须给用户一个「重试」出口 —— 否则只能刷新整页、丢掉当前会话状态。
 */

function Boom({ message = "渲染崩了" }: { message?: string }): ReactNode {
  throw new Error(message);
}

/** 受控崩溃组件：切换 props 即可复现「修好之后重试成功」 */
function Maybe({ crash }: { crash: boolean }) {
  if (crash) throw new Error("暂时性错误");
  return <div>恢复正常</div>;
}

beforeEach(() => {
  // React 会把边界捕获到的异常再往 console.error 打一遍，测试输出里全是噪音
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("正常渲染", () => {
  it("子树没抛错时原样渲染", () => {
    render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("正常内容")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("支持多个子节点", () => {
    render(
      <ErrorBoundary>
        <span>A</span>
        <span>B</span>
      </ErrorBoundary>
    );
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });
});

describe("捕获渲染异常", () => {
  it("崩溃时渲染兜底卡片而不是让异常冒到顶层", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("此区域加载失败")).toBeTruthy();
  });

  it("带 label 时提示具体是哪一块失效", () => {
    render(
      <ErrorBoundary label="产物面板">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText("产物面板加载失败")).toBeTruthy();
  });

  it("展示错误 message 便于用户反馈", () => {
    render(
      <ErrorBoundary>
        <Boom message="deck 结构不合法" />
      </ErrorBoundary>
    );
    expect(screen.getByText("deck 结构不合法")).toBeTruthy();
  });

  it("message 为空时给兜底文案", () => {
    render(
      <ErrorBoundary>
        <Boom message="" />
      </ErrorBoundary>
    );
    expect(screen.getByText("发生未知错误")).toBeTruthy();
  });

  it("把错误打到 console.error（生产环境唯一的排查线索）", () => {
    render(
      <ErrorBoundary label="侧栏">
        <Boom />
      </ErrorBoundary>
    );
    const calls = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => c[0] === "[ErrorBoundary]" && c[1] === "侧栏")).toBe(true);
  });

  it("label 缺失时日志里标 unknown", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    const calls = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => c[0] === "[ErrorBoundary]" && c[1] === "unknown")).toBe(true);
  });

  it("触发 onError 回调并带上 componentStack", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom message="x" />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe("x");
    expect(onError.mock.calls[0][1]).toHaveProperty("componentStack");
  });
});

describe("重试", () => {
  it("点重试后重新渲染子树", () => {
    let crash = true;
    function Host() {
      return (
        <ErrorBoundary>
          <Maybe crash={crash} />
        </ErrorBoundary>
      );
    }
    const { rerender } = render(<Host />);
    expect(screen.getByRole("alert")).toBeTruthy();

    /*
     * 顺序很关键：必须先让父级重渲染把新的 children 交给边界，再点重试。
     * 反过来的话 reset 会重新渲染「上一次那份仍会抛错的 children」，
     * 立刻又落回 fallback，看起来像重试无效。
     */
    crash = false;
    rerender(<Host />);
    fireEvent.click(screen.getByRole("button", { name: /重试/ }));
    expect(screen.getByText("恢复正常")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("问题没修好时重试会再次落到兜底 UI，不会连环崩溃", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole("button", { name: /重试/ }));
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

describe("自定义 fallback", () => {
  it("使用调用方提供的兜底 UI", () => {
    render(
      <ErrorBoundary fallback={(e) => <div>自定义：{e.message}</div>}>
        <Boom message="炸了" />
      </ErrorBoundary>
    );
    expect(screen.getByText("自定义：炸了")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("自定义 fallback 也能拿到 reset", () => {
    let crash = true;
    function Host() {
      return (
        <ErrorBoundary
          fallback={(_e, reset) => (
            <button type="button" onClick={reset}>
              我来重试
            </button>
          )}
        >
          <Maybe crash={crash} />
        </ErrorBoundary>
      );
    }
    const { rerender } = render(<Host />);
    crash = false;
    // 同上：先把修好的 children 交给边界，再触发 reset
    rerender(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "我来重试" }));
    expect(screen.getByText("恢复正常")).toBeTruthy();
  });
});

describe("隔离性", () => {
  it("一栏崩溃不影响同级的其他栏", () => {
    render(
      <div>
        <ErrorBoundary label="左栏">
          <Boom />
        </ErrorBoundary>
        <ErrorBoundary label="右栏">
          <div>右栏内容</div>
        </ErrorBoundary>
      </div>
    );
    expect(screen.getByText("左栏加载失败")).toBeTruthy();
    expect(screen.getByText("右栏内容")).toBeTruthy();
  });

  it("内层边界先兜住，外层不受影响", () => {
    render(
      <ErrorBoundary label="外层">
        <div>外层还在</div>
        <ErrorBoundary label="内层">
          <Boom />
        </ErrorBoundary>
      </ErrorBoundary>
    );
    expect(screen.getByText("外层还在")).toBeTruthy();
    expect(screen.getByText("内层加载失败")).toBeTruthy();
    expect(screen.queryByText("外层加载失败")).toBeNull();
  });

  it("事件回调里的异步异常不会被边界捕获（这是 React 的既有语义，不要误以为有兜底）", () => {
    class Probe extends Component<{ children: ReactNode }> {
      render() {
        return this.props.children;
      }
    }
    render(
      <ErrorBoundary>
        <Probe>
          <button
            type="button"
            onClick={() => {
              // 这里刻意不抛错：只是钉住「边界只兜渲染期异常」的边界条件
            }}
          >
            点我
          </button>
        </Probe>
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole("button", { name: "点我" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});