"use client";
import { useState } from "react";
import type { Failure } from "@/lib/api";

const METRICS = ["task_success", "accuracy", "compliance", "language_handling", "tone"];

export type CardRow = {
  passed: boolean; error: string | boolean | null;
  scenario: { id: string; goal: string; persona: string; success?: string };
  score: Record<string, any> & { failures?: Failure[]; summary?: string };
  transcript: { role: "customer" | "agent"; content: string; latency_ms?: number; agent_heard?: string; noise?: string }[];
};

export default function ResultCard({ r }: { r: CardRow }) {
  const [open, setOpen] = useState(!r.passed);
  const bad = new Set((r.score.failures || []).map((f) => f.turn));
  let n = 0;
  return (
    <div className="card">
      <div className="spread" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <div><span className={`badge ${r.error ? "warn" : r.passed ? "ok" : "bad"}`}>{r.error ? "Error" : r.passed ? "Pass" : "Fail"}</span>{" "}
          <b>{r.scenario.id.replace(/_/g, " ")}</b> <span className="muted">· {r.scenario.persona.replace(/_/g, " ")}</span></div>
        <span className="muted">{r.score.summary || (typeof r.error === "string" ? r.error : r.error ? "Could not complete" : "")}</span>
      </div>
      {open && (<div style={{ marginTop: 12 }}>
        <p className="muted" style={{ fontSize: 14 }}><b>Goal:</b> {r.scenario.goal}{r.scenario.success && <><br /><b>Expected:</b> {r.scenario.success}</>}</p>
        <div className="row">{METRICS.map((m) => <span key={m} className="badge">{m.replace("_", " ")} {r.score[m] ?? "–"}/5</span>)}</div>
        {(r.score.failures || []).map((f, i) => (
          <div key={i} className="fix"><b>{f.category}</b> · agent turn {f.turn}: {f.issue}<br /><span><b>Suggested fix:</b> {f.suggested_fix}</span></div>
        ))}
        <div style={{ marginTop: 10 }}>
          {r.transcript.map((t, i) => {
            if (t.role === "agent") n++;
            return (<div key={i}>
              {t.agent_heard !== undefined && <div className="hint" style={{ margin: "2px 0 2px", fontStyle: "italic" }}>Agent heard: &ldquo;{t.agent_heard || "(nothing)"}&rdquo;</div>}
              <div className={`msg ${t.role} ${t.role === "agent" && bad.has(n) ? "flag" : ""}`}><span className="who">{t.role}
                {t.latency_ms !== undefined && <span className={`badge ${t.latency_ms > 3000 ? "bad" : t.latency_ms > 1500 ? "warn" : "ok"}`} style={{ marginLeft: 6, fontSize: 11 }}>{(t.latency_ms / 1000).toFixed(1)}s</span>}
              </span>{t.content}</div>
            </div>);
          })}
        </div>
      </div>)}
    </div>
  );
}

