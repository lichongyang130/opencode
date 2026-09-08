/**
 * 全局测试准备。
 *
 * 同一份 setup 会在 node 与 jsdom 两种环境下都执行，因此所有 DOM 相关补丁
 * 都要先判断 window 是否存在。
 */
import { afterEach, vi } from "vitest";

// 功能测试不该被限流干扰：统一关闭，限流本身交给 rate-limit.test.ts 单测
process.env.OC_RATE_LIMIT_DISABLED = "1";

if (typeof window !== "undefined") {
  // jsdom 没有实现布局，Element.scrollTo / scrollIntoView 缺失会让组件里的
  // 「滚到底部」逻辑直接抛错。补成 no-op，测试只关心不崩、不关心真实滚动。
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = function scrollTo() {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
  }

  // navigator.clipboard 在 jsdom 里不存在；组件用可选链调用，
  // 这里给一个可断言的实现，便于校验“复制”按钮。
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.resolve()) },
    });
  }

  // ResizeObserver / matchMedia 是组件库常用但 jsdom 未实现的能力
  if (!("ResizeObserver" in window)) {
    (window as unknown as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
}

// 用例之间清掉 localStorage，避免设置项（模型覆盖、会员态）互相串味
afterEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});

// testing-library 的自动清理只在检测到全局 afterEach 时注册（即 vitest globals: true）。
// 本项目用显式 import 风格，因此手动挂一次；否则多次 render 会叠加到同一个 body，
// 让 getByRole 之类的单一匹配查询报「找到多个元素」。
if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
