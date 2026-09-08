/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  initTheme,
  readThemeMode,
  resolveDark,
  setThemeMode,
  THEME_STORAGE_KEY,
} from "./theme";

/**
 * THEME1/THEME2: 三态主题模块。
 * 关键约束：storage key 与 layout.tsx 首屏内联脚本共用 "oc:theme.v1"，
 * 落盘值只能是 light/dark/system 三者之一，否则首屏脚本会误判。
 */

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readThemeMode", () => {
  it("无记录时回退 system", () => {
    expect(readThemeMode()).toBe("system");
  });

  it("落盘值 light/dark/system 原样读回", () => {
    for (const v of ["light", "dark", "system"] as const) {
      localStorage.setItem(THEME_STORAGE_KEY, v);
      expect(readThemeMode()).toBe(v);
    }
  });

  it("脏值（旧格式/人为篡改）回退 system 而不是抛错", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "DARK");
    expect(readThemeMode()).toBe("system");
  });
});

describe("resolveDark", () => {
  it("dark 恒深色、light 恒浅色，不看系统", () => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    Object.defineProperty(mq, "matches", { value: true });
    expect(resolveDark("dark")).toBe(true);
    expect(resolveDark("light")).toBe(false);
  });

  it("system 跟随 matchMedia；matchMedia 不可用时按浅色兜底", () => {
    expect(resolveDark("system")).toBe(window.matchMedia("(prefers-color-scheme: dark)").matches);
    const spy = vi.spyOn(window, "matchMedia").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(resolveDark("system")).toBe(false);
    spy.mockRestore();
  });
});

describe("applyTheme / setThemeMode", () => {
  it("applyTheme 挂/摘 html.dark 类并返回生效态", () => {
    expect(applyTheme("dark")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(applyTheme("light")).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setThemeMode 落盘的值与首屏脚本约定一致", () => {
    setThemeMode("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    setThemeMode("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("applyTheme 在无 document 环境静默跳过（SSR 安全）", () => {
    const spy = vi.spyOn(document, "documentElement", "get").mockImplementation(() => {
      throw new Error("no document");
    });
    // 不抛错即通过；返回值按解析结果
    expect(() => applyTheme("dark")).not.toThrow();
    spy.mockRestore();
  });
});

describe("initTheme", () => {
  it("挂载时按已存偏好应用并回调一次", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const cb = vi.fn();
    const dispose = initTheme(cb);
    expect(cb).toHaveBeenCalledWith(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    dispose();
  });

  it("system 态下系统偏好变化实时跟随，显式态不被覆盖", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    // 先 mock matchMedia 再 initTheme —— 监听器要注册进 mock 才能手动触发
    const listeners: ((e: unknown) => void)[] = [];
    const spy = vi.spyOn(window, "matchMedia").mockImplementation((q: string) => {
      if (q === "(prefers-color-scheme: dark)") {
        return {
          matches: false,
          addEventListener: (_: string, fn: (e: unknown) => void) => listeners.push(fn),
          removeEventListener: () => {},
        } as unknown as MediaQueryList;
      }
      return window.matchMedia(q);
    });

    const cb = vi.fn();
    const dispose = initTheme(cb);
    cb.mockClear();

    listeners.forEach((fn) => fn({ matches: true }));
    expect(cb).toHaveBeenCalled();

    // 显式 light 态：同样的事件不再回调（不被系统覆盖）
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    cb.mockClear();
    listeners.forEach((fn) => fn({ matches: true }));
    expect(cb).not.toHaveBeenCalled();

    dispose();
    spy.mockRestore();
  });
});