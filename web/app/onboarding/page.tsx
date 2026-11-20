"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Onboarding() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/v1/onboarding", { method: "POST", json: { company } });
      router.replace("/agents?new=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <form className="card" style={{ width: "100%", maxWidth: 440 }} onSubmit={submit}>
        <h1>Welcome to Corella</h1>
        <p className="muted">Your free trial includes 100 test conversations a month. No card needed.</p>
        <label htmlFor="co">Company name</label>
        <input id="co" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Finance" />
        <button className="btn primary" style={{ marginTop: 14 }} disabled={busy}>{busy ? "Creating…" : "Create workspace"}</button>
        {error && <div className="alert">{error}</div>}
      </form>
    </div>
  );
}
