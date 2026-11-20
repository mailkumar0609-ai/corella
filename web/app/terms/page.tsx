import Link from "next/link";

export const metadata = { title: "Terms of Service | Corella" };

// PLACEHOLDER: replace with the final text drafted with a lawyer before taking payments.
export default function Page() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
      <Link href="/" className="brand"><span className="dot" />Corella</Link>
      <h1>Terms of Service</h1>
      <p className="muted">This page is being finalised. For questions, write to <a href="mailto:hello@corella.live">hello@corella.live</a>.</p>
    </div>
  );
}
