import Link from "next/link";
import { PLANS } from "@/lib/plans";

const FAILS = [
  ["Code-mixing", "“Mera EMI kal debit hoga kya?” switches language mid-sentence. Many agents answer the wrong question."],
  ["Indian numbers and dates", "“Dedh lakh”, “saade teen baje”, “10 tareekh”: misread amounts become wrong promises."],
  ["Accents and dialects", "Bhojpuri-accented Hindi, Tamil-English, Bengali-Hindi: real callers don't sound like the demo."],
  ["Compliance traps", "“Manager ne bola tha fee maaf hogi.” One agreeable reply can create a liability for a lender."],
  ["Privacy pressure", "Callers asking for a spouse's or brother's account details, and pushing when refused."],
  ["Confused and angry customers", "Vague one-word replies, interruptions, ALL CAPS. Does the agent stay calm and on task?"],
];

const STEPS = [
  ["Connect", "Point Corella at your agent's chat endpoint, or paste its system prompt."],
  ["Simulate", "Hundreds of synthetic Indian customers talk to it at once, each with a goal and a personality."],
  ["Score", "Every conversation is graded on task success, accuracy, compliance, language and tone."],
  ["Fix and re-run", "See the exact turn that failed with a suggested prompt fix, then re-run the same tests to prove it's fixed."],
];

const COMPARE = [
  ["Personas built for Indian callers (Hindi, Hinglish, regional)", true, false],
  ["Indian number, date and currency formats tested", true, false],
  ["BFSI compliance checks (lending, collections, insurance)", true, "Generic"],
  ["Rupee pricing, GST invoices, UPI payments", true, false],
  ["Regression re-runs and CI API", true, true],
  ["Free plan to start", true, "Varies"],
];

const mark = (v: boolean | string) => (v === true ? "✓" : v === false ? "–" : v);

export default function Home() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px" }}>
      <header className="spread" style={{ padding: "18px 0" }}>
        <Link href="/" className="brand" style={{ margin: 0 }}><span className="dot" />Corella</Link>
        <nav className="row"><a href="#pricing" className="muted">Pricing</a><Link href="/login" className="btn">Sign in</Link></nav>
      </header>

      <section style={{ padding: "64px 0 40px", maxWidth: 760 }}>
        <span className="badge">For teams shipping voice and chat agents in India</span>
        <h1 style={{ fontSize: "clamp(34px,6vw,54px)", margin: "16px 0" }}>Test your AI agent before your customers do.</h1>
        <p style={{ fontSize: 19 }} className="muted">
          Corella sends hundreds of simulated Indian customers at your agent, speaking Hindi, Hinglish and regional accents,
          and shows you every conversation that went wrong, the exact turn it failed, and how to fix the prompt.
        </p>
        <div className="row" style={{ marginTop: 22 }}>
          <Link href="/login" className="btn primary" style={{ padding: "12px 20px" }}>Start free, 100 conversations</Link>
          <a href="mailto:hello@corella.live?subject=Free%20failure%20report" className="btn" style={{ padding: "12px 20px" }}>Get a free failure report</a>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>No card needed. Results in minutes.</p>
      </section>

      <section style={{ padding: "32px 0" }}>
        <h2 style={{ fontSize: 28 }}>What breaks Indian-language agents</h2>
        <p className="muted">Global testing tools are built English-first. These are the failures that reach your customers.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", marginTop: 16 }}>
          {FAILS.map(([t, d]) => <div key={t} className="card"><h3>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>)}
        </div>
      </section>

      <section style={{ padding: "32px 0" }}>
        <h2 style={{ fontSize: 28 }}>How it works</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 16 }}>
          {STEPS.map(([t, d], i) => (
            <div key={t} className="card"><div className="badge" style={{ marginBottom: 8 }}>{i + 1}</div><h3>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>))}
        </div>
      </section>

      <section style={{ padding: "32px 0" }}>
        <h2 style={{ fontSize: 28 }}>Built for India, not translated for it</h2>
        <div className="card" style={{ marginTop: 16, overflowX: "auto" }}>
          <table><thead><tr><th /><th>Corella</th><th>English-first global tools</th></tr></thead><tbody>
            {COMPARE.map(([f, a, b]) => <tr key={f as string}><td>{f}</td><td><b style={{ color: "var(--ok)" }}>{mark(a)}</b></td><td className="muted">{mark(b)}</td></tr>)}
          </tbody></table>
        </div>
      </section>

      <section id="pricing" style={{ padding: "32px 0" }}>
        <h2 style={{ fontSize: 28 }}>Pricing</h2>
        <p className="muted">Start free. Upgrade when Corella is catching bugs your team would have missed.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 16 }}>
          {PLANS.map((p) => (
            <div key={p.id} className="card" style={p.id === "growth" ? { borderColor: "var(--accent)" } : undefined}>
              {p.id === "growth" && <span className="badge">Most popular</span>}
              <h3 style={{ marginTop: 6 }}>{p.name}</h3>
              <p style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{p.price}<span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>{p.per}</span></p>
              <ul style={{ paddingLeft: 18 }}>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              {p.id === "enterprise"
                ? <a className="btn" href="mailto:sales@corella.live?subject=Corella%20Enterprise">Talk to us</a>
                : <Link className={`btn ${p.id === "growth" ? "primary" : ""}`} href="/login">{p.id === "trial" ? "Start free" : "Start free, upgrade anytime"}</Link>}
            </div>))}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>Prices exclude 18% GST. One-time pre-launch audits from ₹50,000.</p>
      </section>

      <section className="card" style={{ margin: "32px 0", textAlign: "center", padding: 36 }}>
        <h2 style={{ fontSize: 26 }}>Launching an agent soon?</h2>
        <p className="muted">Send us your agent's number or endpoint. We'll run 100 simulated Indian customers and send you the failure report, free.</p>
        <a href="mailto:hello@corella.live?subject=Free%20failure%20report" className="btn primary">Get my free failure report</a>
      </section>

      <footer className="spread muted" style={{ padding: "24px 0 40px", fontSize: 13, borderTop: "1px solid var(--line)" }}>
        <span>© {new Date().getFullYear()} Corella · Made in Patna, India</span>
        <span className="row"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><a href="mailto:hello@corella.live">hello@corella.live</a></span>
      </footer>
    </div>
  );
}
