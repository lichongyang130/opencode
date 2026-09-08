import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenCanvas AI — 一站式 AI 智能体工作空间",
  description:
    "对话、深度研究、PPT、图片、视频、文档，一个工作空间全部完成。聚合国内外主流大模型。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 首屏渲染前应用主题，避免暗色用户看到白屏闪烁。
            THEME2: 与 lib/theme.ts 共用 key "oc:theme.v1"；
            "dark" 强制深色，"light" 强制浅色，"system"/无记录 跟随系统偏好 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("oc:theme.v1");if(t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
