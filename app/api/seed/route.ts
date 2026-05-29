// Convenience endpoint for demos: creates two sample agents and a few check events
// (including denials) so the dashboard has something to show. Safe to call repeatedly.
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { evaluate } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = await getStore();

  const support = await store.createAgent({
    name: "support-bot",
    usdCap: 5,
    allowedDomains: ["api.openai.com", "api.anthropic.com"],
  });
  await store.appendAudit({ agentId: support.id, type: "agent_created" });

  const research = await store.createAgent({
    name: "research-agent",
    usdCap: 2,
    allowedDomains: ["api.anthropic.com", "duckduckgo.com"],
  });
  await store.appendAudit({ agentId: research.id, type: "agent_created" });

  const samples = [
    { id: support.id, amountUsd: 0.4, domain: "api.openai.com" }, // allow
    { id: support.id, amountUsd: 0.35, domain: "api.openai.com" }, // allow
    { id: research.id, amountUsd: 0.5, domain: "evil.example.com" }, // deny: domain_not_allowed
    { id: research.id, amountUsd: 3.0, domain: "api.anthropic.com" }, // deny: budget_exceeded
  ];

  for (const s of samples) {
    const agent = await store.getAgent(s.id);
    const res = evaluate(agent, { agentId: s.id, amountUsd: s.amountUsd, domain: s.domain });
    if (res.decision === "allow") {
      await store.addSpend(s.id, s.amountUsd);
      await store.appendAudit({ agentId: s.id, type: "check_allow", decision: "allow", amountUsd: s.amountUsd, domain: s.domain });
    } else {
      await store.appendAudit({ agentId: s.id, type: "check_deny", decision: "deny", reason: res.reason, amountUsd: s.amountUsd, domain: s.domain });
    }
  }

  return NextResponse.json({ ok: true, agents: await store.listAgents() });
}
