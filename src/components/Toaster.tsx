"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

const ICON = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-brand-500" />,
};

export function Toaster() {
  const { toasts } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm shadow-lg",
            "animate-[fadeUp_.2s_ease-out]"
          )}
        >
          {ICON[t.kind]}
          <span className="text-stone-700">{t.message}</span>
        </div>
      ))}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
