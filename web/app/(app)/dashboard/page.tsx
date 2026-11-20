"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import { api, fmtDate, passRate, type Agent, type Run } from "@/lib/api";
import RunStatus from "@/components/RunStatus";

export default function Dashboard() {
  const { me } = useMe();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api<Run[]>("/v1/runs?limit=8").then(setRuns);
    api<Agent[]>("/v1/agents").then(setAgents);
  }, []);

  const used = me.conversations_this_month, limit = me.limits.monthly_conversations;
  const done = (runs || []).filter((r) => r.summary);
  const avgPass = done.length ? Math.round(done.reduce((a, r) => a + passRate(r.summary), 0) / done.length) : null;
  const failures = done.reduce((a, r) => a + (r.summary?.failed || 0), 0);
  const name = new Map(agents.map((a) => [a.id, a.name]));

  return (
    <>
      <div className="spread"><h1>Overview</h1><Link className="btn primary" href={agents.length ? `/agents/${agents[0].id}` : "/agents?new=1"}>Run a test</Link></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", margin: "18px 0" }}>
        <div className="card stat"><div className="n">{avgPass === null ? "–" : `${avgPass}%`}</div><div className="l">Average pass rate (recent runs)</div></div>
        <div className="card stat"><div className="n">{failures}</div><div className="l">Failures found (recent runs)</div></div>
        <div className="card stat"><div className="n">{agents.length}<span className="muted" style={{ fontSize: 16 }}> / {me.limits.max_agents}</span></div><div className="l">Agents</div></div>
        <div className="card stat">
          <div className="n">{used.toLocaleString("en-IN")}</div>
          <div className="l">of {limit.toLocaleString("en-IN")} conversations this month</div>
          <div className="bar" style={{ marginTop: 8 }}><span style={{ width: `${Math.min(100, (100 * used) / limit)}%` }} /></div>
        </div>
      </div>
      {used / limit > 0.8 && me.organization.plan !== "enterprise" && (
        <div className="alert info">You have used {Math.round((100 * used) / limit)}% of this month's conversations. <Link href="/billing">Upgrade your plan</Link>.</div>
      )}
      <div className="card">
        <h2>Recent test runs</h2>
        {runs === null ? <p className="muted">Loading…</p> : runs.length === 0 ? (
          <p className="muted">No runs yet. <Link href="/agents?new=1">Add your first agent</Link> and run a test; the built-in demo agent works without any setup.</p>
        ) : (
          <table><thead><tr><th>Run</th><th>Agent</th><th>Status</th><th>Pass rate</th><th>When</th></tr></thead><tbody>
            {runs.map((r) => (
              <tr key={r.id} className="link" onClick={() => (window.location.href = `/runs/${r.id}`)}>
                <td>{r.label || <span className="mono">{r.id}</span>}</td><td>{name.get(r.agent_id) || "–"}</td>
                <td><RunStatus run={r} /></td><td>{r.summary ? `${passRate(r.summary)}%` : "–"}</td><td className="muted">{fmtDate(r.created_at)}</td>
              </tr>))}
          </tbody></table>
        )}
      </div>
    </>
  );
}
