"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/api";

type Mode = "signin" | "signup" | "magic" | "forgot";
const GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && router.replace("/dashboard"));
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") router.replace("/reset-password");
      else if (s) router.replace("/dashboard");
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setInfo("");
    let err: { message: string } | null = null;
    if (mode === "signin") {
      ({ error: err } = await supabase.auth.signInWithPassword({ email, password }));
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/dashboard` } });
      err = error;
      if (!error && !data.session) setInfo(`We sent a confirmation link to ${email}. Click it, then sign in.`);
    } else if (mode === "magic") {
      ({ error: err } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/dashboard` } }));
      if (!err) setInfo(`Check ${email} for a sign-in link.`);
    } else {
      ({ error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` }));
      if (!err) setInfo(`If ${email} has an account, a password reset link is on its way.`);
    }
    setBusy(false);
    if (err) setError(err.message === "Invalid login credentials" ? "Wrong email or password." : err.message);
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/dashboard` } });
    if (error) setError(error.message);
  }

  const switchTo = (m: Mode) => { setMode(m); setError(""); setInfo(""); };
  const title = { signin: "Sign in", signup: "Create your account", magic: "Sign in with a link", forgot: "Reset your password" }[mode];
  const cta = { signin: "Sign in", signup: "Create account", magic: "Email me a sign-in link", forgot: "Send reset link" }[mode];
  const full = { width: "100%", justifyContent: "center" } as const;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" className="brand"><span className="dot" />Corella</Link>
        <h1>{title}</h1>
        {mode === "signup" && <p className="muted">Start free: 100 test conversations, no card needed.</p>}

        {GOOGLE && (mode === "signin" || mode === "signup") && (
          <>
            <button className="btn" style={full} onClick={google}>Continue with Google</button>
            <p className="muted" style={{ textAlign: "center", margin: "12px 0 0" }}>or</p>
          </>
        )}

        {info ? <div className="alert info">{info}</div> : (
          <form onSubmit={submit}>
            <label htmlFor="email">Work email</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            {(mode === "signin" || mode === "signup") && (
              <>
                <label htmlFor="password">Password</label>
                <input id="password" type="password" required minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : ""} />
              </>
            )}
            <button className="btn primary" style={{ ...full, marginTop: 12 }} disabled={busy}>{busy ? "Please wait…" : cta}</button>
          </form>
        )}
        {error && <div className="alert">{error}</div>}

        <div className="muted" style={{ fontSize: 14, marginTop: 14, display: "grid", gap: 6 }}>
          {mode === "signin" && <>
            <span>New to Corella? <a href="#" onClick={(e) => { e.preventDefault(); switchTo("signup"); }}>Create an account</a></span>
            <span><a href="#" onClick={(e) => { e.preventDefault(); switchTo("forgot"); }}>Forgot password?</a> · <a href="#" onClick={(e) => { e.preventDefault(); switchTo("magic"); }}>Email me a sign-in link instead</a></span>
          </>}
          {mode !== "signin" && <span>Have an account? <a href="#" onClick={(e) => { e.preventDefault(); switchTo("signin"); }}>Sign in</a></span>}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
          By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
