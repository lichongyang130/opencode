"use client";

import { LiveDocByTitle } from "./LiveDocs";
import { LivePpt } from "./LivePpt";

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
  if (
    kind === "ppt" ||
    kind === "slides" ||
    title.includes("PPT") ||
    title.includes("SCQA") ||
    title.includes("金字塔") ||
    title.includes("路演") ||
    title.includes("汇报") ||
    title.includes("提案") ||
    title.includes("培训") ||
    title.includes("年终") ||
    title.includes("行业") ||
    title.includes("FAB") ||
    title.includes("复盘") ||
    title.includes("竞品") ||
    title.includes("周会") ||
    title.includes("董事会")
  ) {
    return <LivePpt title={title} />;
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
