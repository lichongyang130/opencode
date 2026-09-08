/**
 * 路由级骨架屏（纯静态，供各段 loading.tsx 复用）。
 * 不引 ShellSidebar 等客户端组件，避免为一屏占位把 store 打进首包。
 */
export function PageSkeleton({
  title,
  rows = 6,
  variant = "list",
}: {
  title?: string;
  rows?: number;
  variant?: "list" | "grid";
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4]" aria-busy="true" aria-live="polite">
      {/* 折叠态侧边栏占位，宽度对齐 ShellSidebar 的 48px，避免加载完成时布局抖动 */}
      <div className="hidden w-[48px] shrink-0 flex-col items-center gap-3 border-r border-[#efe9dd] bg-white py-3 sm:flex">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[26px] w-[26px] animate-pulse rounded-lg bg-stone-100" />
        ))}
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-[#f0eadf] px-5 py-4 md:px-6">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-stone-100" />
          <div className="min-w-0 flex-1">
            {title ? (
              <div className="text-[18px] font-semibold text-stone-300">{title}</div>
            ) : (
              <div className="h-[18px] w-40 animate-pulse rounded bg-stone-100" />
            )}
            <div className="mt-2 h-3 w-56 animate-pulse rounded bg-stone-100" />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden p-4 md:p-6">
          <div
            className={
              variant === "grid"
                ? "mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "mx-auto flex w-full max-w-5xl flex-col gap-3"
            }
          >
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                className={
                  variant === "grid"
                    ? "h-32 animate-pulse rounded-2xl border border-stone-200/70 bg-white"
                    : "h-16 animate-pulse rounded-xl border border-stone-200/70 bg-white"
                }
              />
            ))}
          </div>
        </div>
      </main>

      <span className="sr-only">加载中</span>
    </div>
  );
}

/** 居中转圈：适合首页 / 分享页这类无固定骨架的整页 */
export function CenteredSpinner({ label = "加载中" }: { label?: string }) {
  return (
    <div
      className="flex h-screen items-center justify-center bg-[#fbf8f4]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-stone-200 border-t-brand-600" />
        <span className="text-xs text-stone-400">{label}</span>
      </div>
    </div>
  );
}