"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function LiveWideCarousel({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const n = images.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || n < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % n), 3800);
    return () => window.clearInterval(t);
  }, [paused, n]);

  if (!n) return null;
  const go = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <div
      className="relative w-full overflow-hidden bg-stone-950"
      style={{ aspectRatio: "16 / 9" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {images.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src + k}
          src={src}
          alt={`${alt} ${k + 1}`}
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${k === i ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <button
        type="button"
        aria-label="上一张"
        onClick={() => go(-1)}
        className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="下一张"
        onClick={() => go(1)}
        className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
        {images.map((_, k) => (
          <button
            key={k}
            type="button"
            aria-label={`第 ${k + 1} 张`}
            onClick={() => setI(k)}
            className={`h-1.5 rounded-full transition ${k === i ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
          />
        ))}
      </div>
      <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white/80">
        {i + 1} / {n} · 16:9
      </p>
    </div>
  );
}

export const LAMP_WIDE = Array.from({ length: 4 }, (_, i) => `/cases/lamp/w${String(i + 1).padStart(2, "0")}.jpg`);

export const DIFFUSER_WIDE = Array.from({ length: 4 }, (_, i) => `/cases/diffuser/w${String(i + 1).padStart(2, "0")}.jpg`);

export const SPEAKER_WIDE = Array.from({ length: 4 }, (_, i) => `/cases/speaker/w${String(i + 1).padStart(2, "0")}.jpg`);
