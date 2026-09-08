"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellDot,
  Calendar,
  CalendarRange,
  ClipboardList,
  FileText,
  Grid3x3,
  LayoutGrid,
  ListChecks,
  Mail,
  MessageSquare,
  Package,
  PenLine,
  PieChart,
  Plus,
  RefreshCw,
  Send,
  X,
  Sparkles,
  Target,
  Timer,
  Video,
  Waypoints,
} from "lucide-react";
import { ShellSidebar } from "@/components/mockup/ShellSidebar";
import { useChatStore } from "@/lib/store/chat";
import type { WorkspaceMode } from "@/lib/store/chat";
import { toast } from "@/lib/store/toast";
import { Toaster } from "@/components/Toaster";
import { addDocument } from "@/lib/documents";
import { AppLauncherMenu, NotificationBell } from "@/components/shell/TopBarMenus";
import { readJSON, writeJSON } from "@/lib/safe-storage";

interface App {
  name: string;
  desc: string;
  icon: any;
  tint: string;
  bg: string;
  mode: WorkspaceMode;
  prompt: string;
  /** 纯占位应用：AI 无法模拟独立客户端体验，点击引导提交需求 */
  soon?: boolean;
}

const EFFICIENCY: App[] = [
  { name: "日程管理", desc: "管理安排每日计划议程", icon: Calendar, tint: "text-blue-600", bg: "bg-blue-50", mode: "docs", prompt: "帮我制定一份今天的日程计划，包含上午、下午、晚上各 3 个重点事项，并给出优先级和时间分配。" },
  { name: "任务管理", desc: "创建提醒任务和处理任务", icon: ListChecks, tint: "text-emerald-600", bg: "bg-emerald-50", mode: "chat", prompt: "帮我梳理本周待办任务清单，按紧急重要四象限分类，每项标注负责人和截止时间。" },
  { name: "笔记应用", desc: "快速记录想法和笔记", icon: PenLine, tint: "text-orange-600", bg: "bg-orange-50", mode: "docs", prompt: "帮我整理一份结构化笔记：今天的主要想法、灵感、待跟进事项，用简洁列表呈现。" },
  { name: "待办清单", desc: "管理个人待办事项", icon: ClipboardList, tint: "text-violet-600", bg: "bg-violet-50", mode: "chat", prompt: "为以下目标生成一份可执行的待办清单：把目标拆解为阶段，每项标注预计耗时和优先级，并指出关键路径。" },
  { name: "时间提醒", desc: "记录工作时间和提醒", icon: Timer, tint: "text-sky-600", bg: "bg-sky-50", mode: "chat", prompt: "帮我设计一套每日时间管理提醒方案：包含工作、休息、专注时段建议，以及如何避免拖延。" },
  { name: "文件同步", desc: "跨设备同步文件", icon: RefreshCw, tint: "text-amber-600", bg: "bg-amber-50", mode: "docs", soon: true, prompt: "" },
];

const COMMUNICATION: App[] = [
  { name: "即时通讯", desc: "团队内部即时聊天", icon: MessageSquare, tint: "text-blue-600", bg: "bg-blue-50", mode: "chat", soon: true, prompt: "" },
  { name: "视频会议", desc: "在线视频会议", icon: Video, tint: "text-violet-600", bg: "bg-violet-50", mode: "docs", soon: true, prompt: "" },
  { name: "邮件管理", desc: "管理邮件邮件附件", icon: Mail, tint: "text-red-500", bg: "bg-red-50", mode: "chat", prompt: "帮我写一封专业的商务邮件，主题为项目进展同步，包含背景、关键进展、下一步计划与请对方确认事项。" },
  { name: "公告通知", desc: "发布团队公告", icon: BellDot, tint: "text-orange-600", bg: "bg-orange-50", mode: "docs", prompt: "帮我写一份团队公告：关于新版本上线安排，包含上线时间、注意事项、支持渠道，语气正式清晰。" },
  { name: "投票调查", desc: "创建投票和调查", icon: PieChart, tint: "text-emerald-600", bg: "bg-emerald-50", mode: "chat", prompt: "帮我设计一份团队内部投票调查：包含投票主题、5 个选项、补充说明，并给出结果分析思路。" },
  { name: "反馈收集", desc: "收集用户反馈", icon: Mail, tint: "text-sky-600", bg: "bg-sky-50", mode: "docs", prompt: "帮我写一份用户反馈收集模板：包含反馈渠道、问题分类、严重程度、负责人与处理时限。" },
];

