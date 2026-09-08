/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OfflineBanner, useOnlineStatus } from "./OfflineBanner";

/**
 * 断网提示测试（R11）。
 *
 * 两个容易踩的点都在这里钉住：
 *  1) 初始值必须固定为 true —— 若首帧就去读 navigator.onLine，SSR 与客户端首次渲染
 *     结果不一致会触发 hydration 不匹配；
 *  2) 只信 `onLine === false`，属性缺失时不能误判为断网（否则老浏览器会一直挂着横幅）。
 */

/** 覆写 navigator.onLine（jsdom 里默认恒为 true） */
function setOnline(value: boolean | undefined) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

const fireNetworkEvent = (type: "online" | "offline") =>
  act(() => {
    window.dispatchEvent(new Event(type));
  });

beforeEach(() => {
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

/** 把 hook 结果暴露成文本，方便直接断言 */
function Probe() {
  const online = useOnlineStatus();
  return <span data-testid="v">{String(online)}</span>;
}

describe("useOnlineStatus", () => {
  it("在线时返回 true", () => {
    render(<Probe />);
    expect(screen.getByTestId("v").textContent).toBe("true");
  });

  it("挂载时若已断网，effect 同步出 false", () => {
    setOnline(false);
    render(<Probe />);
    expect(screen.getByTestId("v").textContent).toBe("false");
  });

  it("onLine 属性缺失时按在线处理，不误判", () => {
    setOnline(undefined);
    render(<Probe />);
    expect(screen.getByTestId("v").textContent).toBe("true");
  });

  it("offline 事件把状态切成 false", () => {
    render(<Probe />);
    setOnline(false);
    fireNetworkEvent("offline");
    expect(screen.getByTestId("v").textContent).toBe("false");
  });

  it("online 事件把状态切回 true", () => {
    setOnline(false);
    render(<Probe />);
    setOnline(true);
    fireNetworkEvent("online");
    expect(screen.getByTestId("v").textContent).toBe("true");
  });

  it("状态以 navigator.onLine 为准，不只看事件类型", () => {
    render(<Probe />);
    // 事件说恢复了但属性仍是断网：应当继续显示断网
    setOnline(false);
    fireNetworkEvent("online");
    expect(screen.getByTestId("v").textContent).toBe("false");
  });

  it("卸载后事件监听被解绑，不再更新状态", () => {
    const { unmount } = render(<Probe />);
    unmount();
    setOnline(false);
    expect(() => fireNetworkEvent("offline")).not.toThrow();
  });

  it("反复切换网络状态都能跟上", () => {
    render(<Probe />);
    for (const offline of [true, false, true, false]) {
      setOnline(!offline);
      fireNetworkEvent(offline ? "offline" : "online");
      expect(screen.getByTestId("v").textContent).toBe(String(!offline));
    }
  });
});

describe("OfflineBanner", () => {
  it("在线时不渲染任何东西", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("断网时渲染提示条并说明后果", () => {
    setOnline(false);
    render(<OfflineBanner />);
    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain("网络已断开");
    expect(banner.textContent).toContain("恢复连接后可重试");
  });

  it("提示条用 aria-live 让读屏软件播报", () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });

  it("恢复网络后提示条消失", () => {
    setOnline(false);
    const { container } = render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeTruthy();
    setOnline(true);
    fireNetworkEvent("online");
    expect(container.firstChild).toBeNull();
  });

  it("断网后提示条出现", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
    setOnline(false);
    fireNetworkEvent("offline");
    expect(screen.getByRole("status")).toBeTruthy();
  });
});