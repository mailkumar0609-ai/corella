"use client";
import { useState } from "react";
import type { Run } from "@/lib/api";

const SEV: Record<string, string> = { critical: "bad", high: "bad", medium: "warn", low: "" };

export function AgentLog({ run }: { run: Run }) {
  if (!run.events?.length) return null;
  const live = run.status === "queued" || run.status === "running";
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2>{live ? "Agent at work" : "What the agent did"}</h2>
      <ol style={{ paddingLeft: 18, margin: 0 }}>
        {run.events.map((e, i) => (
          <li key={i} style={{ margin: "4px 0" }}>
            <span className="badge" style={{ marginRight: 6 }}>{e.step}</span>{e.message}
          </li>))}
        {live && <li className="muted">Working…</li>}
      </ol>
    </div>
  );
}

export function AgentReport({ run }: { run: Run }) {
  const rep = run.agent_report;
  const [copied, setCopied] = useState(false);
  if (!rep) return null;
  return (
    <div className="grid" style={{ marginBottom: 16 }}>
      {rep.root_causes.length > 0 && (
        <div className="card">
          <h2>Root causes found</h2>
          <p className="muted">The agent grouped every failure into the underlying problems in your agent's instructions.</p>
          {rep.root_causes.map((c, i) => (
            <div key={i} className="fix">
              <span className={`badge ${SEV[c.severity] ?? ""}`}>{c.severity}</span> <b>{c.cause}</b>
              <div style={{ marginTop: 4 }}><b>Fix:</b> {c.fix}</div>
              <div className="muted" style={{ fontSize: 13 }}>Seen in: {c.scenario_ids.join(", ")}</div>
            </div>))}
        </div>)}

      {rep.patched_prompt && (
        <div className="card">
          <div className="spread">
            <h2>Patched system prompt</h2>
            <button className="btn" onClick={() => navigator.clipboard.writeText(rep.patched_prompt!).then(() => setCopied(true))}>
              {copied ? "Copied" : "Copy prompt"}</button>
          </div>
          {rep.verification ? (
            <p><span className={`badge ${rep.verification.now_passing === rep.verification.retested ? "ok" : "warn"}`}>Verified</span>{" "}
              Replayed {rep.verification.retested} failed conversation(s) against this prompt: <b>{rep.verification.now_passing} now pass</b>
              {rep.verification.still_failing.length > 0 && <>, still failing: {rep.verification.still_failing.join(", ")}</>}.</p>
          ) : <p className="muted">Apply this prompt to your agent, then use "Re-run same tests" to confirm the fixes.</p>}
          <pre className="mono" style={{ whiteSpace: "pre-wrap", background: "var(--soft)", padding: 12, borderRadius: 8, margin: 0 }}>{rep.patched_prompt}</pre>
        </div>)}

      <div className="card">
        <h2>Test plan and rounds</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          {rep.plan.map((p, i) => <span key={i} className={`badge ${p.priority === "high" ? "bad" : ""}`} title={p.why}>{p.risk}</span>)}
        </div>
        <table><thead><tr><th>Round</th><th>Focus</th><th>Tested</th><th>Failed</th></tr></thead><tbody>
          {rep.rounds.map((r) => <tr key={r.round}><td>{r.round}</td><td>{r.focus}</td><td>{r.tested}</td><td>{r.failed}</td></tr>)}
        </tbody></table>
        {rep.stop_reason && <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>Stopped: {rep.stop_reason}</p>}
      </div>
    </div>
  );
}
