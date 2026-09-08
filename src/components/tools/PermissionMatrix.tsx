"use client";

import { useEffect, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { toast } from "@/lib/store/toast";
import { readJSON, writeJSON } from "@/lib/safe-storage";

const KEY = "oc:perm-matrix";

const ROLES = ["管理员", "编辑者", "评论者", "访客"] as const;
const PERMS = ["查看", "编辑", "评论", "分享", "下载", "管理成员"] as const;

type Role = (typeof ROLES)[number];
type Perm = (typeof PERMS)[number];
type Matrix = Record<Role, Perm[]>;

const DEFAULT_MATRIX: Matrix = {
  管理员: ["查看", "编辑", "评论", "分享", "下载", "管理成员"],
  编辑者: ["查看", "编辑", "评论", "分享", "下载"],
  评论者: ["查看", "评论", "下载"],
  访客: ["查看"],
};

/** 权限管理：角色 × 权限矩阵，可勾选并导出 */
export function PermissionMatrix() {
  const [matrix, setMatrix] = useState<Matrix>(DEFAULT_MATRIX);

  useEffect(() => {
    const saved = readJSON<Matrix | null>(KEY, null);
    if (saved && typeof saved === "object") setMatrix(saved);
  }, []);

  const save = (next: Matrix) => {
    setMatrix(next);
    writeJSON(KEY, next);
  };

  const toggle = (role: Role, perm: Perm) => {
    const has = matrix[role].includes(perm);
    save({ ...matrix, [role]: has ? matrix[role].filter((p) => p !== perm) : [...matrix[role], perm] });
  };

  const toMarkdown = () =>
    [
      "# 文档权限矩阵",
      "",
      `| 角色 | ${PERMS.join(" | ")} |`,
      `| --- | ${PERMS.map(() => "---").join(" | ")} |`,
      ...ROLES.map((r) => `| ${r} | ${PERMS.map((p) => (matrix[r].includes(p) ? "✅" : "—")).join(" | ")} |`),
    ].join("\n");

  const exportMd = () => {
    const blob = new Blob([toMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "文档权限矩阵.md";
    a.click();
    URL.revokeObjectURL(url);
    toast("已导出权限矩阵", "success");
  };

  const exportCsv = () => {
    const csv = [
      `角色,${PERMS.join(",")}`,
      ...ROLES.map((r) => `${r},${PERMS.map((p) => (matrix[r].includes(p) ? "Y" : "N")).join(",")}`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "文档权限矩阵.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("已导出 CSV", "success");
  };

  const copyMd = () => {
    navigator.clipboard?.writeText(toMarkdown()).then(
      () => toast("已复制 Markdown", "success"),
      () => toast("复制失败", "error")
    );
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-stone-100">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-[#fbf8f4] text-stone-500">
              <th className="px-3 py-2 text-left font-medium">角色</th>
              {PERMS.map((p) => (
                <th key={p} className="px-2 py-2 text-center font-medium">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r} className="border-t border-stone-100">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-stone-700">{r}</td>
                {PERMS.map((p) => (
                  <td key={p} className="px-2 py-2 text-center">
                    <button
                      onClick={() => toggle(r, p)}
                      title={`${r} · ${p}`}
                      className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                        matrix[r].includes(p)
                          ? "border-[#f07a3f] bg-[#fdf1e3] text-[#c05f3c]"
                          : "border-stone-200 text-transparent hover:border-stone-300"
                      }`}
                    >
                      ✓
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <button
          onClick={exportMd}
          className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
        >
          <Download className="h-3 w-3" /> 导出 Markdown
        </button>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
        >
          <Download className="h-3 w-3" /> 导出 CSV
        </button>
        <button
          onClick={copyMd}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
        >
          复制表格
        </button>
        <button
          onClick={() => {
            save(DEFAULT_MATRIX);
            toast("已恢复默认权限", "info");
          }}
          className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
        >
          <RotateCcw className="h-3 w-3" /> 恢复默认
        </button>
      </div>

      <p className="text-[11.5px] leading-5 text-stone-400">
        这是一份可直接交付的权限设计表（保存于本机）；真正生效的访问控制需要服务端账号与鉴权，当前版本未内置。
      </p>
    </div>
  );
}
