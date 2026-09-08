"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { encodeCaseShare } from "@/lib/case-share";
import type { CaseShareRecord } from "@/lib/db/repo";

export default function SharePage() {
  const { code } = useParams<{ code: string }>();
  const [rec, setRec] = useState<CaseShareRecord | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/cases/share/${code}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "加载失败");
        setRec((await r.json()) as CaseShareRecord);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  }, [code]);

  if (err)
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-stone-500">
        {err}
      </main>
    );
  if (!rec)
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-400">
        加载中…
      </main>
    );

  const shareCode = encodeCaseShare({ templateId: rec.templateId, label: rec.label, values: rec.values });

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-1 text-xs text-stone-400">真实案例分享 · {rec.source ?? ""}</p>
          <h1 className="text-lg font-bold text-stone-800">{rec.label || "提示词案例"}</h1>
        </div>

        {rec.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rec.image} alt={rec.label} className="w-full rounded-2xl shadow-sm" />
        ) : (
          <div className="rounded-2xl bg-stone-900 p-5">
            <p className="mb-2 text-xs text-stone-400">真实输出（节选）</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-100">{rec.output}</p>
          </div>
        )}

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-medium text-stone-400">对应的真实提示词</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{rec.prompt}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-stone-700">做同款</p>
          <p className="mb-3 text-xs text-stone-500">
            复制下面的「做同款码」，在 OpenCanvas 提示词库点「导入」粘贴，即可把这套参数填入输入框（不自动发送）。
          </p>
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-600">{shareCode}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(shareCode).then(
                  () => setCopied(true),
                  () => setCopied(false)
                );
              }}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {copied ? "已复制" : "复制做同款码"}
            </button>
          </div>
          <a href="/" className="mt-3 inline-block text-xs text-brand-600 hover:underline">
            打开 OpenCanvas →
          </a>
        </div>
      </div>
    </main>
  );
}
