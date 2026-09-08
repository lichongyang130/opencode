"use client";

import { THEMES } from "@/lib/slides/themes";
import type { Slide } from "@/lib/slides/types";
import { cn } from "@/lib/utils";

interface Props {
  slide: Slide;
  themeId: keyof typeof THEMES;
  index: number;
  editable?: boolean;
  onPatch?: (patch: Partial<Slide>) => void;
}

/** 可编辑文本：浏览态为普通文本，编辑态为无边框输入框 */
function EditText({
  value,
  onPatch,
  field,
  editable,
  className,
  multiline,
  placeholder,
}: {
  value?: string;
  field: keyof Slide;
  onPatch?: (p: Partial<Slide>) => void;
  editable?: boolean;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const emit = (v: string) => onPatch?.({ [field]: v } as Partial<Slide>);
  if (!editable) {
    return <div className={className}>{value ?? placeholder}</div>;
  }
  return multiline ? (
    <textarea
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => emit(e.target.value)}
      className={cn(className, "w-full resize-none bg-transparent outline-none")}
      rows={2}
    />
  ) : (
    <input
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => emit(e.target.value)}
      className={cn(className, "w-full bg-transparent outline-none")}
    />
  );
}

/**
 * 单张幻灯片。16:9 比例，容器宽度决定字号（cqw），
 * 侧栏缩略图与主预览复用同一组件自动缩放。
 */
