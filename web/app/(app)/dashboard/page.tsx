"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import RunStatus from "@/components/RunStatus";
import { api, fmtDate, passRate, type Agent, type Run } from "@/lib/api";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { me } = useMe();
  const router = useRouter();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);

  useEffect(() => {
    api<Run[]>("/v1/runs?limit=8").then(setRuns).catch(() => setRuns([]));
    api<Agent[]>("/v1/agents").then(setAgents).catch(() => setAgents([]));
  }, []);

  const used = me.conversations_this_month, limit = me.limits.monthly_conversations;
  const done = (runs || []).filter((r) => r.summary);
  const avgPass = done.length ? Math.round(done.reduce((a, r) => a + passRate(r.summary), 0) / done.length) : null;
  const failures = done.reduce((a, r) => a + (r.summary?.failed || 0), 0);
  const name = new Map((agents || []).map((a) => [a.id, a.name]));
  const firstAgent = agents?.[0];
  const loading = runs === null || agents === null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting()}</h1>
          <p>{me.organization.name}: how your agents are holding up.</p>
        </div>
        <Link className="btn primary lg" href={firstAgent ? `/agents/${firstAgent.id}` : "/agents?new=1"}>
          {firstAgent ? "Run a test" : "Add your first agent"}</Link>
      </div>

      <div className="strip">
        <div className="stat"><div className="n">{avgPass === null ? "–" : `${avgPass}%`}</div><div className="l">Average pass rate, recent runs</div></div>
        <div className="stat"><div className="n" style={{ color: failures ? "var(--bad)" : undefined }}>{failures}</div><div className="l">Failed conversations found</div></div>
        <div className="stat"><div className="n">{agents?.length ?? "–"}<span className="muted" style={{ fontSize: 17 }}> / {me.limits.max_agents}</span></div><div className="l">Agents under test</div></div>
        <div className="stat">
          <div className="n">{used.toLocaleString("en-IN")}</div>
          <div className="l">of {limit.toLocaleString("en-IN")} conversations used this month</div>
          <div className="bar" style={{ marginTop: 10 }}><span style={{ width: `${Math.min(100, (100 * used) / Math.max(limit, 1))}%` }} /></div>
        </div>
      </div>

      {used / limit > 0.8 && me.organization.plan !== "enterprise" && (
        <div className="alert info">You&apos;ve used {Math.round((100 * used) / limit)}% of this month&apos;s conversations. <Link href="/billing">See plans</Link></div>
      )}

      <div className="card" style={{ marginTop: 18, padding: 0, overflow: "hidden" }}>
        <div className="spread" style={{ padding: "18px 22px 12px" }}>
          <h2 style={{ margin: 0 }}>Recent test runs</h2>
          {!!runs?.length && <Link href="/runs" style={{ fontSize: 14, fontWeight: 600 }}>View all</Link>}
        </div>
        {loading ? (
          <div style={{ padding: "4px 22px 22px", display: "grid", gap: 12 }}>
            {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 22 }} />)}
          </div>
        ) : runs!.length === 0 ? (
          <div style={{ padding: "8px 22px 28px", maxWidth: 560 }}>
            <p style={{ fontSize: 16, color: "var(--ink)" }}>Nothing tested yet.</p>
            <p className="muted">Add an agent and run your first test. No setup? The built-in demo agent shows you a full report in about three minutes.</p>
            <Link className="btn primary" href="/agents?new=1">Add an agent</Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table><thead><tr><th style={{ paddingLeft: 22 }}>Run</th><th className="hide-sm">Agent</th><th>Result</th><th>Pass rate</th><th className="hide-sm">Started</th></tr></thead><tbody>
              {runs!.map((r) => (
                <tr key={r.id} className="link" onClick={() => router.push(`/runs/${r.id}`)}>
                  <td style={{ paddingLeft: 22, fontWeight: 600 }}>{r.label || "Test run"}</td>
                  <td className="muted hide-sm">{name.get(r.agent_id) || "–"}</td>
                  <td><RunStatus run={r} /></td>
                  <td>{r.summary ? <b>{passRate(r.summary)}%</b> : "–"}</td>
                  <td className="muted hide-sm" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                </tr>))}
            </tbody></table>
          </div>
        )}
      </div>
    </>
  );
}
