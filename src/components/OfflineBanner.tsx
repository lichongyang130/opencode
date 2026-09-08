"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * 断网状态订阅。
 *
 * 只信 `navigator.onLine === false`：该属性为 true 时仅代表有网卡连接，
 * 不保证真的能连通外网，所以不拿它做"在线"的正面判断，只用来捕捉明确的断网。
 */
export function useOnlineStatus(): boolean {
  // 初始值固定为 true：SSR 与首次客户端渲染必须一致，否则会触发 hydration 不匹配
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine !== false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

/** 断网时出现在顶栏下方的提示条（R11） */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700"
    >
      <WifiOff className="h-3.5 w-3.5" />
      网络已断开，AI 生成会失败；恢复连接后可重试
    </div>
  );
}