const PROJECT: App[] = [
  { name: "项目看板", desc: "可视化项目进度", icon: LayoutGrid, tint: "text-blue-600", bg: "bg-blue-50", mode: "docs", prompt: "帮我生成一个项目看板结构：按待办/进行中/已完成三列，列出当前项目的主要任务与负责人。" },
  { name: "甘特图", desc: "可视化项目管理", icon: CalendarRange, tint: "text-emerald-600", bg: "bg-emerald-50", mode: "docs", prompt: "帮我制定一个项目甘特图计划：包含阶段、起止时间、里程碑、依赖关系与关键路径。" },
  { name: "里程碑", desc: "设置项目里程碑", icon: Waypoints, tint: "text-orange-600", bg: "bg-orange-50", mode: "docs", prompt: "帮我规划一个项目里程碑清单：每个里程碑包含目标、交付物、验收标准与时间节点。" },
  { name: "资源管理", desc: "管理项目资源", icon: Package, tint: "text-violet-600", bg: "bg-violet-50", mode: "docs", prompt: "帮我制定一份项目资源管理表：包含人力、预算、工具、设备资源，以及分配与调度建议。" },
  { name: "风险管理", desc: "识别潜在项目风险", icon: Target, tint: "text-red-500", bg: "bg-red-50", mode: "docs", prompt: "帮我做一份项目风险管理清单：识别主要风险、影响程度、发生概率、应对措施与责任人。" },
  { name: "报告生成", desc: "生成项目报告", icon: FileText, tint: "text-sky-600", bg: "bg-sky-50", mode: "docs", prompt: "帮我写一份项目周报：本周完成、进行中、风险与需协调事项、下周计划。" },
];

const OTHER: App[] = [
  { name: "表单创建", desc: "创建在线表格", icon: ClipboardList, tint: "text-blue-600", bg: "bg-blue-50", mode: "chat", soon: true, prompt: "" },
  { name: "条码生成", desc: "生成条码", icon: Grid3x3, tint: "text-orange-600", bg: "bg-orange-50", mode: "chat", soon: true, prompt: "" },
];

export default function AppsPage() {
  const router = useRouter();
  const { runTemplate } = useChatStore();

  const launch = async (app: App) => {
    toast(`正在打开「${app.name}」…`, "info");
    await runTemplate({ mode: app.mode, prompt: app.prompt });
    router.push("/chat");
  };

  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const saved = readJSON<Array<{ name: string; use: string; ts: number }>>(
      "oc:app-requests.v1",
      []
    );
    if (Array.isArray(saved) && saved.length > 0) setRequests(saved);
  }, []);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestPreset, setRequestPreset] = useState("");
  const [requests, setRequests] = useState<Array<{ name: string; use: string; ts: number }>>([]);

  /** 未上线应用：打开需求弹窗并预填应用名 */
  const requestSoon = (app: App) => {
    setRequestPreset(app.name);
    setRequestOpen(true);
  };

  /** 上传文档：读取文本并存入文档中心 */
  const uploadDoc = (f: File) => {
    const isText =
      /\.(txt|md|mdx|csv|json|log|yaml|yml|ini|tsv|xml)$/i.test(f.name) ||
      f.type.startsWith("text/");
    if (!isText) {
      toast("文档中心目前支持文本文件：txt / md / csv / json / log 等", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      addDocument({
        name: f.name,
        sizeKb: Math.max(1, Math.round(f.size / 1024)),
        content: String(reader.result ?? "").slice(0, 20000),
      });
      toast(`已把《${f.name}》存入文档中心`, "success");
    };
    reader.readAsText(f);
  };

  /** 提交应用需求：保存在本机（无后端工单系统） */
  const submitRequest = (name: string, use: string) => {
    const list = [{ name, use, ts: Date.now() }, ...requests].slice(0, 20);
    setRequests(list);
    writeJSON("oc:app-requests.v1", list);
    setRequestOpen(false);
    toast("已记录你的应用需求（保存在本机）", "success");
  };

  const demo = (label: string) => toast(`演示预览：${label} 功能即将接入`, "info");

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4] text-stone-800">
      <ShellSidebar active="apps" />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#f0eadf] bg-[#fbf8f4] px-6 py-4">
          <div>
            <h1 className="text-[18px] font-semibold text-stone-900">更多应用</h1>
            <p className="mt-0.5 text-[12.5px] text-stone-400">发现更多实用应用，扩展你的工作能力</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <AppLauncherMenu />
            <button
              onClick={() => fileRef.current?.click()}
              className="ml-2 flex items-center gap-1.5 rounded-xl border border-[#f0c9a8] bg-white px-4 py-2 text-[13px] font-medium text-[#c05f3c] transition hover:bg-[#fdeee1]"
            >
              <Plus className="h-4 w-4" /> 上传文档
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.csv,.json,.log,.yaml,.yml,.xml,text/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadDoc(f);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </header>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5">
          <div className="mx-auto w-full max-w-[1180px]">
            <AppGrid title="效率办公" apps={EFFICIENCY} onLaunch={launch} onSoon={requestSoon} />
            <AppGrid title="沟通协作" apps={COMMUNICATION} onLaunch={launch} onSoon={requestSoon} />
            <AppGrid title="项目管理" apps={PROJECT} onLaunch={launch} onSoon={requestSoon} />
            <AppGrid title="其他应用" apps={OTHER} onLaunch={launch} onSoon={requestSoon} />

            {/* 底部提示卡 */}
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#ece6db] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Package className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-stone-800">更多应用持续更新中</p>
                  <p className="mt-0.5 text-[12px] text-stone-400">我们正在不断增加更多实用应用，满足你的各种需求</p>
                </div>
              </div>
              <button
                onClick={() => setRequestOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition hover:brightness-105"
              >
                <Send className="h-4 w-4" /> 提交应用
              </button>
            </div>
          </div>
        </div>
      </main>
      {requestOpen && (
        <RequestModal
          initialName={requestPreset}
          onClose={() => setRequestOpen(false)}
          onSubmit={submitRequest}
        />
      )}

      <Toaster />
    </div>
  );
}

