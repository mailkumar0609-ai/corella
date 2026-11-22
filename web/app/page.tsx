import Link from "next/link";
import HeroDemo from "@/components/HeroDemo";
import InstallApp from "@/components/InstallApp";
import { PLANS } from "@/lib/plans";
import { Mark } from "@/components/Icons";

const FAILS = [
  ["Code-mixing", "“Mera EMI kal debit hoga kya?” switches language mid-sentence. Many agents answer the wrong question."],
  ["Indian numbers and dates", "“Dedh lakh”, “saade teen baje”, “10 tareekh”: misread amounts become wrong promises."],
  ["Accents and dialects", "Bhojpuri-tinged Hindi, Tenglish, Manglish, Gujarati-Hindi: real customers don't sound like the demo."],
  ["Compliance traps", "“Manager ne bola tha fee maaf hogi.” One agreeable reply can create a liability for a lender."],
  ["Privacy pressure", "Callers asking for a spouse's or brother's account details, and pushing when refused."],
  ["Confused and angry customers", "Vague one-word replies, interruptions, ALL CAPS. Does the agent stay calm and on task?"],
];

const STEPS = [
  ["Plan", "Corella's testing agent reads your agent's job and rules, and decides which risks to attack first."],
  ["Attack", "Adaptive Indian customers talk to your agent. When it resists, they rephrase, switch language and push harder."],
  ["Learn and explore", "After each round it groups failures into root causes, then writes harder tests aimed at the weak spots."],
  ["Fix and verify", "It writes a patched system prompt and replays every failure against it to prove the fix works."],
];

const COMPARE = [
  ["13 Indian languages and code-mixed speech (Hindi, Hinglish, Tamil, Telugu, Bengali…)", true, false],
  ["Indian number, date and currency formats tested", true, false],
  ["Voice testing with Indian-accent callers, street, crowd and weak-network noise, and response-time checks", true, "Partial"],
  ["Ready-made RBI (recovery, digital lending) and DPDP compliance packs with rule-by-rule verdicts", true, "Generic"],
  ["Rupee pricing, UPI and card payments", true, false],
  ["Autonomous agent that writes and verifies a fixed prompt", true, "Partial"],
  ["Regression re-runs and CI API", true, true],
  ["Free plan to start", true, "Varies"],
];

const mark = (v: boolean | string) => (v === true ? "✓" : v === false ? "–" : v);

export default function Home() {
  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px" }}>
      <header className="spread" style={{ padding: "20px 0" }}>
        <Link href="/" className="brand" style={{ margin: 0 }}><Mark />Corella</Link>
        <nav className="row" style={{ gap: 14 }}><a href="#pricing" style={{ color: "var(--ink-2)", textDecoration: "none", fontWeight: 600 }}>Pricing</a><InstallApp /><Link href="/login" className="btn">Sign in</Link></nav>
      </header>

      <section className="hero">
        <div>
          <h1>Test your AI agent before your customers do.</h1>
          <p className="lede">Corella sends hundreds of simulated Indian customers at your chat or voice agent, in 13 languages from Hindi and Hinglish
            to Tamil, Telugu and Bengali. You see every conversation that went wrong, the exact turn it broke, and the prompt change that fixes it.</p>
          <div className="row" style={{ marginTop: 26, gap: 12 }}>
            <Link href="/login" className="btn primary lg">Start free with 100 conversations</Link>
            <a href="mailto:hello@corella.live?subject=Free%20test%20request" className="btn lg">Request a free test</a>
          </div>
          <p className="muted" style={{ fontSize: 14, marginTop: 12 }}>No card needed. First report in about three minutes.</p>
        </div>
        <HeroDemo />
      </section>

      <section className="section">
        <h2>What breaks Indian-language agents</h2>
        <p className="sub">Global testing tools are built English-first. These are the failures that reach your customers.</p>
        <div className="fails">
          {FAILS.map(([t, d]) => <div key={t}><h3>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>)}
        </div>
      </section>

      <section className="section">
        <h2>An AI agent that tests your AI agent</h2>
        <p className="sub">Not a script runner. Corella hunts for failures the way your best QA engineer would, then hands you the fix.</p>
        <div className="steps">
          {STEPS.map(([t, d]) => <div key={t}><h3>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>)}
        </div>
      </section>

      <section className="section">
        <h2>Built for India, not translated for it</h2>
        <div className="card" style={{ marginTop: 18, overflowX: "auto", padding: 0 }}>
          <table><thead><tr><th style={{ paddingLeft: 22 }}>What you get</th><th>Corella</th><th>English-first global tools</th></tr></thead><tbody>
            {COMPARE.map(([f, a, b]) => <tr key={f as string}><td style={{ paddingLeft: 22 }}>{f}</td><td><b style={{ color: "var(--ok)" }}>{mark(a)}</b></td><td className="muted">{mark(b)}</td></tr>)}
          </tbody></table>
        </div>
      </section>

      <section id="pricing" className="section">
        <h2>Pricing</h2>
        <p className="sub">Start free. Upgrade when Corella is catching bugs your team would have missed.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 16 }}>
          {PLANS.map((p) => (
            <div key={p.id} className="card" style={p.id === "growth" ? { borderColor: "var(--accent)" } : undefined}>
              {p.id === "growth" && <span className="badge">Most popular</span>}
              <h3 style={{ marginTop: 6 }}>{p.name}</h3>
              <p style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{p.price}<span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>{p.per}</span></p>
              <ul style={{ paddingLeft: 18 }}>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              {p.id === "enterprise"
                ? <a className="btn" href="mailto:hello@corella.live?subject=Corella%20Enterprise">Talk to us</a>
                : <Link className={`btn ${p.id === "growth" ? "primary" : ""}`} href="/login">{p.id === "trial" ? "Start free" : "Start free, upgrade anytime"}</Link>}
            </div>))}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>Prices in INR; GST added only where applicable. One-time pre-launch audits from ₹50,000.</p>
      </section>

      <section className="card" style={{ margin: "32px 0", textAlign: "center", padding: 36 }}>
        <h2 style={{ fontSize: 26 }}>Building an AI agent for your customers? We&apos;ll test it free.</h2>
        <p className="muted">Send us your agent's number or endpoint. We'll run 100 simulated Indian customers and send you the failure report, free.</p>
        <a href="mailto:hello@corella.live?subject=Free%20test%20request" className="btn primary">Request a free test</a>
      </section>

      <footer className="spread muted" style={{ padding: "24px 0 40px", fontSize: 13, borderTop: "1px solid var(--line)" }}>
        <span>© {new Date().getFullYear()} PARKEASE BREAKTHROUGH VENTURE PVT LTD. Made in India.</span>
        <span className="row" style={{ flexWrap: "wrap" }}><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refunds">Refunds</Link><Link href="/delivery">Delivery</Link><Link href="/contact">Contact</Link></span>
      </footer>
    </div>
  );
}
