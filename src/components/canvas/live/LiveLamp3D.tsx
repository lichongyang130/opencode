"use client";

import { useEffect, useRef, useState, type PointerEvent as PE } from "react";

/** 可拖拽旋转的 3D 土星灯展台：8K 主视觉贴在球体上，底座 / 光环独立分层 */
export function LiveLamp3D({ compact = false }: { compact?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [rot, setRot] = useState({ x: -12, y: 18 });
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const auto = useRef(true);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      if (auto.current) setRot((r) => ({ ...r, y: r.y + 0.35 }));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const onDown = (e: PE<HTMLDivElement>) => {
    auto.current = false;
    drag.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PE<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setRot({
      x: Math.max(-28, Math.min(8, d.rx + (e.clientY - d.y) * 0.18)),
      y: d.ry + (e.clientX - d.x) * 0.35,
    });
  };
  const onUp = () => {
    drag.current = null;
    window.setTimeout(() => {
      auto.current = true;
    }, 900);
  };

  return (
    <div
      ref={wrap}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className={`relative select-none overflow-hidden bg-[#07080c] ${compact ? "h-full min-h-[220px]" : "aspect-[3/4] w-full"}`}
      style={{ touchAction: "none", cursor: "grab" }}
      title="拖动旋转"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(40,70,110,0.35),transparent_55%)]" />
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: compact ? 700 : 1100 }}
      >
        <div
          className="relative"
          style={{
            width: compact ? 160 : 240,
            height: compact ? 240 : 360,
            transformStyle: "preserve-3d",
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          }}
        >
          {/* 雾 */}
          <div
            className="absolute left-1/2 top-[28%] h-28 w-52 -translate-x-1/2 rounded-full bg-white/10 blur-2xl"
            style={{ transform: "translateZ(-20px)" }}
          />

          {/* 球体：8K 主视觉作贴图 */}
          <div
            className="absolute left-1/2 top-[18%] -translate-x-1/2 overflow-hidden rounded-full shadow-[0_0_40px_rgba(80,140,220,0.35),inset_-18px_-10px_28px_rgba(0,0,0,0.45),inset_12px_8px_18px_rgba(255,220,160,0.25)]"
            style={{
              width: compact ? 108 : 168,
              height: compact ? 108 : 168,
              transform: "translateZ(36px)",
              backgroundImage:
                "url(/cases/lamp-levitation.jpg), radial-gradient(circle at 32% 28%, #f3d7a4, #3d7ab8 42%, #0a2a4a 78%)",
              backgroundSize: "180% 180%, cover",
              backgroundPosition: "center 38%, center",
            }}
          >
            <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.45),transparent_36%)]" />
          </div>

          {/* 土星环 */}
          <div
            className="absolute left-1/2 top-[30%] -translate-x-1/2 rounded-[50%] border-[10px] border-amber-200/80"
            style={{
              width: compact ? 168 : 250,
              height: compact ? 52 : 78,
              transform: "rotateX(72deg) translateZ(36px)",
              boxShadow: "0 0 16px rgba(251,191,36,0.45), inset 0 0 10px rgba(255,220,160,0.4)",
              borderLeftColor: "rgba(180,140,80,0.35)",
              borderRightColor: "rgba(255,230,180,0.9)",
            }}
          />

          {/* 底座 */}
          <div
            className="absolute left-1/2 bottom-[8%] -translate-x-1/2"
            style={{ transform: "translateZ(8px)", transformStyle: "preserve-3d" }}
          >
            <div
              className="rounded-full"
              style={{
                width: compact ? 118 : 168,
                height: compact ? 36 : 52,
                background: "radial-gradient(ellipse at 50% 30%, #8a5a32, #3a2214 70%)",
                boxShadow: "0 18px 28px rgba(0,0,0,0.55)",
              }}
            />
            <div
              className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border-2 border-amber-300/90"
              style={{ width: compact ? 64 : 92, height: compact ? 18 : 24 }}
            />
          </div>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/cases/lamp-levitation.jpg" alt="Saturn Lamp 主视觉" className="pointer-events-none absolute h-px w-px opacity-0" />
      <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] tracking-wide text-white/50">
        拖动旋转 · 8K 主视觉
      </p>
    </div>
  );
}
