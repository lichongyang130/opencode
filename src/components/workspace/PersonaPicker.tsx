"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, UserCog, X } from "lucide-react";
import { PERSONAS, PERSONA_GROUPS, getPersona } from "@/lib/personas";
import { useChatStore } from "@/lib/store/chat";
import { cn } from "@/lib/utils";

/** AI 角色选择器：为当前会话绑定 system prompt 角色 */
export function PersonaPicker({ onStarter }: { onStarter?: (text: string) => void } = {}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const convo = useChatStore((s) => s.conversations.find((c) => c.id === s.activeId));
  const setPersona = useChatStore((s) => s.setPersona);
  const ref = useRef<HTMLDivElement>(null);

  const persona = getPersona(convo?.personaId);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = PERSONAS.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
  });

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition",
          persona && persona.id !== "none"
            ? "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
            : "border-stone-200 bg-white text-stone-500 hover:border-violet-300 hover:text-violet-600"
        )}
        title="选择 AI 角色（专家人设）"
      >
        <UserCog className="h-3.5 w-3.5" />
        {persona && persona.id !== "none" ? (
          <>
            <span>{persona.emoji}</span>
            <span className="max-w-24 truncate font-medium">{persona.name}</span>
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                setPersona(null);
              }}
              className="rounded-full p-0.5 hover:bg-violet-200"
            >
              <X className="h-3 w-3" />
            </span>
          </>
        ) : (
          <>
            AI 角色
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl">
          <div className="border-b border-stone-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索角色：文案、翻译、产品经理…"
              className="w-full rounded-lg bg-stone-50 px-3 py-1.5 text-sm outline-none placeholder:text-stone-400 focus:bg-white"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-stone-400">没有匹配的角色</div>
            )}
            {PERSONA_GROUPS.map((g) => {
              const list = filtered.filter((p) => p.group === g);
              if (list.length === 0) return null;
              return (
                <div key={g} className="mb-1">
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                    {g}
                  </div>
                  {list.map((p) => {
                    const active = convo?.personaId === p.id || (!convo?.personaId && p.id === "none");
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "group flex w-full items-start gap-2.5 rounded-lg px-2 py-2 transition",
                          active ? "bg-violet-50" : "hover:bg-stone-50"
                        )}
                      >
                        <button
                          onClick={() => {
                            setPersona(p.id === "none" ? null : p.id);
                            setOpen(false);
                            setQuery("");
                          }}
                          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                        >
                          <span className="mt-0.5 text-lg leading-none">{p.emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
                              {p.name}
                              {active && <Check className="h-3.5 w-3.5 text-violet-600" />}
                            </span>
                            <span className="block truncate text-xs text-stone-400">{p.desc}</span>
                          </span>
                        </button>
                        {p.starter && p.id !== "none" && (
                          <button
                            title={`试用开场白：${p.starter}`}
                            onClick={() => {
                              setPersona(p.id);
                              setOpen(false);
                              setQuery("");
                              onStarter?.(p.starter!);
                            }}
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-violet-500 opacity-0 transition hover:bg-violet-100 group-hover:opacity-100"
                          >
                            试用
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
