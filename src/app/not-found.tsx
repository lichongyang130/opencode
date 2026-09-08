import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 p-8 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="text-xl font-semibold text-stone-800">页面不存在</h1>
      <p className="max-w-md text-sm text-stone-500">
        链接可能已失效或被移动，可以回到工作台继续。
      </p>
      <div className="flex gap-3">
        <Link
          href="/chat"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          返回工作台
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 transition hover:border-stone-300"
        >
          回到首页
        </Link>
      </div>
    </div>
  );
}