import type { Metadata } from "next";
import Link from "next/link";
import ComplianceTable, { type RuleVerdict } from "@/components/ComplianceTable";
import ResultCard, { type CardRow } from "@/components/ResultCard";
import { API } from "@/lib/api";
import { Mark } from "@/components/Icons";

type Shared = {
  agent: string; created_at: string; mode: string;
  summary: { total: number; passed: number; failed: number; errors: number; averages: Record<string, number>; compliance?: RuleVerdict[] } | null;
  root_causes: { cause: string; severity: string; count: number }[];
  results: CardRow[];
};

export const dynamic = "force-dynamic";

async function load(token: string): Promise<Shared | null> {
  try {
    const r = await fetch(`${API}/v1/public/reports/${encodeURIComponent(token)}`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const d = await load((await params).token);
  const t = d?.summary ? `${d.agent}: ${d.summary.failed} of ${d.summary.total} test conversations failed` : "Corella test report";
  return { title: `${t} | Corella`, description: "AI agent test report: simulated Indian customers in Hindi, Hinglish and regional languages.",
    robots: { index: false, follow: false }, openGraph: { title: t } };
}

const SEV: Record<string, string> = { critical: "bad", high: "bad", medium: "warn", low: "" };

export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const d = await load((await params).token);
  if (!d) return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: 16, textAlign: "center" }}>
      <Link href="/" className="brand"><Mark />Corella</Link>
      <h1>Report not available</h1>
      <p className="muted">This link is invalid or its owner turned it off.</p>
    </div>);
  const s = d.summary;
  const rate = s && s.total ? Math.round((s.passed / s.total) * 100) : 0;
  const sorted = [...d.results].sort((a, b) => Number(a.passed) - Number(b.passed));
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 64px" }}>
      <div className="spread">
        <Link href="/" className="brand"><Mark />Corella</Link>
        <Link href="/login" className="btn primary">Test your own agent free</Link>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>AI agent test report · {new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
      <h1 style={{ marginTop: 4 }}>{d.agent}</h1>
      {s && <p style={{ fontSize: 18 }}>Corella's simulated customers held <b>{s.total} conversations</b> with this agent in Indian languages.{" "}
        <b>{s.failed} failed</b>{s.failed ? " (details below)." : "."}</p>}

      {s && (<div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", margin: "16px 0" }}>
        <div className="card stat"><div className="n">{rate}%</div><div className="l">Pass rate</div></div>
        <div className="card stat"><div className="n">{s.failed}</div><div className="l">Failed of {s.total}</div></div>
        {Object.entries(s.averages).filter(([, v]) => typeof v === "number").map(([k, v]) => <div key={k} className="card stat"><div className="n">{v}</div><div className="l">{k.replace("_", " ")} (avg /5)</div></div>)}
      </div>)}

      <ComplianceTable rules={s?.compliance} />
      {d.root_causes.length > 0 && (<div className="card" style={{ marginBottom: 16 }}>
        <h2>Why it fails</h2>
        {d.root_causes.map((c, i) => (
          <p key={i} style={{ margin: "8px 0" }}><span className={`badge ${SEV[c.severity] ?? ""}`}>{c.severity}</span> {c.cause}
            {c.count > 0 && <span className="muted"> · {c.count} conversation{c.count > 1 ? "s" : ""}</span>}</p>))}
        <p className="muted" style={{ fontSize: 14, marginBottom: 0 }}>Corella also writes a corrected prompt that fixes these issues and re-tests it. That&apos;s visible to the agent&apos;s owner only.</p>
      </div>)}

      <h2>Conversations</h2>
      <div className="grid">{sorted.map((r) => <ResultCard key={r.scenario.id} r={r} />)}</div>

      <div className="card" style={{ marginTop: 24, textAlign: "center" }}>
        <h2>How would your agent do?</h2>
        <p className="muted">Corella tests chat agents with realistic customers in 13 Indian languages, finds why they fail and writes the fix. 100 test conversations free, no card needed.</p>
        <Link href="/login" className="btn primary">Start free</Link>
      </div>
    </div>
  );
}
