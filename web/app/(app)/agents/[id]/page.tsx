"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import RunStatus from "@/components/RunStatus";
import { api, fmtDate, passRate, type Agent, type Run } from "@/lib/api";

type Persona = { id: string; description: string };

export default function AgentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, refresh } = useMe();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [turns, setTurns] = useState(6);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Agent>(`/v1/agents/${id}`).then(setAgent).catch((e) => setError(e.message));
    api<Run[]>(`/v1/runs?agent_id=${id}&limit=50`).then(setRuns);
    api<Persona[]>("/v1/personas").then(setPersonas);
  }, [id]);

  const left = me.limits.monthly_conversations - me.conversations_this_month;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const run = await api<Run>(`/v1/agents/${id}/runs`, { method: "POST",
        json: { scenarios: count, max_turns: turns, label: label || undefined, personas: picked.length ? picked : undefined } });
      await refresh();
      router.push(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run");
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    try { await api(`/v1/agents/${id}`, { method: "DELETE" }); router.push("/agents"); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not delete"); }
  }

  if (!agent) return error ? <div className="alert">{error}</div> : <p className="muted">Loading…</p>;

  return (
    <>
      <div className="spread">
        <div><Link href="/agents" className="muted">Agents</Link><h1>{agent.name}</h1></div>
        {runs.length === 0 && <button className="btn danger" onClick={remove}>Delete agent</button>}
      </div>
      <p className="muted">{agent.description}</p>
      {agent.target_url && <p className="mono muted">{agent.target_url}</p>}

      <form className="card" onSubmit={start} style={{ margin: "16px 0" }}>
        <h2>Run a test</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          <div><label>Conversations</label><input type="number" min={1} max={200} value={count} onChange={(e) => setCount(+e.target.value)} /></div>
          <div><label>Max turns each</label><input type="number" min={1} max={20} value={turns} onChange={(e) => setTurns(+e.target.value)} /></div>
          <div><label>Label <span className="hint">optional</span></label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Prompt v3" /></div>
        </div>
        <label>Customer personas <span className="hint">Leave empty to use all {personas.length}.</span></label>
        <div className="row">
          {personas.map((p) => (
            <button type="button" key={p.id} title={p.description}
              className={`btn ${picked.includes(p.id) ? "primary" : ""}`} style={{ padding: "4px 10px", fontSize: 13 }}
              onClick={() => setPicked(picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id])}>
              {p.id.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={busy || count > left}>{busy ? "Starting…" : `Run ${count} conversations`}</button>
          <span className="muted">{left.toLocaleString("en-IN")} left this month</span>
        </div>
        {count > left && <div className="alert info">Not enough conversations left this month. <Link href="/billing">Upgrade</Link></div>}
        {error && <div className="alert">{error}</div>}
      </form>

      <div className="card">
        <h2>History</h2>
        {runs.length === 0 ? <p className="muted">No runs yet.</p> : (
          <table><thead><tr><th>Run</th><th>Status</th><th>Pass rate</th><th>When</th></tr></thead><tbody>
            {runs.map((r) => (
              <tr key={r.id} className="link" onClick={() => router.push(`/runs/${r.id}`)}>
                <td>{r.label || <span className="mono">{r.id}</span>}</td><td><RunStatus run={r} /></td>
                <td>{r.summary ? `${passRate(r.summary)}%` : "–"}</td><td className="muted">{fmtDate(r.created_at)}</td>
              </tr>))}
          </tbody></table>
        )}
      </div>
    </>
  );
}
