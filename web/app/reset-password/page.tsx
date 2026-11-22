"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/api";
import { Mark } from "@/components/Icons";

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    error ? setError(error.message) : router.replace("/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" className="brand"><Mark />Corella</Link>
        <h1>Choose a new password</h1>
        {!ready ? (
          <p className="muted">Open this page from the reset link in your email. Link expired? <Link href="/login">Request a new one</Link>.</p>
        ) : (
          <form onSubmit={save}>
            <label htmlFor="password">New password</label>
            <input id="password" type="password" autoComplete="new-password" required minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} disabled={busy}>
              {busy ? "Saving…" : "Save and continue"}
            </button>
          </form>
        )}
        {error && <div className="alert">{error}</div>}
      </div>
    </div>
  );
}
