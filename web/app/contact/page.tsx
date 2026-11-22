import Legal, { CONTACT } from "@/components/Legal";

export const metadata = { title: "Contact | Corella" };

export default function Page() {
  return (
    <Legal title="Contact us">
      <p>We usually reply within one working day (Monday–Saturday, 10:00–18:00 IST).</p>
      <ul>
        <li><b>Email:</b> <a href={`mailto:${CONTACT}`}>{CONTACT}</a></li>
        <li><b>Sales, demos and enterprise plans:</b> <a href={`mailto:${CONTACT}?subject=Corella%20demo`}>{CONTACT}</a></li>
        <li><b>Billing, refunds and grievances:</b> <a href={`mailto:${CONTACT}?subject=Billing`}>{CONTACT}</a></li>
        <li><b>Business:</b> Corella is a product of PARKEASE BREAKTHROUGH VENTURE PRIVATE LIMITED, Patna, Bihar, India</li>
      </ul>
    </Legal>
  );
}
