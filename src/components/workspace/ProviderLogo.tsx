"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** 各模型供应商官网公开图标 / favicon（浏览器端加载，真正来自官网） */
const OFFICIAL_ICON: Record<string, string> = {
  openai: "https://openai.com/favicon.ico",
  anthropic: "https://www.anthropic.com/favicon.ico",
  deepseek: "https://www.deepseek.com/favicon.ico",
  dashscope: "https://dashscope.aliyun.com/favicon.ico",
};

/**
 * 供应商 logo（优先官网图标，失败回退到本地品牌色 SVG）。
 */
export function ProviderLogo({ provider, className }: { provider: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const official = OFFICIAL_ICON[provider];

  if (official && !failed) {
    return (
      <span
        className={cn(
          "flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm",
          className
        )}
      >
        <Image
          src={official}
          alt=""
          width={18}
          height={18}
          unoptimized
          onError={() => setFailed(true)}
          className="h-[18px] w-[18px] object-contain"
        />
      </span>
    );
  }

  const tile =
    provider === "openai"
      ? "bg-gradient-to-br from-slate-700 to-slate-950"
      : provider === "anthropic"
        ? "bg-gradient-to-br from-orange-400 to-amber-500"
        : provider === "deepseek"
          ? "bg-gradient-to-br from-blue-500 to-indigo-600"
          : provider === "dashscope"
            ? "bg-gradient-to-br from-violet-500 to-purple-600"
            : "bg-gradient-to-br from-stone-300 to-stone-400";

  return (
    <span
      className={cn(
        "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
        tile,
        className
      )}
    >
      {provider === "openai" && <OpenAiLogo className="h-[15px] w-[15px]" />}
      {provider === "anthropic" && <ClaudeLogo className="h-[16px] w-[16px]" />}
      {provider === "deepseek" && <DeepSeekLogo className="h-[15px] w-[15px]" />}
      {provider === "dashscope" && <DashScopeLogo className="h-[15px] w-[15px]" />}
      {provider !== "openai" && provider !== "anthropic" && provider !== "deepseek" && provider !== "dashscope" && (
        <Sparkles className="h-3 w-3" />
      )}
    </span>
  );
}

function OpenAiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.073zM13.2599 22.4302a4.4855 4.4855 0 0 1-3.1756-1.3678l-.3703-.4001 2.681-1.5448a1.0016 1.0016 0 0 0 .5057-.8588v-7.5138l2.2383 1.2932v6.3703c0 .1965-.1047.3782-.2724.4783l-1.5365.8855a2.9236 2.9236 0 0 0 1.9298.658c1.6223 0 2.9424-1.3201 2.9424-2.9424a2.9294 2.9294 0 0 0-1.0002-2.2351l-.55-.5021a.9981.9981 0 0 1-.3276-.7595V6.5018l.8689.5015a4.4934 4.4934 0 0 1 1.6761 4.2688l-.0891.5327-2.681 1.5448a1.0016 1.0016 0 0 0-.5057.8588v7.5138a4.4956 4.4956 0 0 1-2.5813.7303zm-6.6069-3.398A4.4922 4.4922 0 0 1 4.9767 13.7626l.0891-.5327 2.681-1.5448a1.0016 1.0016 0 0 0 .5057-.8588V4.5328a4.4963 4.4963 0 0 1 2.5812-.7302 4.4855 4.4855 0 0 1 3.1757 1.3678l.3703.4001-2.681 1.5448a1.0022 1.0022 0 0 0-.5057.8589v7.5138a1.0119 1.0119 0 0 1-.2724.4783l-1.5365.8854a2.924 2.924 0 0 0 2.5812 1.8537 2.9352 2.9352 0 0 0 2.5236-1.4895l.4783-.8435a.9976.9976 0 0 1 .941-.5317h.9151l-.8689.5016a4.4934 4.4934 0 0 1-1.6761 4.2688l-.8689.5015a4.4956 4.4956 0 0 1-2.5812.7303zm-1.8437-9.9089a1.0018 1.0018 0 0 0-.941.5316l-.4784.8435a.9976.9976 0 0 1-.941.5317H2.0507l.8689-.5014a4.4922 4.4922 0 0 1 1.6761-4.2688l.8689-.5015A4.4963 4.4963 0 0 1 8.046 5.5189l1.5365-.8856a2.9256 2.9256 0 0 0-2.5812-1.8537A2.9352 2.9352 0 0 0 6.4776 4.269l-.4784.8437c-.21.3745-.6325.6104-1.0624.6104H4.0218l.8689-.5015a2.9238 2.9238 0 0 0 2.5812-1.8537 2.9381 2.9381 0 0 0-.3684-2.213h.0025zm.2526 6.8346v-7.5138a1.0014 1.0014 0 0 0-.5057-.8588l-1.5365-.8856A2.924 2.924 0 0 1 5.0006 5.5189l.4784-.8435a.9996.9996 0 0 1 .941-.5316h4.0624l-.8689.5015a4.4957 4.4957 0 0 1-1.6761 4.2688l-.8689.5016a4.4856 4.4856 0 0 1-.5501.8734l.3718.5054 2.681 1.5448a1.0016 1.0016 0 0 0 1.0556 0l.8689-.5016a.9976.9976 0 0 1 .941-.5317h1.2114l-1.9009 1.0963a1.0007 1.0007 0 0 1-1.0557 0l-1.9009-1.0963v1.5015a.999.999 0 0 1-.941-.5316z" />
    </svg>
  );
}

function ClaudeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c.6 3.2 2.5 5.1 5.7 5.7-3.2.6-5.1 2.5-5.7 5.7-.6-3.2-2.5-5.1-5.7-5.7C9.5 7.1 11.4 5.2 12 2zM18.4 12c.35 1.6 1.3 2.6 2.9 2.9-1.6.35-2.6 1.3-2.9 2.9-.35-1.6-1.3-2.6-2.9-2.9 1.6-.3 2.6-1.3 2.9-2.9zM5.2 12c.35 1.5 1.2 2.4 2.7 2.7-1.5.35-2.4 1.2-2.7 2.7-.35-1.5-1.2-2.4-2.7-2.7 1.5-.3 2.4-1.2 2.7-2.7zM12 14.5c.5 2.4 1.9 3.8 4.3 4.3-2.4.5-3.8 1.9-4.3 4.3-.5-2.4-1.9-3.8-4.3-4.3 2.4-.5 3.8-1.9 4.3-4.3z" />
    </svg>
  );
}

function DeepSeekLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4.2 15.2c-1.2 0-2.2-1-2.2-2.2 0-4.2 2.8-7.7 7-7.7 1.2 0 2.2 1 2.2 2.2 0 1.2-1 2.2-2.2 2.2-.6 0-1.2.5-1.2 1.2 0 .8.7 1.4 1.6 1.4 3.6 0 5.5 2 6 4.4a5.3 5.3 0 0 1-10.6 1.3l-.4-.9-.2.1zM18.6 6.2l-2-.6.5-1.4 2.1.6-.6 1.4z" />
    </svg>
  );
}

function DashScopeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
      <path d="M20.2 12a8.2 8.2 0 0 1-8.2 8.2A8.2 8.2 0 0 1 3.8 12 8.2 8.2 0 0 1 12 3.8c3.4 0 6.3 2 7.5 4.9" strokeLinecap="round" />
    </svg>
  );
}
