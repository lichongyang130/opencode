import { readRaw, writeRaw } from "./safe-storage";

/**
 * 主题三态（THEME1）：light / dark / system。
 * storage key 与 layout.tsx 首屏内联脚本约定为同一个 "oc:theme.v1"，
 * 首屏脚本只在值为 "dark"（或无值且系统偏好深色）时挂 .dark 类，
 * 因此这里落盘的值必须只写 "light" | "dark" | "system"，保持口径一致。
 */
export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "oc:theme.v1";

/** 读取用户偏好；无记录时按「跟随系统」处理 */
export function readThemeMode(): ThemeMode {
  const saved = readRaw(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "system";
}

/** 系统当前是否偏好深色（matchMedia 不可用时按浅色兜底） */
export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** 偏好解析为实际渲染态：system 态跟随系统 */
export function resolveDark(mode: ThemeMode): boolean {
  return mode === "dark" || (mode === "system" && systemPrefersDark());
}

/**
 * 应用主题到 <html>：挂/摘 .dark 类（globals.css 的整站暗色覆盖都挂在这个类上）。
 * 返回最终生效的深色布尔值，方便调用方同步 UI 图标。
 */
export function applyTheme(mode: ThemeMode): boolean {
  const dark = resolveDark(mode);
  try {
    document.documentElement.classList.toggle("dark", dark);
  } catch {
    /* SSR / 测试环境下无 document，静默跳过（首屏脚本已兜底） */
  }
  return dark;
}

/** 偏好落盘并应用；返回最终生效的深色布尔值 */
export function setThemeMode(mode: ThemeMode): boolean {
  writeRaw(THEME_STORAGE_KEY, mode);
  return applyTheme(mode);
}

/** 挂载时初始化：读偏好、应用，并订阅系统偏好变化（system 态下实时跟随） */
export function initTheme(onChange?: (dark: boolean) => void): () => void {
  const dark = applyTheme(readThemeMode());
  onChange?.(dark);
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      // 仅 system 态需要跟随系统；显式选择的 light/dark 不被系统变化覆盖
      if (readThemeMode() === "system") onChange?.(applyTheme("system"));
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  } catch {
    return () => {};
  }
}