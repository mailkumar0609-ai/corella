"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import { AgentLog, AgentReport } from "@/components/AgentPanel";
import ComplianceTable from "@/components/ComplianceTable";
import ResultCard from "@/components/ResultCard";
import RunStatus from "@/components/RunStatus";
import { api, fmtDate, openReport, passRate, type ResultRow, type Run } from "@/lib/api";

type Compare = { regressed: string[]; fixed: string[]; unchanged: number; new: string[]; pass_rate: number; baseline_pass_rate: number };
export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const [run, setRun] = useState<Run | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [cmp, setCmp] = useState<Compare | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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

  async function share() {
    try {
      const { share_url } = await api<{ share_url: string }>(`/v1/runs/${id}/share`, { method: "POST" });
      setRun((r) => r && { ...r, share_url });
      await navigator.clipboard?.writeText(share_url).then(() => setCopied(true), () => {});
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create link"); }
  }

  async function unshare() {
    try { await api(`/v1/runs/${id}/share`, { method: "DELETE" }); setRun((r) => r && { ...r, share_url: null }); setCopied(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not turn off link"); }
  }

  async function rerun() {
    try { const r = await api<Run>(`/v1/runs/${id}/rerun`, { method: "POST" }); router.push(`/runs/${r.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not re-run"); }
  }

  if (!run) return error ? <div className="alert">{error}</div> : <p className="muted">Loading…</p>;
  const s = run.summary;
  const shown = onlyFailed ? results.filter((r) => !r.passed) : [...results].sort((a, b) => Number(a.passed) - Number(b.passed));

  return (
    <>
      <Link href={`/agents/${run.agent_id}`} className="crumb">‹ Back to agent</Link>
      <div className="spread">
        <h1>{run.label || "Test run"} <RunStatus run={run} /></h1>
        {run.status === "completed" && (
          <div className="row">
            <button className="btn" onClick={share} title="Anyone with the link can view results. Your prompt, rules and credentials are never shown.">
              {run.share_url ? "Copy share link" : "Share report"}</button>
            <button className="btn" onClick={() => openReport(run.id).catch((e) => setError(e.message))}>Download report</button>
            {me.limits.regression
              ? <button className="btn primary" onClick={rerun} title="Replay the same scenarios, e.g. after changing your prompt">Re-run same tests</button>
              : <Link className="btn" href="/billing">Regression re-runs: upgrade</Link>}
          </div>)}
      </div>
      <p className="muted" style={{ fontSize: 14 }}>Started {fmtDate(run.created_at)}</p>
      {error && <div className="alert">{error}</div>}
      {run.share_url && (<div className="alert info" style={{ wordBreak: "break-all" }}>
        {copied ? "Link copied. " : ""}Public link: <a href={run.share_url} target="_blank" rel="noreferrer">{run.share_url}</a>{" "}
        · <a href="#" onClick={(e) => { e.preventDefault(); unshare(); }}>Turn off link</a>
        <div className="hint" style={{ marginTop: 4 }}>Shows results and conversations only. Your prompt, rules, credentials and fixes stay private.</div>
      </div>)}
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

      {s?.voice && (<div className="card" style={{ marginBottom: 16 }}>
        <h2>Voice</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          <div className="stat"><div className="n">{(s.voice.avg_latency_ms / 1000).toFixed(1)}s</div><div className="l">Avg response time</div></div>
          <div className="stat"><div className="n">{(s.voice.p90_latency_ms / 1000).toFixed(1)}s</div><div className="l">90th percentile</div></div>
          <div className="stat"><div className="n">{s.voice.slow_turns}</div><div className="l">Turns slower than 3s (of {s.voice.turns})</div></div>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Conditions: {s.voice.noise.map((x) => x.replace("_", " ")).join(", ") || "clean"}. Callers usually hang up or talk over an agent that takes more than 2–3 seconds to answer.</p>
      </div>)}
      <ComplianceTable rules={s?.compliance} />
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
