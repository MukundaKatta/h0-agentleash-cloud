// Storage seam. Production uses DynamoDB; local dev (no AWS env) uses an in-memory store.
// The DynamoDB adapter is dynamically imported so the AWS SDK is only loaded when configured.
import type { Agent, AuditEvent } from "./types";

export type Backend = "dynamodb" | "memory";

export interface Store {
  backend(): Backend;
  createAgent(input: { name: string; usdCap: number; allowedDomains: string[] }): Promise<Agent>;
  getAgent(id: string): Promise<Agent | undefined>;
  listAgents(): Promise<Agent[]>;
  /** Atomically add to spentUsd. Returns the updated agent, or undefined if it does not exist. */
  addSpend(id: string, amountUsd: number): Promise<Agent | undefined>;
  appendAudit(ev: Omit<AuditEvent, "id" | "ts"> & { ts?: string }): Promise<AuditEvent>;
  listAudit(opts?: { agentId?: string; limit?: number }): Promise<AuditEvent[]>;
}

let cached: Store | null = null;

export async function getStore(): Promise<Store> {
  if (cached) return cached;
  const table = process.env.DDB_TABLE;
  const region = process.env.AWS_REGION;
  if (table && region) {
    const { DynamoStore } = await import("./store-dynamo");
    cached = new DynamoStore(table, region);
  } else {
    const { MemoryStore } = await import("./store-memory");
    cached = new MemoryStore();
  }
  return cached;
}
