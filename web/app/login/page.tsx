"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && router.replace("/dashboard"));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && router.replace("/dashboard"));
    return () => data.subscription.unsubscribe();
  }, [router]);

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setBusy(false);
    error ? setError(error.message) : setSent(true);
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setError(error.message);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" className="brand"><span className="dot" />Corella</Link>
        <h1>Sign in</h1>
        <p className="muted">New here? Signing in creates your free trial workspace.</p>
        {sent ? (
          <div className="alert info">Check <b>{email}</b> for a sign-in link.</div>
        ) : (
          <>
            <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={google}>Continue with Google</button>
            <form onSubmit={magicLink}>
              <label htmlFor="email">Work email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          </>
        )}
        {error && <div className="alert">{error}</div>}
        <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
          By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
