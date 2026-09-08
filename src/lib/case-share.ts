import { applyVariables } from "./templates";

/** 案例分享码（方案 A：客户端短码，可复制/导入，无需服务器） */
export interface CaseSharePayload {
  k: "case";
  templateId: string;
  label: string;
  values: Record<string, string>;
}

export function encodeCaseShare(p: Omit<CaseSharePayload, "k">): string {
  const payload: CaseSharePayload = { k: "case", ...p };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

export function decodeCaseShare(code: string): CaseSharePayload | null {
  try {
    let s = code.trim();
    const m = s.match(/[?&]c=([^&]+)/);
    if (m) s = decodeURIComponent(m[1]);
    const obj = JSON.parse(decodeURIComponent(escape(atob(s)))) as CaseSharePayload;
    if (obj?.k !== "case" || !obj.templateId) return null;
    // typeof null === "object"，数组也是 object：都必须挡住，
    // 否则下游 applyVariables 取键时会抛 TypeError 把导入流程打崩。
    if (!obj.values || typeof obj.values !== "object" || Array.isArray(obj.values)) return null;
    return obj;
  } catch {
    return null;
  }
}

/** 由分享码还原出可直接填入输入框的最终提示词 */
export function caseShareToPrompt(
  code: string,
  getTemplate: (id: string) => { prompt: string } | undefined
): { templateId: string; prompt: string } | null {
  const p = decodeCaseShare(code);
  if (!p) return null;
  const t = getTemplate(p.templateId);
  if (!t) return null;
  return { templateId: p.templateId, prompt: applyVariables(t.prompt, p.values) };
}
