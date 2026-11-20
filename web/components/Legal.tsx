import Link from "next/link";

export const CONTACT = "hello@corella.live";
export const UPDATED = "21 November 2026";

export default function Legal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal" style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px 64px", lineHeight: 1.65 }}>
      <Link href="/" className="brand"><span className="dot" />Corella</Link>
      <h1 style={{ marginBottom: 4 }}>{title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>Last updated: {UPDATED}</p>
      {children}
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "32px 0 16px" }} />
      <p className="muted" style={{ fontSize: 13, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refunds">Refunds &amp; cancellation</Link>
        <Link href="/delivery">Service delivery</Link><Link href="/contact">Contact</Link>
      </p>
    </div>
  );
}
