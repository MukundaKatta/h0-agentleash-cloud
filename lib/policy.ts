// Pure policy engine. No I/O here so it is trivially testable and deterministic.
import type { Agent, CheckDecision, CheckRequest } from "./types";

/** Evaluate a check request against an agent's policy. Pure: does not mutate or persist. */
export function evaluate(agent: Agent | undefined, req: CheckRequest): CheckDecision {
  if (!agent) {
    return { decision: "deny", reason: "unknown_agent", message: `No agent with id ${req.agentId}` };
  }

  const amount = req.amountUsd ?? 0;
  if (!Number.isFinite(amount) || amount < 0) {
    return { decision: "deny", reason: "invalid_request", message: "amountUsd must be a number >= 0" };
  }

  // Egress allowlist check (only when a domain is supplied).
  if (req.domain) {
    const host = normalizeHost(req.domain);
    const allowed = agent.allowedDomains.some((d) => matchesDomain(host, normalizeHost(d)));
    if (!allowed) {
      return { decision: "deny", reason: "domain_not_allowed", message: `${host} is not in the allowlist` };
    }
  }

  // Budget cap check.
  const projected = round(agent.spentUsd + amount);
  if (projected > agent.usdCap) {
    return {
      decision: "deny",
      reason: "budget_exceeded",
      message: `Spend $${projected.toFixed(4)} would exceed cap $${agent.usdCap.toFixed(2)}`,
    };
  }

  return { decision: "allow", remainingUsd: round(agent.usdCap - projected) };
}

/** Strip scheme/path/port and lowercase, so "https://API.Example.com/x" -> "api.example.com". */
export function normalizeHost(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  s = s.split("/")[0]; // path
  s = s.split("?")[0];
  s = s.split(":")[0]; // port
  return s;
}

/** An allowlist entry matches its exact host and any subdomain of it. */
export function matchesDomain(host: string, allowed: string): boolean {
  if (!allowed || !host) return false;
  return host === allowed || host.endsWith("." + allowed);
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
