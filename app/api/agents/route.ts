import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await getStore();
  const agents = await store.listAgents();
  return NextResponse.json({ backend: store.backend(), agents });
}

export async function POST(req: NextRequest) {
  const store = await getStore();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  const usdCap = Number(body?.usdCap);
  const allowedDomains = parseDomains(body?.allowedDomains);

  if (!name || !Number.isFinite(usdCap) || usdCap <= 0) {
    return NextResponse.json({ error: "name and positive usdCap are required" }, { status: 400 });
  }

  const agent = await store.createAgent({ name, usdCap, allowedDomains });
  await store.appendAudit({ agentId: agent.id, type: "agent_created" });
  return NextResponse.json({ agent }, { status: 201 });
}

function parseDomains(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((d) => String(d).trim()).filter(Boolean);
  if (typeof input === "string") return input.split(",").map((d) => d.trim()).filter(Boolean);
  return [];
}
