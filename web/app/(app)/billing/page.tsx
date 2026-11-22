"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import { api } from "@/lib/api";
import { PLANS } from "@/lib/plans";

declare global { interface Window { Razorpay?: any } }

type Usage = { period_start: string; used: number; limit: number; remaining: number; runs: number;
  by_day: { date: string; conversations: number }[]; by_agent: { agent: string; conversations: number }[] };

function UsageCard({ u }: { u: Usage }) {
  const pct = Math.min(100, Math.round((u.used / Math.max(u.limit, 1)) * 100));
  const peak = Math.max(1, ...u.by_day.map((d) => d.conversations));
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="spread"><h2 style={{ margin: 0 }}>Usage this month</h2>
        <span className="muted" style={{ fontSize: 14 }}>since {new Date(u.period_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · resets on the 1st</span></div>
      <p style={{ margin: "10px 0 6px" }}><b>{u.used.toLocaleString("en-IN")}</b> of {u.limit.toLocaleString("en-IN")} test conversations used
        <span className="muted"> · {u.remaining.toLocaleString("en-IN")} left · {u.runs} run{u.runs === 1 ? "" : "s"}</span></p>
      <div style={{ height: 10, borderRadius: 6, background: "var(--line)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 90 ? "var(--bad, #c0392b)" : "var(--accent)" }} />
      </div>
      {pct >= 90 && <p className="muted" style={{ fontSize: 14 }}>You&apos;re close to your limit. New runs pause when it&apos;s reached. Upgrade to keep testing.</p>}
      {u.by_day.length > 0 && (<>
        <h3 style={{ marginTop: 16 }}>By day</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }} aria-label="Conversations per day">
          {u.by_day.map((d) => (
            <div key={d.date} title={`${d.date}: ${d.conversations}`} style={{ flex: 1, maxWidth: 28, height: `${Math.max(6, (d.conversations / peak) * 100)}%`,
              background: "var(--accent)", borderRadius: 3, opacity: 0.85 }} />))}
        </div>
      </>)}
      {u.by_agent.length > 0 && (<>
        <h3 style={{ marginTop: 16 }}>By agent</h3>
        <table><tbody>{u.by_agent.map((a) => <tr key={a.agent}><td>{a.agent}</td><td style={{ textAlign: "right" }}>{a.conversations.toLocaleString("en-IN")}</td></tr>)}</tbody></table>
      </>)}
    </div>
  );
}

export default function Billing() {
  const { me, refresh } = useMe();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const current = me.organization.plan;
  const owner = me.user?.role === "owner";
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => { api<Usage>("/v1/usage").then(setUsage).catch(() => {}); }, []);

  async function buy(plan: string) {
    setBusy(plan); setError(""); setMsg("");
    try {
      const c = await api<{ subscription_id: string; key_id: string; short_url?: string }>("/v1/billing/checkout", { method: "POST", json: { plan } });
      if (!window.Razorpay) { if (c.short_url) window.location.href = c.short_url; return; }
      new window.Razorpay({
        key: c.key_id, subscription_id: c.subscription_id, name: "Corella", description: `${plan} plan`,
        prefill: { email: me.user?.email }, theme: { color: "#e0563f" },
        handler: () => { setMsg("Payment received. Your plan updates within a minute."); setTimeout(refresh, 5000); },
        modal: { ondismiss: () => setBusy("") },
      }).open();
    } catch (e) { setError(e instanceof Error ? e.message : "Checkout failed"); }
    setBusy("");
  }

  async function cancel() {
    if (!confirm("Cancel your subscription? You keep your plan until the end of the billing period.")) return;
    try { setMsg((await api<{ note: string }>("/v1/billing/cancel", { method: "POST" })).note); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not cancel"); }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="page-head"><div><h1>Plan &amp; billing</h1><p>Your plan, this month&apos;s usage and payments.</p></div></div>
      <p className="muted">Current plan: <span className="badge">{current}</span>{me.organization.subscription_status && <> · {me.organization.subscription_status}</>}</p>
      {msg && <div className="alert info">{msg}</div>}
      {error && <div className="alert">{error}</div>}
      {usage && <UsageCard u={usage} />}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 16 }}>
        {PLANS.map((p) => (
          <div key={p.id} className="card" style={p.id === current ? { borderColor: "var(--accent)" } : undefined}>
            <h2>{p.name}</h2>
            <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0" }}>{p.price}<span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>{p.per}</span></p>
            <ul style={{ paddingLeft: 18, margin: "10px 0 16px" }}>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            {p.id === current ? <span className="badge ok">Current plan</span>
              : p.id === "enterprise" ? <a className="btn" href="mailto:hello@corella.live?subject=Corella%20Enterprise">Talk to us</a>
              : p.id === "trial" ? null
              : <button className="btn primary" disabled={!owner || !!busy} onClick={() => buy(p.id)}>{busy === p.id ? "Opening…" : `Choose ${p.name}`}</button>}
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>Prices in INR; GST is added only where applicable. Pay by card, UPI or netbanking via Razorpay. Cancel any time.</p>
      {owner && me.organization.subscription_status === "active" && <button className="btn danger" onClick={cancel}>Cancel subscription</button>}
    </>
  );
}