export function SlideView({ slide, themeId, index, editable, onPatch }: Props) {
  const t = THEMES[themeId] ?? THEMES.violet;
  const dark = slide.layout === "cover" || slide.layout === "end";

  return (
    <div
      className="relative aspect-[16/9] w-full overflow-hidden rounded-lg"
      style={{
        containerType: "inline-size",
        background: dark ? t.primary : t.surface,
        color: dark ? t.onPrimary : t.text,
      }}
    >
      {/* 封面 / 结束页 */}
      {dark && (
        <>
          <div
            className="absolute -right-[12cqw] -top-[18cqw] h-[45cqw] w-[45cqw] rounded-full"
            style={{ background: t.accent, opacity: 0.35 }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-[8cqw] text-center">
            <EditText
              value={slide.title}
              field="title"
              editable={editable}
              onPatch={onPatch}
              placeholder="标题"
              className="text-[5.2cqw] font-bold leading-tight"
            />
            {slide.subtitle !== undefined || editable ? (
              <EditText
                value={slide.subtitle}
                field="subtitle"
                editable={editable}
                onPatch={onPatch}
                placeholder="副标题"
                className="mt-[2cqw] text-[2.4cqw]"
              />
            ) : null}
          </div>
        </>
      )}

      {/* 浅底页通用标题（quote 版式走全屏金句布局，不要标题栏挤占空间） */}
      {!dark && slide.layout !== "quote" && (
        <div className="flex items-center gap-[1.2cqw] px-[5cqw] pt-[4cqw]">
          <div
            className="h-[3.2cqw] w-[0.6cqw] shrink-0 rounded-full"
            style={{ background: t.accent }}
          />
          <EditText
            value={slide.title}
            field="title"
            editable={editable}
            onPatch={onPatch}
            placeholder="页标题"
            className="text-[3cqw] font-bold"
          />
        </div>
      )}

      {/* 目录 */}
      {slide.layout === "toc" && (
        <div className="space-y-[1.6cqw] px-[9cqw] pt-[3.5cqw]">
          {(slide.bullets ?? []).map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-[2.5cqw] rounded-[1cqw] bg-white px-[3cqw] py-[1.8cqw] shadow-sm"
            >
              <span className="text-[2.6cqw] font-bold" style={{ color: t.accent }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {editable ? (
                <input
                  value={b}
                  onChange={(e) => {
                    const next = [...(slide.bullets ?? [])];
                    next[i] = e.target.value;
                    onPatch?.({ bullets: next });
                  }}
                  className="w-full bg-transparent text-[2.4cqw] outline-none"
                />
              ) : (
                <span className="text-[2.4cqw]">{b}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 内容页 */}
      {slide.layout === "content" && (
        <div className="flex gap-[4cqw] px-[7cqw] pt-[3cqw]">
          <div className={slide.imagePrompt ? "flex-[1.6]" : "flex-1"}>
            <ul className="space-y-[1.8cqw]">
              {(slide.bullets ?? []).map((b, i) => (
                <li key={i} className="flex items-start gap-[1.5cqw] text-[2.3cqw] leading-relaxed">
                  <span
                    className="mt-[0.9cqw] h-[0.9cqw] w-[0.9cqw] shrink-0 rounded-full"
                    style={{ background: t.accent }}
                  />
                  {editable ? (
                    <input
                      value={b}
                      onChange={(e) => {
                        const next = [...(slide.bullets ?? [])];
                        next[i] = e.target.value;
                        onPatch?.({ bullets: next });
                      }}
                      className="w-full bg-transparent outline-none"
                    />
                  ) : (
                    <span>{b}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {slide.imagePrompt && (
            <div
              className="flex flex-1 items-center justify-center overflow-hidden rounded-[1.2cqw] border-2 border-dashed text-center text-[1.6cqw]"
              style={{ borderColor: t.accent, color: t.muted, background: "rgba(255,255,255,0.5)" }}
            >
              {slide.imageUrl ? (
                // PPT3：配图生成后实图显示（替代占位符）
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slide.imageUrl} alt={slide.title ?? "配图"} className="h-full w-full object-cover" />
              ) : (
                "配图位 · 点击「配图」生成"
              )}
            </div>
          )}
        </div>
      )}

      {/* 双栏 */}
      {slide.layout === "twoCol" && (
        <div className="grid grid-cols-2 gap-[3cqw] px-[6cqw] pt-[3cqw]">
          {[
            { heading: "核心要点", items: slide.bullets ?? [], field: "bullets" as const },
            { heading: slide.twoColTitle ?? "补充", items: slide.bulletsRight ?? [], field: "bulletsRight" as const },
          ].map((col, ci) => (
            <div key={ci} className="rounded-[1.2cqw] bg-white p-[3cqw] shadow-sm">
              <div className="mb-[1.5cqw] text-[2.3cqw] font-bold" style={{ color: t.accent }}>
                {ci === 1 && editable ? (
                  <input
                    value={slide.twoColTitle ?? ""}
                    placeholder="右栏标题"
                    onChange={(e) => onPatch?.({ twoColTitle: e.target.value })}
                    className="w-full bg-transparent outline-none"
                  />
                ) : (
                  col.heading
                )}
              </div>
              <ul className="space-y-[1.3cqw]">
                {col.items.map((b, i) => (
                  <li key={i} className="flex items-start gap-[1.2cqw] text-[2cqw] leading-snug">
                    <span
                      className="mt-[0.7cqw] h-[0.8cqw] w-[0.8cqw] shrink-0 rounded-full"
                      style={{ background: t.accent }}
                    />
                    {editable ? (
                      <input
                        value={b}
                        onChange={(e) => {
                          const next = [...col.items];
                          next[i] = e.target.value;
                          onPatch?.({ [col.field]: next });
                        }}
                        className="w-full bg-transparent outline-none"
                      />
                    ) : (
                      <span>{b}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* 数字卡片 */}
      {slide.layout === "stats" && (
        <div className="flex items-center justify-center gap-[3cqw] px-[6cqw] pt-[2cqw]">
          {(slide.stats ?? []).map((st, i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center rounded-[1.5cqw] bg-white py-[4cqw] shadow-sm"
              style={{ border: `0.3cqw solid ${t.accent}55` }}
            >
              {editable ? (
                <input
                  value={st.value}
                  onChange={(e) => {
                    const next = [...(slide.stats ?? [])];
                    next[i] = { ...next[i], value: e.target.value };
                    onPatch?.({ stats: next });
                  }}
                  className="w-full bg-transparent text-center text-[4.5cqw] font-bold outline-none"
                  style={{ color: t.accent }}
                />
              ) : (
                <div className="text-[4.5cqw] font-bold" style={{ color: t.accent }}>
                  {st.value}
                </div>
              )}
              {editable ? (
                <input
                  value={st.label}
                  onChange={(e) => {
                    const next = [...(slide.stats ?? [])];
                    next[i] = { ...next[i], label: e.target.value };
                    onPatch?.({ stats: next });
                  }}
                  className="mt-[0.8cqw] w-full bg-transparent text-center text-[1.8cqw] outline-none"
                  style={{ color: t.muted }}
                />
              ) : (
                <div className="mt-[0.8cqw] text-[1.8cqw]" style={{ color: t.muted }}>
                  {st.label}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 时间轴（PPT5）：横向节点链 */}
      {slide.layout === "timeline" && (
        <div className="px-[7cqw] pt-[3cqw]">
          <div className="flex items-start">
            {(slide.steps ?? []).map((st, i, arr) => (
              <div key={i} className="flex flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  {i > 0 && (
                    <div
                      className="h-[0.35cqw] flex-1"
                      style={{ background: i <= (arr.length - 1) ? t.accent : "transparent" }}
                    />
                  )}
                  <div
                    className="mx-[0.8cqw] h-[2.2cqw] w-[2.2cqw] shrink-0 rounded-full border-[0.4cqw]"
                    style={{ background: t.surface, borderColor: t.accent }}
                  />
                  {i < arr.length - 1 && <div className="h-[0.35cqw] flex-1" style={{ background: t.accent }} />}
                </div>
                <div className="mt-[1.2cqw] text-[2.2cqw] font-bold">{st.item}</div>
                {st.detail && <div className="mt-[0.6cqw] px-[0.5cqw] text-[1.7cqw] leading-snug" style={{ color: t.muted }}>{st.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 流程（PPT5）：竖向步骤链 */}
      {slide.layout === "process" && (
        <div className="space-y-[1.6cqw] px-[8cqw] pt-[2.5cqw]">
          {(slide.steps ?? []).map((st, i) => (
            <div key={i} className="flex items-center gap-[2cqw]">
              <div
                className="flex h-[4cqw] w-[4cqw] shrink-0 items-center justify-center rounded-full text-[2cqw] font-bold text-white"
                style={{ background: t.accent }}
              >
                {i + 1}
              </div>
              <div className="flex-1 rounded-[1cqw] bg-white px-[2.5cqw] py-[1.4cqw] shadow-sm">
                {editable ? (
                  <>
                    <input
                      value={st.item}
                      onChange={(e) => {
                        const next = [...(slide.steps ?? [])];
                        next[i] = { ...next[i], item: e.target.value };
                        onPatch?.({ steps: next });
                      }}
                      className="w-full bg-transparent text-[2.2cqw] font-bold outline-none"
                    />
                    <input
                      value={st.detail ?? ""}
                      placeholder="步骤说明"
                      onChange={(e) => {
                        const next = [...(slide.steps ?? [])];
                        next[i] = { ...next[i], detail: e.target.value };
                        onPatch?.({ steps: next });
                      }}
                      className="mt-[0.4cqw] w-full bg-transparent text-[1.7cqw] outline-none"
                      style={{ color: t.muted }}
                    />
                  </>
                ) : (
                  <>
                    <div className="text-[2.2cqw] font-bold">{st.item}</div>
                    {st.detail && (
                      <div className="mt-[0.4cqw] text-[1.7cqw]" style={{ color: t.muted }}>
                        {st.detail}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 左右对比（PPT5）：方案 A vs B */}
      {slide.layout === "compare" && (
        <div className="grid grid-cols-2 gap-[3cqw] px-[6cqw] pt-[3cqw]">
          {[
            { heading: "方案 A", items: slide.bullets ?? [], field: "bullets" as const },
            { heading: slide.twoColTitle ?? "方案 B", items: slide.bulletsRight ?? [], field: "bulletsRight" as const },
          ].map((col, ci) => (
            <div
              key={ci}
              className="rounded-[1.2cqw] p-[3cqw] shadow-sm"
              style={{
                background: "rgba(255,255,255,0.85)",
                border: ci === 0 ? `0.3cqw solid ${t.accent}66` : `0.3cqw dashed ${t.muted}55`,
              }}
            >
              <div className="mb-[1.5cqw] text-[2.3cqw] font-bold" style={{ color: ci === 0 ? t.accent : t.muted }}>
                {ci === 1 && editable ? (
                  <input
                    value={slide.twoColTitle ?? ""}
                    placeholder="右栏标题"
                    onChange={(e) => onPatch?.({ twoColTitle: e.target.value })}
                    className="w-full bg-transparent outline-none"
                  />
                ) : (
                  col.heading
                )}
              </div>
              <ul className="space-y-[1.3cqw]">
                {col.items.map((b, i) => (
                  <li key={i} className="flex items-start gap-[1.2cqw] text-[2cqw] leading-snug">
                    <span
                      className="mt-[0.7cqw] h-[0.8cqw] w-[0.8cqw] shrink-0 rounded-full"
                      style={{ background: ci === 0 ? t.accent : t.muted }}
                    />
                    {editable ? (
                      <input
                        value={b}
                        onChange={(e) => {
                          const next = [...col.items];
                          next[i] = e.target.value;
                          onPatch?.({ [col.field]: next });
                        }}
                        className="w-full bg-transparent outline-none"
                      />
                    ) : (
                      <span>{b}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* 引用（PPT5）：金句大字居中 */}
      {slide.layout === "quote" && (
        <div className="flex h-full flex-col items-center justify-center px-[10cqw] text-center">
          <div className="text-[6cqw] leading-none" style={{ color: t.accent, opacity: 0.5 }}>
            &ldquo;
          </div>
          <EditText
            value={slide.quote}
            field="quote"
            editable={editable}
            onPatch={onPatch}
            multiline
            placeholder="引用正文"
            className="max-w-[70cqw] text-[2.8cqw] font-medium leading-relaxed"
          />
          <EditText
            value={slide.quoteBy}
            field="quoteBy"
            editable={editable}
            onPatch={onPatch}
            placeholder="—— 署名"
            className="mt-[2cqw] text-[1.8cqw]"
          />
        </div>
      )}

      {/* 团队（PPT5）：成员卡片 */}
      {slide.layout === "team" && (
        <div className="flex flex-wrap items-stretch justify-center gap-[2.5cqw] px-[6cqw] pt-[3cqw]">
          {(slide.stats ?? []).map((st, i) => (
            <div
              key={i}
              className="flex w-[20cqw] flex-col items-center rounded-[1.5cqw] bg-white py-[3cqw] shadow-sm"
              style={{ border: `0.3cqw solid ${t.accent}44` }}
            >
              {editable ? (
                <>
                  <input
                    value={st.value}
                    onChange={(e) => {
                      const next = [...(slide.stats ?? [])];
                      next[i] = { ...next[i], value: e.target.value };
                      onPatch?.({ stats: next });
                    }}
                    className="w-full bg-transparent text-center text-[2.4cqw] font-bold outline-none"
                  />
                  <input
                    value={st.label}
                    onChange={(e) => {
                      const next = [...(slide.stats ?? [])];
                      next[i] = { ...next[i], label: e.target.value };
                      onPatch?.({ stats: next });
                    }}
                    className="mt-[0.6cqw] w-full bg-transparent text-center text-[1.6cqw] outline-none"
                    style={{ color: t.muted }}
                  />
                </>
              ) : (
                <>
                  <div className="text-[2.4cqw] font-bold">{st.value}</div>
                  <div className="mt-[0.6cqw] text-[1.6cqw]" style={{ color: t.muted }}>
                    {st.label}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 页码 */}
      {!dark && (
        <div
          className="absolute bottom-[2.5cqw] right-[4cqw] text-[1.4cqw]"
          style={{ color: t.muted }}
        >
          {index + 1}
        </div>
      )}
    </div>
  );
}
