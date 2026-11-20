import Legal, { CONTACT } from "@/components/Legal";

export const metadata = { title: "Service Delivery Policy | Corella" };

export default function Page() {
  return (
    <Legal title="Service Delivery Policy">
      <p>Corella is a software-as-a-service product delivered online. No physical goods are shipped.</p>
      <ul>
        <li><b>Free trial:</b> available immediately after you create an account at corella.live.</li>
        <li><b>Paid plans:</b> activated automatically within minutes of a successful payment, and the higher limits appear on your Billing page. If they don&apos;t appear within 1 hour, email {CONTACT} with your payment reference.</li>
        <li><b>Test runs:</b> processed in the cloud, usually within minutes depending on size. Results are available in your dashboard and through the API.</li>
        <li><b>Invoices:</b> sent by email to the account address after each payment.</li>
      </ul>
      <p>Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </Legal>
  );
}
