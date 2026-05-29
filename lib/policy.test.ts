import { describe, expect, it } from "vitest";
import { evaluate, matchesDomain, normalizeHost } from "./policy";
import type { Agent } from "./types";

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agt_test",
    name: "test",
    usdCap: 5,
    allowedDomains: ["api.openai.com", "api.anthropic.com"],
    spentUsd: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("evaluate — budget", () => {
  it("allows a spend under the cap and reports remaining", () => {
    const r = evaluate(agent({ spentUsd: 1 }), { agentId: "a", amountUsd: 1, domain: "api.openai.com" });
    expect(r.decision).toBe("allow");
    if (r.decision === "allow") expect(r.remainingUsd).toBe(3);
  });

  it("allows spending exactly up to the cap", () => {
    const r = evaluate(agent({ spentUsd: 4 }), { agentId: "a", amountUsd: 1, domain: "api.openai.com" });
    expect(r).toEqual({ decision: "allow", remainingUsd: 0 });
  });

  it("denies when the spend would exceed the cap", () => {
    const r = evaluate(agent({ spentUsd: 4.99 }), { agentId: "a", amountUsd: 0.02, domain: "api.openai.com" });
    expect(r.decision).toBe("deny");
    if (r.decision === "deny") expect(r.reason).toBe("budget_exceeded");
  });

  it("allows a zero-cost check (no amount) even at the cap", () => {
    const r = evaluate(agent({ spentUsd: 5 }), { agentId: "a", domain: "api.openai.com" });
    expect(r.decision).toBe("allow");
  });
});

describe("evaluate — egress allowlist", () => {
  it("denies a domain not on the allowlist", () => {
    const r = evaluate(agent(), { agentId: "a", domain: "evil.example.com" });
    expect(r.decision).toBe("deny");
    if (r.decision === "deny") expect(r.reason).toBe("domain_not_allowed");
  });

  it("allows a subdomain of an allowlisted host", () => {
    const r = evaluate(agent(), { agentId: "a", domain: "eu.api.openai.com" });
    expect(r.decision).toBe("allow");
  });

  it("normalizes a full URL (scheme/port/path) before matching", () => {
    const r = evaluate(agent(), { agentId: "a", domain: "https://api.openai.com:443/v1/chat" });
    expect(r.decision).toBe("allow");
  });

  it("does not treat a lookalike suffix as a subdomain", () => {
    const r = evaluate(agent({ allowedDomains: ["openai.com"] }), { agentId: "a", domain: "notopenai.com" });
    expect(r.decision).toBe("deny");
  });

  it("skips the egress check when no domain is supplied", () => {
    const r = evaluate(agent(), { agentId: "a", amountUsd: 1 });
    expect(r.decision).toBe("allow");
  });
});

describe("evaluate — guards", () => {
  it("denies an unknown agent", () => {
    const r = evaluate(undefined, { agentId: "missing", amountUsd: 1 });
    expect(r.decision).toBe("deny");
    if (r.decision === "deny") expect(r.reason).toBe("unknown_agent");
  });

  it("denies a negative amount", () => {
    const r = evaluate(agent(), { agentId: "a", amountUsd: -1 });
    expect(r.decision).toBe("deny");
    if (r.decision === "deny") expect(r.reason).toBe("invalid_request");
  });

  it("checks egress before budget (bad domain denied even when also over budget)", () => {
    const r = evaluate(agent({ spentUsd: 5 }), { agentId: "a", amountUsd: 100, domain: "evil.example.com" });
    expect(r.decision).toBe("deny");
    if (r.decision === "deny") expect(r.reason).toBe("domain_not_allowed");
  });
});

describe("normalizeHost", () => {
  it("strips scheme, port, path and query, and lowercases", () => {
    expect(normalizeHost("HTTPS://API.OpenAI.com:443/v1?x=1")).toBe("api.openai.com");
  });

  it("passes a bare host through unchanged", () => {
    expect(normalizeHost("duckduckgo.com")).toBe("duckduckgo.com");
  });
});

describe("matchesDomain", () => {
  it("matches an exact host", () => expect(matchesDomain("api.openai.com", "api.openai.com")).toBe(true));
  it("matches a subdomain", () => expect(matchesDomain("eu.api.openai.com", "api.openai.com")).toBe(true));
  it("rejects an unrelated host", () => expect(matchesDomain("evil.com", "api.openai.com")).toBe(false));
  it("rejects a lookalike suffix", () => expect(matchesDomain("notopenai.com", "openai.com")).toBe(false));
  it("rejects an empty allowlist entry", () => expect(matchesDomain("api.openai.com", "")).toBe(false));
});
