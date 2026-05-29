// In-memory store for local development only (state is per-process and not durable).
// Production uses DynamoStore. Selected automatically by getStore() when AWS env is unset.
import type { Agent, AuditEvent } from "./types";
import type { Backend, Store } from "./store";

const agents = new Map<string, Agent>();
const audit: AuditEvent[] = [];

function rid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export class MemoryStore implements Store {
  backend(): Backend {
    return "memory";
  }

  async createAgent(input: { name: string; usdCap: number; allowedDomains: string[] }): Promise<Agent> {
    const agent: Agent = {
      id: rid("agt"),
      name: input.name,
      usdCap: input.usdCap,
      allowedDomains: input.allowedDomains,
      spentUsd: 0,
      createdAt: new Date().toISOString(),
    };
    agents.set(agent.id, agent);
    return agent;
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return agents.get(id);
  }

  async listAgents(): Promise<Agent[]> {
    return [...agents.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async addSpend(id: string, amountUsd: number): Promise<Agent | undefined> {
    const agent = agents.get(id);
    if (!agent) return undefined;
    agent.spentUsd = round(agent.spentUsd + amountUsd);
    agents.set(id, agent);
    return agent;
  }

  async appendAudit(ev: Omit<AuditEvent, "id" | "ts"> & { ts?: string }): Promise<AuditEvent> {
    const { ts, ...rest } = ev;
    const event: AuditEvent = { id: rid("evt"), ts: ts ?? new Date().toISOString(), ...rest };
    audit.push(event);
    return event;
  }

  async listAudit(opts?: { agentId?: string; limit?: number }): Promise<AuditEvent[]> {
    let rows = [...audit].reverse();
    if (opts?.agentId) rows = rows.filter((e) => e.agentId === opts.agentId);
    return rows.slice(0, opts?.limit ?? 50);
  }
}
