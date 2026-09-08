"use client";

import { useEffect } from "react";

/**
 * 根布局级崩溃兜底：error.tsx 无法捕获 layout 自身的异常，
 * 这里必须自带 html/body（此时 RootLayout 已经不可用）。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 32,
          textAlign: "center",
          background: "#fafaf9",
          color: "#1c1917",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        }}
      >
        {/* 内联样式而非 Tailwind：全局崩溃时样式表可能未成功加载 */}
        <div style={{ fontSize: 44 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>应用启动失败</h1>
        <p style={{ maxWidth: 420, fontSize: 13, color: "#78716c", margin: 0 }}>
          {error.message || "发生未知错误"}
          {error.digest ? `（${error.digest}）` : ""}
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={reset}
            style={{
              border: "none",
              borderRadius: 8,
              background: "#c05f3c",
              color: "#fff",
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            重试
          </button>
          <a
            href="/"
            style={{
              borderRadius: 8,
              border: "1px solid #e7e5e4",
              background: "#fff",
              color: "#44403c",
              padding: "9px 16px",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            返回首页
          </a>
        </div>
      </body>
    </html>
  );
}