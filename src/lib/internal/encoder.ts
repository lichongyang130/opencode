/** 共享的 TextEncoder 单例：SSE 帧编码等高频路径避免每次新建（AI14 抽协议时一并收敛） */
export const encoder = new TextEncoder();