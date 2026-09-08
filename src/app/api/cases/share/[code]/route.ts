import { NextResponse } from "next/server";
import { getCaseShare } from "@/lib/db/repo";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const rec = getCaseShare(params.code);
  if (!rec) return NextResponse.json({ error: "分享不存在或已过期" }, { status: 404 });
  return NextResponse.json(rec);
}
