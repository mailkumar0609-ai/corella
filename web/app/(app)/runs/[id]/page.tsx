"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import { AgentLog, AgentReport } from "@/components/AgentPanel";
import RunStatus from "@/components/RunStatus";
import { api, fmtDate, openReport, passRate, type ResultRow, type Run } from "@/lib/api";

type Compare = { regressed: string[]; fixed: string[]; unchanged: number; new: string[]; pass_rate: number; baseline_pass_rate: number };
const METRICS = ["task_success", "accuracy", "compliance", "language_handling", "tone"];

function ResultCard({ r }: { r: ResultRow }) {
  const [open, setOpen] = useState(!r.passed);
  const bad = new Set((r.score.failures || []).map((f) => f.turn));
  let n = 0;
  return (
    <div className="card">
      <div className="spread" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <div><span className={`badge ${r.error ? "warn" : r.passed ? "ok" : "bad"}`}>{r.error ? "Error" : r.passed ? "Pass" : "Fail"}</span>{" "}
          <b>{r.scenario.id.replace(/_/g, " ")}</b> <span className="muted">· {r.scenario.persona.replace(/_/g, " ")}</span></div>
        <span className="muted">{r.score.summary || r.error}</span>
      </div>
      {open && (<div style={{ marginTop: 12 }}>
        <p className="muted" style={{ fontSize: 14 }}><b>Goal:</b> {r.scenario.goal}<br /><b>Expected:</b> {r.scenario.success}</p>
        <div className="row">{METRICS.map((m) => <span key={m} className="badge">{m.replace("_", " ")} {r.score[m] ?? "–"}/5</span>)}</div>
        {(r.score.failures || []).map((f, i) => (
          <div key={i} className="fix"><b>{f.category}</b> · agent turn {f.turn}: {f.issue}<br /><span><b>Suggested fix:</b> {f.suggested_fix}</span></div>
        ))}
        <div style={{ marginTop: 10 }}>
          {r.transcript.map((t, i) => {
            if (t.role === "agent") n++;
            return <div key={i} className={`msg ${t.role} ${t.role === "agent" && bad.has(n) ? "flag" : ""}`}><span className="who">{t.role}</span>{t.content}</div>;
          })}
        </div>
      </div>)}
    </div>
  );
}

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const [run, setRun] = useState<Run | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [cmp, setCmp] = useState<Compare | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await api<Run>(`/v1/runs/${id}`);
        if (stop) return;
        setRun(r);
        if (r.status === "completed") {
          setResults(await api<ResultRow[]>(`/v1/runs/${id}/results`));
          if (r.baseline_run_id) setCmp(await api<Compare>(`/v1/runs/${id}/compare`));
        } else if (r.status !== "failed") timer = setTimeout(poll, r.mode === "autonomous" ? 2000 : 3000);
      } catch (e) { setError(e instanceof Error ? e.message : "Could not load run"); }
    }
    poll();
    return () => { stop = true; clearTimeout(timer); };
  }, [id]);

  async function rerun() {
    try { const r = await api<Run>(`/v1/runs/${id}/rerun`, { method: "POST" }); router.push(`/runs/${r.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not re-run"); }
  }

  if (!run) return error ? <div className="alert">{error}</div> : <p className="muted">Loading…</p>;
  const s = run.summary;
  const shown = onlyFailed ? results.filter((r) => !r.passed) : [...results].sort((a, b) => Number(a.passed) - Number(b.passed));

  return (
    <>
      <Link href={`/agents/${run.agent_id}`} className="muted">Back to agent</Link>
      <div className="spread">
        <h1>{run.label || "Test run"} <RunStatus run={run} /></h1>
        {run.status === "completed" && (
          <div className="row">
            <button className="btn" onClick={() => openReport(run.id).catch((e) => setError(e.message))}>Open shareable report</button>
            {me.limits.regression
              ? <button className="btn primary" onClick={rerun} title="Replay the same scenarios, e.g. after changing your prompt">Re-run same tests</button>
              : <Link className="btn" href="/billing">Regression re-runs: upgrade</Link>}
          </div>)}
      </div>
      <p className="muted mono">{run.id} · {fmtDate(run.created_at)}</p>
      {error && <div className="alert">{error}</div>}
      {run.status === "failed" && <div className="alert">This run could not finish: {run.error}. It did not count toward your quota.</div>}
      {(run.status === "queued" || run.status === "running") && run.mode !== "autonomous" && (
        <div className="card"><p>Simulating {run.conversations} customer conversations… This page updates automatically.</p></div>)}
      {run.mode === "autonomous" && run.status === "queued" && !run.events?.length && (
        <div className="card" style={{ marginBottom: 16 }}><p>The agent is queued and will start in a moment. This page updates live.</p></div>)}
      <AgentLog run={run} />

      {s && (<div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", margin: "16px 0" }}>
        <div className="card stat"><div className="n">{passRate(s)}%</div><div className="l">Pass rate</div></div>
        <div className="card stat"><div className="n">{s.failed}</div><div className="l">Failed of {s.total}</div></div>
        {Object.entries(s.averages).map(([k, v]) => <div key={k} className="card stat"><div className="n">{v}</div><div className="l">{k.replace("_", " ")} (avg /5)</div></div>)}
      </div>)}

      <AgentReport run={run} />

      {cmp && (<div className="card" style={{ marginBottom: 16 }}>
        <h2>Compared with the previous run</h2>
        <p>Pass rate {Math.round(cmp.baseline_pass_rate * 100)}% → <b>{Math.round(cmp.pass_rate * 100)}%</b></p>
        {cmp.regressed.length > 0 && <p><span className="badge bad">Newly broken</span> {cmp.regressed.join(", ")}</p>}
        {cmp.fixed.length > 0 && <p><span className="badge ok">Fixed</span> {cmp.fixed.join(", ")}</p>}
        {!cmp.regressed.length && !cmp.fixed.length && <p className="muted">No change in results.</p>}
      </div>)}

      {results.length > 0 && (<>
        <div className="spread" style={{ margin: "8px 0" }}>
          <h2>Conversations</h2>
          <label className="row" style={{ margin: 0, fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} /> Failures only</label>
        </div>
        <div className="grid">{shown.map((r) => <ResultCard key={r.id} r={r} />)}</div>
      </>)}
    </>
  );
}
