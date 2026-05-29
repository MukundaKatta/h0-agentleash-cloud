// Core domain types for agentleash cloud.
// Lineage: the open-source `agentleash` CLI/library (github.com/MukundaKatta/agentleash)
// enforces USD caps + a vendor allowlist + an audit trail for AI agents. This is the
// hosted version of that idea, backed by DynamoDB.

export type AgentId = string;

export interface Agent {
  id: AgentId;
  name: string;
  /** Hard spend ceiling in USD. A call that would push spentUsd past this is denied. */
  usdCap: number;
  /** Egress allowlist of hostnames. An entry "example.com" also matches subdomains. */
  allowedDomains: string[];
  /** Running total of approved spend in USD. */
  spentUsd: number;
  createdAt: string; // ISO 8601
}

export interface CheckRequest {
  agentId: AgentId;
  /** Cost in USD of the call the agent wants to make (0/undefined = no spend). */
  amountUsd?: number;
  /** Egress target hostname (or full URL) the agent wants to reach. */
  domain?: string;
  /** Optional label for the tool/operation, recorded in the audit log. */
  tool?: string;
}

/** Closed set of deny reasons. Branch on these, never on free-form strings. */
export type DenyReason =
  | "unknown_agent"
  | "budget_exceeded"
  | "domain_not_allowed"
  | "invalid_request";

/** Discriminated result of a policy check. */
export type CheckDecision =
  | { decision: "allow"; remainingUsd: number }
  | { decision: "deny"; reason: DenyReason; message: string };

export type AuditType = "agent_created" | "check_allow" | "check_deny";

export interface AuditEvent {
  id: string;
  agentId: AgentId;
  ts: string; // ISO 8601
  type: AuditType;
  decision?: "allow" | "deny";
  reason?: DenyReason;
  amountUsd?: number;
  domain?: string;
  tool?: string;
}
