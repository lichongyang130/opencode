"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** 区域名，出错时展示给用户，便于判断是哪一块失效而非整页崩溃 */
  label?: string;
  /** 自定义兜底 UI，不传则用内置卡片 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * 局部错误边界：只兜渲染期异常（事件回调与异步错误不会冒到这里）。
 * 分区包裹后单栏崩溃不会连带整个工作台白屏。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 生产环境 React 不再自动打印，这里是排查现场的唯一线索
    console.error("[ErrorBoundary]", this.props.label ?? "unknown", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    const { label } = this.props;
    return (
      <div
        role="alert"
        className="flex h-full min-h-[180px] min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <AlertTriangle className="h-7 w-7 text-orange-500" />
        <div className="text-sm font-medium text-stone-700">
          {label ? `${label}加载失败` : "此区域加载失败"}
        </div>
        <p className="max-w-sm break-words text-xs text-stone-500">
          {error.message || "发生未知错误"}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-800"
        >
          <RotateCcw className="h-3.5 w-3.5" /> 重试
        </button>
      </div>
    );
  }
}