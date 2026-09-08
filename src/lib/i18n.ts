"use client";

/**
 * 轻量 i18n：中文 / 英文双语。
 * - 语言选择持久化在 localStorage（oc:lang.v1），切换时广播 "oc:lang-changed"
 * - 组件里用 useLang() 拿到当前语言并自动重渲染，t(key, lang) 取文案
 * - 新页面接入方式：在 DICT 里加 key，组件里 t("key", lang)
 * - 未登记的 key 会原样返回（中文文案直接写在 key 里也可以）
 */

import { useCallback, useEffect, useState } from "react";
import { readRaw, writeRaw } from "@/lib/safe-storage";

export type Lang = "zh" | "en";

const LANG_KEY = "oc:lang.v1";
export const LANG_CHANGE_EVENT = "oc:lang-changed";

export function getLang(): Lang {
  return readRaw(LANG_KEY) === "en" ? "en" : "zh";
}

export function setLang(lang: Lang): void {
  writeRaw(LANG_KEY, lang);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  }
  window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT));
}

/** 组件内使用：返回当前语言与切换函数 */
export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    setLangState(getLang());
    const onChange = () => setLangState(getLang());
    window.addEventListener(LANG_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LANG_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const switchLang = useCallback((next: Lang) => setLang(next), []);
  return [lang, switchLang];
}

/** 文案字典：key 建议用语义 id，中文文案写在 zh 分支 */
const DICT: Record<string, { zh: string; en: string }> = {
  // 导航
  "nav.home": { zh: "首页", en: "Home" },
  "nav.chat": { zh: "AI 对话", en: "AI Chat" },
  "nav.agents": { zh: "智能体", en: "Agents" },
  "nav.knowledge": { zh: "知识库", en: "Knowledge" },
  "nav.docs": { zh: "文档中心", en: "Documents" },
  "nav.templates": { zh: "模板中心", en: "Templates" },
  "nav.tools": { zh: "工具箱", en: "Toolbox" },
  "nav.apps": { zh: "更多应用", en: "More Apps" },
  "nav.membership": { zh: "会员中心", en: "Membership" },
  "nav.settings": { zh: "设置", en: "Settings" },
  // 侧栏
  "sidebar.recent": { zh: "最近对话", en: "Recent Chats" },
  "sidebar.searchChat": { zh: "搜索对话", en: "Search chats" },
  "sidebar.viewAll": { zh: "查看全部历史记录", en: "View all history" },
  "sidebar.noHistory": { zh: "暂无历史对话", en: "No chats yet" },
  "sidebar.noMatch": { zh: "没有匹配的对话", en: "No matching chats" },
  "sidebar.unpinAll": { zh: "取消全部置顶", en: "Unpin all" },
  "sidebar.searchAll": { zh: "搜索…", en: "Search…" },
  "sidebar.theme.dark": { zh: "暗色模式", en: "Dark mode" },
  "sidebar.theme.light": { zh: "亮色模式", en: "Light mode" },
  "sidebar.toLight": { zh: "切换到亮色模式", en: "Switch to light mode" },
  "sidebar.toDark": { zh: "切换到暗色模式", en: "Switch to dark mode" },
  "sidebar.settingsHint": { zh: "模型 / 备份", en: "Models / Backup" },
  // 通用
  "common.today": { zh: "今天", en: "Today" },
  "common.yesterday": { zh: "昨天", en: "Yesterday" },
  "common.earlier": { zh: "更早", en: "Earlier" },
  "common.pin": { zh: "置顶", en: "Pin" },
  "common.unpin": { zh: "取消置顶", en: "Unpin" },
  "common.language": { zh: "语言 / Language", en: "Language / 语言" },
  // 通用操作
  "common.confirm": { zh: "确定", en: "Confirm" },
  "common.cancel": { zh: "取消", en: "Cancel" },
  "common.save": { zh: "保存", en: "Save" },
  "common.delete": { zh: "删除", en: "Delete" },
  "common.edit": { zh: "编辑", en: "Edit" },
  "common.copy": { zh: "复制", en: "Copy" },
  "common.close": { zh: "关闭", en: "Close" },
  "common.retry": { zh: "重试", en: "Retry" },
  "common.export": { zh: "导出", en: "Export" },
  "common.import": { zh: "导入", en: "Import" },
  "common.search": { zh: "搜索", en: "Search" },
  "common.rename": { zh: "重命名", en: "Rename" },
  "common.archive": { zh: "归档", en: "Archive" },
  "common.unarchive": { zh: "取消归档", en: "Unarchive" },
  "common.favorite": { zh: "收藏", en: "Favorite" },
  "common.unfavorite": { zh: "取消收藏", en: "Unfavorite" },
  "common.download": { zh: "下载", en: "Download" },
  "common.share": { zh: "分享", en: "Share" },
  "common.more": { zh: "更多", en: "More" },
  "common.back": { zh: "返回", en: "Back" },
  // 通用状态
  "state.loading": { zh: "加载中…", en: "Loading…" },
  "state.generating": { zh: "生成中…", en: "Generating…" },
  "state.empty": { zh: "暂无内容", en: "Nothing here yet" },
  "state.error": { zh: "出错了，请重试", en: "Something went wrong, please retry" },
  "state.success": { zh: "操作成功", en: "Done" },
  "state.stopped": { zh: "已停止生成", en: "Generation stopped" },
  // 工作台模式
  "mode.chat": { zh: "智能对话", en: "Chat" },
  "mode.research": { zh: "深度研究", en: "Deep Research" },
  "mode.slides": { zh: "PPT 生成", en: "Slides" },
  "mode.image": { zh: "图像创作", en: "Image" },
  "mode.video": { zh: "视频创作", en: "Video" },
  "mode.docs": { zh: "文档写作", en: "Documents" },
};

export function t(key: string, lang: Lang): string {
  const entry = DICT[key];
  if (!entry) {
    // 未登记的 key 原样返回（中文文案直写也能用）；开发期给出提示便于逐步收敛
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] 未登记的文案 key：${key}`);
    }
    return key;
  }
  return entry[lang];
}
