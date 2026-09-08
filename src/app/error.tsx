"use client";

import { useEffect } from "react";

/** 路由段级错误边界（layout 自身崩溃由 global-error.tsx 兜底） */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 p-8 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-xl font-semibold">页面出现了一点问题</h1>
      <p className="max-w-md text-sm text-stone-500">
        {error.message || "发生未知错误"}，可以重试，或返回工作台。
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          重试
        </button>
        <a
          href="/chat"
          className="rounded-lg border border-stone-200 px-4 py-2 text-sm hover:bg-white"
        >
          返回工作台
        </a>
      </div>
    </div>
  );
}
