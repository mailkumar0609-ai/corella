"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import RunStatus from "@/components/RunStatus";
import { api, fmtDate, passRate, type Agent, type Run } from "@/lib/api";

type Persona = { id: string; description: string };
type Pack = { id: string; name: string; regulator: string; for: string; scenarios: number;
  rules: { id: string; text: string }[]; sources: { title: string; url: string }[] };

export default function AgentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, refresh } = useMe();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<"autonomous" | "standard" | "compliance">("autonomous");
  const [packs, setPacks] = useState<Pack[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [rounds, setRounds] = useState(3);
  const [count, setCount] = useState(30);
  const [turns, setTurns] = useState(6);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Agent>(`/v1/agents/${id}`).then(setAgent).catch((e) => setError(e.message));
    api<Run[]>(`/v1/runs?agent_id=${id}&limit=50`).then(setRuns);
    api<Persona[]>("/v1/personas").then(setPersonas);
    api<Pack[]>("/v1/compliance/packs").then(setPacks).catch(() => {});
  }, [id]);

  const left = me.limits.monthly_conversations - me.conversations_this_month;
  const packCount = packs.filter((p) => chosen.includes(p.id)).reduce((n, p) => n + p.scenarios, 0);
  const need = mode === "compliance" ? packCount : count;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const run = await api<Run>(`/v1/agents/${id}/runs`, { method: "POST",
        json: mode === "autonomous"
          ? { mode, scenarios: count, rounds, max_turns: turns, label: label || undefined }
          : mode === "compliance"
          ? { mode: "standard", packs: chosen, max_turns: turns, label: label || `Compliance: ${chosen.join(", ")}` }
          : { mode, scenarios: count, max_turns: turns, label: label || undefined, personas: picked.length ? picked : undefined } });
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
        <div><Link href="/agents" className="crumb">‹ All agents</Link><h1>{agent.name}</h1></div>
        {runs.length === 0 && <button className="btn danger" onClick={remove}>Delete agent</button>}
      </div>
      <p className="muted">{agent.description}</p>
      {agent.target_url && <p className="mono muted">{agent.target_url}</p>}

      <form className="card" onSubmit={start} style={{ margin: "16px 0" }}>
        <h2>Run a test</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          {([["autonomous", "Autonomous agent", "Corella plans the attack, adapts round by round to hunt for failures, finds root causes and writes a fixed prompt."],
             ["compliance", "Compliance check", "Fixed, replayable tests mapped to RBI and DPDP rules, with a rule-by-rule verdict you can share with your compliance team."],
             ["standard", "Fixed test set", "Generate a set of scenarios once and run them. Good for quick checks."]] as const).map(([v, t, d]) => (
            <button type="button" key={v} onClick={() => setMode(v)} className="card"
              style={{ textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit", borderColor: mode === v ? "var(--accent)" : undefined }}>
              <b>{t}</b>{v === "autonomous" && <span className="badge" style={{ marginLeft: 6 }}>Recommended</span>}
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{d}</div>
            </button>))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {mode === "autonomous" && <div><label>Rounds</label><input type="number" min={1} max={6} value={rounds} onChange={(e) => setRounds(+e.target.value)} /></div>}
          {mode !== "compliance" && <div><label>{mode === "autonomous" ? "Conversation budget" : "Conversations"}</label><input type="number" min={1} max={200} value={count} onChange={(e) => setCount(+e.target.value)} /></div>}
          <div><label>Max turns each</label><input type="number" min={1} max={20} value={turns} onChange={(e) => setTurns(+e.target.value)} /></div>
          <div><label>Label <span className="hint">optional</span></label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Prompt v3" /></div>
        </div>
        {mode === "compliance" && (<>
          <label>Compliance packs <span className="hint">Pick the rules that apply to this agent.</span></label>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
            {packs.map((p) => {
              const on = chosen.includes(p.id);
              return (
                <label key={p.id} className="card" style={{ cursor: "pointer", margin: 0, fontWeight: 400, borderColor: on ? "var(--accent)" : undefined }}>
                  <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                    <input type="checkbox" style={{ width: "auto", marginTop: 4 }} checked={on}
                      onChange={() => setChosen(on ? chosen.filter((x) => x !== p.id) : [...chosen, p.id])} />
                    <div><b>{p.name}</b>
                      <div className="muted" style={{ fontSize: 13 }}>{p.for}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{p.rules.length} rules · {p.scenarios} conversations</div>
                      <details style={{ fontSize: 13, marginTop: 4 }}><summary>Rules checked</summary>
                        <ul style={{ paddingLeft: 18, margin: "6px 0" }}>{p.rules.map((r) => <li key={r.id}><span className="mono">{r.id}</span> {r.text}</li>)}</ul>
                        Sources: {p.sources.map((src, i) => <span key={src.url}>{i > 0 && " · "}<a href={src.url} target="_blank" rel="noreferrer">{src.title}</a></span>)}
                      </details>
                    </div>
                  </div>
                </label>);
            })}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Checks are based on public RBI and DPDP texts and support, but don&apos;t replace, your compliance team&apos;s review.</p>
        </>)}
        {mode === "standard" && <><label>Customer personas <span className="hint">Leave empty to use all {personas.length}.</span></label>
        <div className="row">
          {personas.map((p) => (
            <button type="button" key={p.id} title={p.description}
              className={`btn ${picked.includes(p.id) ? "primary" : ""}`} style={{ padding: "4px 10px", fontSize: 13 }}
              onClick={() => setPicked(picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id])}>
              {p.id.replace(/_/g, " ")}
            </button>
          ))}
        </div></>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={busy || need > left || (mode === "compliance" && !chosen.length)}>
            {busy ? "Starting…" : mode === "autonomous" ? `Start agent (up to ${count} conversations)`
              : mode === "compliance" ? (chosen.length ? `Run compliance check (${packCount} conversations)` : "Pick at least one pack")
              : `Run ${count} conversations`}</button>
          <span className="muted">{left.toLocaleString("en-IN")} left this month</span>
        </div>
        {need > left && <div className="alert info">Not enough conversations left this month. <Link href="/billing">Upgrade</Link></div>}
        {error && <div className="alert">{error}</div>}
      </form>

      <div className="card">
        <h2>History</h2>
        {runs.length === 0 ? <p className="muted">No runs yet.</p> : (
          <table><thead><tr><th>Run</th><th>Result</th><th>Pass rate</th><th className="hide-sm">Started</th></tr></thead><tbody>
            {runs.map((r) => (
              <tr key={r.id} className="link" onClick={() => router.push(`/runs/${r.id}`)}>
                <td>{r.label || <span className="mono">{r.id}</span>}</td><td><RunStatus run={r} /></td>
                <td>{r.summary ? `${passRate(r.summary)}%` : "–"}</td><td className="muted hide-sm">{fmtDate(r.created_at)}</td>
              </tr>))}
          </tbody></table>
        )}
      </div>
    </>
  );
}
