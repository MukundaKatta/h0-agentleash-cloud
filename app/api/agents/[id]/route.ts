import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = await getStore();
  const agent = await store.getAgent(id);
  if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const audit = await store.listAudit({ agentId: id, limit: 50 });
  return NextResponse.json({ agent, audit });
}