/** 提交应用需求（保存在本机 localStorage，无后端工单系统） */
function RequestModal({
  initialName,
  onClose,
  onSubmit,
}: {
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string, use: string) => void;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [use, setUse] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/45 p-4 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-label="提交应用需求"
        className="my-6 w-full max-w-md overflow-hidden rounded-3xl border border-stone-200/80 bg-[#fdfaf6] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-stone-800">提交应用需求</h2>
            <p className="mt-0.5 text-xs text-stone-400">记录在本机，供后续排期参考</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">想要什么应用</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：合同条款审查助手"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">主要用来做什么</label>
            <textarea
              value={use}
              onChange={(e) => setUse(e.target.value)}
              rows={4}
              placeholder="描述一下使用场景和期望的产出"
              className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm leading-6 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-stone-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-50"
          >
            取消
          </button>
          <button
            onClick={() => {
              const n = name.trim();
              if (!n) {
                toast("请填写想要的应用", "error");
                return;
              }
              onSubmit(n, use.trim());
            }}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2 text-sm font-medium text-white shadow-md shadow-orange-200 transition hover:brightness-105"
          >
            提交
          </button>
        </footer>
      </div>
    </div>
  );
}

function AppGrid({
  title,
  apps,
  onLaunch,
  onSoon,
}: {
  title: string;
  apps: App[];
  onLaunch: (a: App) => void | Promise<void>;
  onSoon: (a: App) => void;
}) {
  return (
    <div className="mt-5">
      <h2 className="text-[15px] font-semibold text-stone-800">{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {apps.map((a) =>
          a.soon ? (
            <button
              key={a.name}
              onClick={() => onSoon(a)}
              className="relative flex items-start gap-3 rounded-2xl border border-dashed border-[#e5ddcf] bg-[#faf7f1] p-4 text-left transition hover:border-[#e0b79c]"
            >
              <span className="absolute right-3 top-3 rounded-full bg-stone-200/70 px-1.5 py-0.5 text-[9.5px] font-medium text-stone-500">
                即将上线
              </span>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl opacity-50 ${a.bg} ${a.tint}`}>
                <a.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-stone-500">{a.name}</span>
                <span className="mt-1 block text-xs leading-5 text-stone-400">{a.desc}</span>
                <span className="mt-1 block text-[10.5px] text-[#c05f3c]/70">点击告诉我们你需要它</span>
              </span>
            </button>
          ) : (
            <button
              key={a.name}
              onClick={() => void onLaunch(a)}
              className="flex items-start gap-3 rounded-2xl border border-[#ece6db] bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition hover:shadow-md"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.bg} ${a.tint}`}>
                <a.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-stone-800">{a.name}</span>
                <span className="mt-1 block text-xs leading-5 text-stone-400">{a.desc}</span>
              </span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
