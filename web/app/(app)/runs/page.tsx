"use client";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const name = new Map(agents.map((a) => [a.id, a.name]));
  return (
    <>
      <div className="page-head"><div><h1>Test runs</h1><p>Every test you&apos;ve run, newest first.</p></div></div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {runs === null ? <div style={{ padding: 22, display: "grid", gap: 12 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 22 }} />)}</div>
        : runs.length === 0 ? <div style={{ padding: 22 }}><p>No test runs yet.</p><p className="muted">Open an agent and choose Run a test.</p></div> : (
          <div style={{ overflowX: "auto" }}><table><thead><tr><th style={{ paddingLeft: 22 }}>Run</th><th className="hide-sm">Agent</th><th>Result</th><th>Pass rate</th><th className="hide-sm">Conversations</th><th className="hide-sm">Started</th></tr></thead><tbody>
            {runs.map((r) => (
              <tr key={r.id} className="link" onClick={() => router.push(`/runs/${r.id}`)}>
                <td style={{ paddingLeft: 22, fontWeight: 600 }}>{r.label || "Test run"}</td><td className="muted hide-sm">{name.get(r.agent_id) || "–"}</td><td><RunStatus run={r} /></td>
                <td>{r.summary ? <b>{passRate(r.summary)}%</b> : "–"}</td><td className="hide-sm">{r.conversations}</td><td className="muted hide-sm" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
              </tr>))}
          </tbody></table></div>
        )}
      </div>
    </>
  );
}
