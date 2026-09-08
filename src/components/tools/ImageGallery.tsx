"use client";

import { useEffect, useState } from "react";
import { Download, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "@/lib/store/toast";

interface GalleryImage {
  url: string;
  prompt: string;
  model: string;
  createdAt: number;
  convoId: string;
  convoTitle: string;
}

/** 图片历史画廊：收集所有会话生成的图片，支持下载 */
export function ImageGallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(
        (d: {
          conversations?: Array<{
            id: string;
            title?: string;
            images?: Array<{ url: string; prompt?: string; model?: string; createdAt?: number }>;
          }>;
        }) => {
          const all: GalleryImage[] = [];
          for (const c of d.conversations ?? []) {
            for (const img of c.images ?? []) {
              all.push({
                url: img.url,
                prompt: img.prompt ?? "（无提示词）",
                model: img.model ?? "",
                createdAt: img.createdAt ?? 0,
                convoId: c.id,
                convoTitle: c.title ?? "未命名会话",
              });
            }
          }
          all.sort((a, b) => b.createdAt - a.createdAt);
          setImages(all);
        },
      )
      .catch(() => toast("图片加载失败", "error"))
      .finally(() => setLoading(false));
  }, []);

  const download = (img: GalleryImage) => {
    const a = document.createElement("a");
    a.href = img.url;
    a.download = `image-${img.createdAt || Date.now()}.png`;
    a.target = "_blank";
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" /> 正在收集会话图片…
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-stone-400">
        <ImageIcon className="h-8 w-8 text-stone-300" />
        <p className="text-sm">还没有生成过图片</p>
        <p className="text-[11.5px] text-stone-300">在 AI 对话或首页选择「生成图片」，产物会自动收集到这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] text-stone-400">共 {images.length} 张 · 来自所有会话的生成产物</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {images.map((img, i) => (
          <div key={`${img.convoId}-${i}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.prompt} className="aspect-square w-full object-cover" />
            <div className="space-y-1 p-2.5">
              <p className="line-clamp-2 text-[11.5px] leading-4 text-stone-600" title={img.prompt}>
                {img.prompt}
              </p>
              <p className="truncate text-[10px] text-stone-400">来自：{img.convoTitle}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="truncate text-[10px] text-stone-300">{img.model}</span>
                <button
                  onClick={() => download(img)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-stone-200 px-1.5 py-0.5 text-[10.5px] text-stone-500 transition hover:border-orange-300 hover:text-orange-600"
                >
                  <Download className="h-3 w-3" /> 下载
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
