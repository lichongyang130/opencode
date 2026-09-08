"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/store/toast";
import { readJSON, writeJSON } from "@/lib/safe-storage";

interface Task {
  id: string;
  title: string;
  owner: string;
  due: string;
  status: "todo" | "doing" | "done";
}

const KEY = "oc:task-board";
const STATUS_LABEL: Record<Task["status"], string> = { todo: "待开始", doing: "进行中", done: "已完成" };
const STATUS_TINT: Record<Task["status"], string> = {
  todo: "bg-stone-100 text-stone-500",
  doing: "bg-blue-50 text-blue-600",
  done: "bg-emerald-50 text-emerald-600",
};

function load(): Task[] {
  const list = readJSON<Task[]>(KEY, []);
  return Array.isArray(list) ? list : [];
}

/** 团队协作：轻量任务看板（本机持久化，可导出 Markdown 分派清单） */
export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");

  useEffect(() => setTasks(load()), []);

  const save = (next: Task[]) => {
    setTasks(next);
    writeJSON(KEY, next);
  };

  const add = () => {
    const t = title.trim();
    if (!t) {
      toast("请填写任务内容", "error");
      return;
    }
    const task: Task = {
      id: `${Date.now()}`,
      title: t,
      owner: owner.trim() || "未指派",
      due: due || "—",
      status: "todo",
    };
    save([task, ...tasks]);
    setTitle("");
    setOwner("");
    setDue("");
  };

  const exportMd = () => {
    if (tasks.length === 0) return;
    const md = [
      "# 团队任务分派",
      "",
      `> 共 ${tasks.length} 项，已完成 ${tasks.filter((t) => t.status === "done").length} 项`,
      "",
      "| 任务 | 负责人 | 截止 | 状态 |",
      "| --- | --- | --- | --- |",
      ...tasks.map((t) => `| ${t.title} | ${t.owner} | ${t.due} | ${STATUS_LABEL[t.status]} |`),
      "",
      "## 未完成事项",
      ...tasks
        .filter((t) => t.status !== "done")
        .map((t) => `- [${t.status === "doing" ? "-" : " "}] ${t.title}（${t.owner}，截止 ${t.due}）`),
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "团队任务分派.md";
    a.click();
    URL.revokeObjectURL(url);
    toast("已导出任务清单", "success");
  };

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="任务内容，如：整理竞品对比表"
          className="min-w-[200px] flex-1 rounded-lg border border-stone-200 px-3 py-2 text-[13px] outline-none focus:border-[#e0b79c]"
        />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="负责人"
          className="w-24 rounded-lg border border-stone-200 px-3 py-2 text-[13px] outline-none focus:border-[#e0b79c]"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-36 rounded-lg border border-stone-200 px-3 py-2 text-[13px] outline-none focus:border-[#e0b79c]"
        />
        <button
          onClick={add}
          className="flex items-center gap-1 rounded-lg bg-stone-800 px-3 py-2 text-[13px] font-medium text-white hover:bg-stone-900"
        >
          <Plus className="h-3.5 w-3.5" /> 添加
        </button>
      </div>

      <div className="flex items-center justify-between text-[12px] text-stone-400">
        <span>
          共 {tasks.length} 项 · 已完成 {doneCount} 项
          {tasks.length > 0 && ` · 进度 ${Math.round((doneCount / tasks.length) * 100)}%`}
        </span>
        {tasks.length > 0 && (
          <span className="flex items-center gap-2">
            <button
              onClick={() => save(tasks.filter((t) => t.status !== "done"))}
              className="hover:text-[#c05f3c]"
            >
              清除已完成
            </button>
            <button onClick={exportMd} className="flex items-center gap-1 hover:text-[#c05f3c]">
              <Download className="h-3 w-3" /> 导出清单
            </button>
          </span>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-100">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 border-b border-stone-100 px-3 py-2 last:border-b-0">
              <select
                value={t.status}
                onChange={(e) =>
                  save(tasks.map((x) => (x.id === t.id ? { ...x, status: e.target.value as Task["status"] } : x)))
                }
                className={`shrink-0 rounded-lg px-2 py-1 text-[11.5px] outline-none ${STATUS_TINT[t.status]}`}
              >
                {(Object.keys(STATUS_LABEL) as Task["status"][]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <span className={`min-w-0 flex-1 truncate text-[13px] ${t.status === "done" ? "text-stone-400 line-through" : "text-stone-700"}`}>
                {t.title}
              </span>
              <span className="shrink-0 text-[11.5px] text-stone-400">{t.owner}</span>
              <span className="shrink-0 text-[11.5px] text-stone-400">{t.due}</span>
              <button
                onClick={() => save(tasks.filter((x) => x.id !== t.id))}
                className="shrink-0 rounded-lg p-1 text-stone-300 transition hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11.5px] leading-5 text-stone-400">
        数据保存在本机浏览器，可导出 Markdown 分派清单；跨设备实时同步需要服务端账号体系，当前版本未内置。
      </p>
    </div>
  );
}
