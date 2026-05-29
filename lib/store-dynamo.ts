// DynamoDB adapter (single-table design, no GSIs).
//
// Item layout:
//   Agent:            PK="AGENTS"            SK="AGENT#<id>"
//   Audit (global):   PK="AUDIT"             SK="<isoTs>#<id>"
//   Audit (by agent): PK="AUDIT#<agentId>"   SK="<isoTs>#<id>"
//
// listAgents  -> Query(PK=AGENTS)
// listAudit   -> Query(PK=AUDIT or AUDIT#<agentId>), newest first
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Agent, AuditEvent } from "./types";
import type { Backend, Store } from "./store";

function rid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export class DynamoStore implements Store {
  private doc: DynamoDBDocumentClient;

  constructor(private table: string, region: string) {
    this.doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  backend(): Backend {
    return "dynamodb";
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
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: { PK: "AGENTS", SK: `AGENT#${agent.id}`, _kind: "agent", ...agent },
      }),
    );
    return agent;
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.table, Key: { PK: "AGENTS", SK: `AGENT#${id}` } }),
    );
    return res.Item ? toAgent(res.Item) : undefined;
  }

  async listAgents(): Promise<Agent[]> {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": "AGENTS" },
      }),
    );
    return (res.Items ?? []).map(toAgent).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async addSpend(id: string, amountUsd: number): Promise<Agent | undefined> {
    try {
      const res = await this.doc.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { PK: "AGENTS", SK: `AGENT#${id}` },
          UpdateExpression: "SET spentUsd = if_not_exists(spentUsd, :z) + :a",
          ConditionExpression: "attribute_exists(SK)",
          ExpressionAttributeValues: { ":a": amountUsd, ":z": 0 },
          ReturnValues: "ALL_NEW",
        }),
      );
      return res.Attributes ? toAgent(res.Attributes) : undefined;
    } catch {
      return undefined; // ConditionalCheckFailed -> agent does not exist
    }
  }

  async appendAudit(ev: Omit<AuditEvent, "id" | "ts"> & { ts?: string }): Promise<AuditEvent> {
    const { ts, ...rest } = ev;
    const event: AuditEvent = { id: rid("evt"), ts: ts ?? new Date().toISOString(), ...rest };
    const sk = `${event.ts}#${event.id}`;
    const base = { _kind: "audit", ...event };
    await Promise.all([
      this.doc.send(new PutCommand({ TableName: this.table, Item: { PK: "AUDIT", SK: sk, ...base } })),
      this.doc.send(
        new PutCommand({ TableName: this.table, Item: { PK: `AUDIT#${event.agentId}`, SK: sk, ...base } }),
      ),
    ]);
    return event;
  }

  async listAudit(opts?: { agentId?: string; limit?: number }): Promise<AuditEvent[]> {
    const pk = opts?.agentId ? `AUDIT#${opts.agentId}` : "AUDIT";
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": pk },
        ScanIndexForward: false, // newest first
        Limit: opts?.limit ?? 50,
      }),
    );
    return (res.Items ?? []).map(toAudit);
  }
}

function toAgent(i: Record<string, unknown>): Agent {
  return {
    id: String(i.id),
    name: String(i.name),
    usdCap: Number(i.usdCap),
    allowedDomains: Array.isArray(i.allowedDomains) ? (i.allowedDomains as string[]) : [],
    spentUsd: Number(i.spentUsd ?? 0),
    createdAt: String(i.createdAt),
  };
}

function toAudit(i: Record<string, unknown>): AuditEvent {
  return {
    id: String(i.id),
    agentId: String(i.agentId),
    ts: String(i.ts),
    type: i.type as AuditEvent["type"],
    decision: i.decision as AuditEvent["decision"],
    reason: i.reason as AuditEvent["reason"],
    amountUsd: i.amountUsd != null ? Number(i.amountUsd) : undefined,
    domain: i.domain != null ? String(i.domain) : undefined,
    tool: i.tool != null ? String(i.tool) : undefined,
  };
}
