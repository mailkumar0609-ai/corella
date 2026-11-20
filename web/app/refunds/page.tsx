import Legal, { CONTACT } from "@/components/Legal";

export const metadata = { title: "Refund & Cancellation Policy | Corella" };

export default function Page() {
  return (
    <Legal title="Refund & Cancellation Policy">
      <h2>Free trial</h2>
      <p>Every new workspace starts on a free trial plan (100 test conversations a month, no card required), so you can evaluate Corella before paying.</p>

      <h2>Cancellation</h2>
      <ul>
        <li>You can cancel a paid subscription at any time from <b>Billing → Cancel subscription</b>, or by emailing {CONTACT} from your account email.</li>
        <li>Cancellation stops future renewals. Your paid plan stays active until the end of the current billing period, then your workspace moves to the free trial plan. Your data is not deleted when you cancel.</li>
      </ul>

      <h2>Refunds</h2>
      <ul>
        <li>Subscription fees are charged monthly in advance and are generally non-refundable for a period that has started.</li>
        <li><b>First payment:</b> if you are not satisfied with your first paid month, email us within 7 days of the payment and we will refund it in full, provided you have used less than 10% of that month&apos;s conversation allowance.</li>
        <li><b>Billing errors:</b> duplicate charges, charges after a confirmed cancellation, or incorrect amounts are refunded in full.</li>
        <li><b>Service failures:</b> if the Service is unavailable for more than 72 consecutive hours because of a fault on our side, we will refund that period on a pro-rata basis on request.</li>
      </ul>

      <h2>How refunds are paid</h2>
      <p>Approved refunds are issued to the original payment method through Razorpay within 5–7 working days of approval. Your bank may take a few more days to show the credit.</p>

      <h2>Contact</h2>
      <p>For refund or cancellation requests, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with your workspace name and payment reference.</p>
    </Legal>
  );
}
