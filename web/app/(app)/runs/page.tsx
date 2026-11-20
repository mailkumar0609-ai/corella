"use client";
import { useEffect, useState } from "react";
import RunStatus from "@/components/RunStatus";
import { api, fmtDate, passRate, type Agent, type Run } from "@/lib/api";

export default function Runs() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => {
    api<Run[]>("/v1/runs?limit=100").then(setRuns);
    api<Agent[]>("/v1/agents").then(setAgents);
  }, []);
  const name = new Map(agents.map((a) => [a.id, a.name]));
  return (
    <>
      <h1>Test runs</h1>
      <div className="card" style={{ marginTop: 16 }}>
        {runs === null ? <p className="muted">Loading…</p> : runs.length === 0 ? <p className="muted">No runs yet.</p> : (
          <table><thead><tr><th>Run</th><th>Agent</th><th>Status</th><th>Pass rate</th><th>Conversations</th><th>When</th></tr></thead><tbody>
            {runs.map((r) => (
              <tr key={r.id} className="link" onClick={() => (window.location.href = `/runs/${r.id}`)}>
                <td>{r.label || <span className="mono">{r.id}</span>}</td><td>{name.get(r.agent_id) || "–"}</td><td><RunStatus run={r} /></td>
                <td>{r.summary ? `${passRate(r.summary)}%` : "–"}</td><td>{r.conversations}</td><td className="muted">{fmtDate(r.created_at)}</td>
              </tr>))}
          </tbody></table>
        )}
      </div>
    </>
  );
}
