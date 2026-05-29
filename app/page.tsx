"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Agent = { id: string; name: string; usdCap: number; allowedDomains: string[]; spentUsd: number; createdAt: string };
type Audit = {
  id: string;
  agentId: string;
  ts: string;
  type: string;
  decision?: string;
  reason?: string;
  amountUsd?: number;
  domain?: string;
  tool?: string;
};
type CheckResult =
  | { decision: "allow"; remainingUsd: number }
  | { decision: "deny"; reason: string; message: string };

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [backend, setBackend] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [a, au] = await Promise.all([
      fetch("/api/agents", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/audit?limit=40", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setAgents(a.agents ?? []);
    setBackend(a.backend ?? "");
    setAudit(au.audit ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Register-agent form
  const [name, setName] = useState("");
  const [cap, setCap] = useState("5");
  const [domains, setDomains] = useState("api.openai.com, api.anthropic.com");
  const [creating, setCreating] = useState(false);

  async function createAgent(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    await fetch("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, usdCap: Number(cap), allowedDomains: domains }),
    });
    setName("");
    setCreating(false);
    await load();
  }

  // Check simulator
  const [checkAgent, setCheckAgent] = useState("");
  const [amount, setAmount] = useState("0.50");
  const [domain, setDomain] = useState("api.openai.com");
  const [result, setResult] = useState<CheckResult | null>(null);

  async function runCheck(e: FormEvent) {
    e.preventDefault();
    const r: CheckResult = await fetch("/api/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: checkAgent, amountUsd: Number(amount), domain }),
    }).then((x) => x.json());
    setResult(r);
    await load();
  }

  async function seed() {
    await fetch("/api/seed", { method: "POST" });
    await load();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              agentleash <span className="text-indigo-600">cloud</span>
            </h1>
            <p className="text-sm text-slate-500">Spend caps, egress allowlists, and an audit trail for AI agents.</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                backend === "dynamodb" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              store: {backend || "..."}
            </span>
            <button onClick={seed} className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-300">
              Seed demo
            </button>
            <button onClick={load} className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-300">
              Refresh
            </button>
          </div>
        </header>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <form onSubmit={createAgent} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Register an agent</h2>
            <label className="mt-3 block text-sm">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="support-bot"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-sm">
              USD cap
              <input
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-sm">
              Allowed domains (comma-separated)
              <input
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              disabled={creating}
              className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create agent"}
            </button>
          </form>

          <form onSubmit={runCheck} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Simulate a policy check</h2>
            <label className="mt-3 block text-sm">
              Agent
              <select
                value={checkAgent}
                onChange={(e) => setCheckAgent(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select an agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Amount (USD)
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                Domain
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Run check
            </button>
            {result && (
              <div
                className={`mt-4 rounded-md px-3 py-2 text-sm ${
                  result.decision === "allow" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                }`}
              >
                <span className="font-semibold uppercase">{result.decision}</span>
                {result.decision === "allow"
                  ? ` — $${result.remainingUsd.toFixed(2)} remaining`
                  : ` — ${result.reason}: ${result.message}`}
              </div>
            )}
          </form>
        </div>

        <section className="mt-8">
          <h2 className="font-semibold">Agents</h2>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Loading...</p>
          ) : agents.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No agents yet. Click &quot;Seed demo&quot; or register one above.</p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {agents.map((a) => {
                const pct = a.usdCap > 0 ? Math.min(100, (a.spentUsd / a.usdCap) * 100) : 0;
                return (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-slate-400">{a.id}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      ${a.spentUsd.toFixed(2)} / ${a.usdCap.toFixed(2)}
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${pct >= 100 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {a.allowedDomains.map((d) => (
                        <span key={d} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-semibold">Audit log</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Domain</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {audit.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-slate-400">
                      No events yet.
                    </td>
                  </tr>
                ) : (
                  audit.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{new Date(e.ts).toLocaleTimeString()}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            e.decision === "deny"
                              ? "bg-rose-100 text-rose-700"
                              : e.decision === "allow"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {e.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">{e.amountUsd != null ? `$${e.amountUsd.toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{e.domain ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{e.reason ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-10 text-center text-xs text-slate-400">
          Built for H0: Hack the Zero Stack — Next.js on Vercel + DynamoDB. Based on the open-source{" "}
          <a className="underline" href="https://github.com/MukundaKatta/agentleash">
            agentleash
          </a>
          .
        </footer>
      </div>
    </main>
  );
}
