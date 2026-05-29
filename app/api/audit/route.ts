import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const store = await getStore();
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId") ?? undefined;
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const audit = await store.listAudit({ agentId, limit });
  return NextResponse.json({ audit });
}
