import { NextResponse } from "next/server";
import { createCaseShare, type CaseShareRecord } from "@/lib/db/repo";
import { readJsonBody } from "@/lib/http";
import { withRoute } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: Request) => {
  const body = await readJsonBody<Omit<CaseShareRecord, "code">>(req);
  if (!body) {
    return NextResponse.json({ error: "请求体不是有效的 JSON 对象" }, { status: 400 });
  }
  if (!body.templateId || !body.prompt) {
    return NextResponse.json({ error: "templateId 与 prompt 必填" }, { status: 400 });
  }
  const code = createCaseShare({
    templateId: body.templateId,
    label: body.label ?? "",
    prompt: body.prompt,
    values: body.values ?? {},
    output: body.output,
    image: body.image,
    source: body.source,
  });
  return NextResponse.json({ code, url: `/s/${code}` });
});
