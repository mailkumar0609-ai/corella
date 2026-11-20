"use client";
import Script from "next/script";
import { useState } from "react";
import { useMe } from "@/components/AppShell";
import { api } from "@/lib/api";
import { PLANS } from "@/lib/plans";

declare global { interface Window { Razorpay?: any } }

export default function Billing() {
  const { me, refresh } = useMe();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const current = me.organization.plan;
  const owner = me.user?.role === "owner";

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
      <h1>Billing</h1>
      <p className="muted">Current plan: <span className="badge">{current}</span>{me.organization.subscription_status && <> · {me.organization.subscription_status}</>}</p>
      {msg && <div className="alert info">{msg}</div>}
      {error && <div className="alert">{error}</div>}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 16 }}>
        {PLANS.map((p) => (
          <div key={p.id} className="card" style={p.id === current ? { borderColor: "var(--accent)" } : undefined}>
            <h2>{p.name}</h2>
            <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0" }}>{p.price}<span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>{p.per}</span></p>
            <ul style={{ paddingLeft: 18, margin: "10px 0 16px" }}>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            {p.id === current ? <span className="badge ok">Current plan</span>
              : p.id === "enterprise" ? <a className="btn" href="mailto:sales@corella.live?subject=Corella%20Enterprise">Talk to us</a>
              : p.id === "trial" ? null
              : <button className="btn primary" disabled={!owner || !!busy} onClick={() => buy(p.id)}>{busy === p.id ? "Opening…" : `Choose ${p.name}`}</button>}
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>Prices exclude 18% GST. Payments by UPI, cards and netbanking via Razorpay. Cancel any time.</p>
      {owner && me.organization.subscription_status === "active" && <button className="btn danger" onClick={cancel}>Cancel subscription</button>}
    </>
  );
}
