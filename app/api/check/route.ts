// The enforcement endpoint. An agent (or a proxy in front of it) calls this before
// spending money or reaching an external domain. Returns an allow/deny decision and
// records the outcome in the audit log. On an allowed spend, the spend is committed.
import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { evaluate } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const store = await getStore();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const agentId = String(body?.agentId ?? "");
  const amountUsd = body?.amountUsd != null ? Number(body.amountUsd) : undefined;
  const domain = body?.domain != null ? String(body.domain) : undefined;
  const tool = body?.tool != null ? String(body.tool) : undefined;

  const agent = await store.getAgent(agentId);
  const result = evaluate(agent, { agentId, amountUsd, domain, tool });

  if (result.decision === "allow") {
    if (amountUsd && amountUsd > 0) await store.addSpend(agentId, amountUsd);
    await store.appendAudit({ agentId, type: "check_allow", decision: "allow", amountUsd, domain, tool });
  } else {
    await store.appendAudit({
      agentId: agentId || "unknown",
      type: "check_deny",
      decision: "deny",
      reason: result.reason,
      amountUsd,
      domain,
      tool,
    });
  }

  // Always 200; the `decision` field is the source of truth for the caller.
  return NextResponse.json(result);
}
