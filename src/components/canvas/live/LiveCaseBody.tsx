"use client";

import { LiveDocByTitle } from "./LiveDocs";

/** 模板卡弹层左侧成品：文档走纸页 Live，其它技能先出预览图。 */
export function LiveCaseBody({
  kind,
  title,
  image,
}: {
  kind: string;
  title: string;
  image?: string;
  interactive?: boolean;
}) {
  if (kind === "docs" || title.includes("手册") || title.includes("简报") || title.includes("PRD")) {
    return <LiveDocByTitle title={title} />;
  }
  if (image) {
    return (
      <div className="flex h-full items-center justify-center bg-[#ebe4d6] p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={title} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center bg-[#ebe4d6] p-8 text-sm text-stone-500">{title}</div>
  );
}
