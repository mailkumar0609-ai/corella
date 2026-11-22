import Legal, { CONTACT } from "@/components/Legal";

export const metadata = { title: "Terms of Service | Corella" };

export default function Page() {
  return (
    <Legal title="Terms of Service">
      <p>These Terms govern your use of Corella (the &quot;Service&quot;), available at corella.live, operated by PARKEASE BREAKTHROUGH VENTURE PRIVATE LIMITED, a private limited company incorporated in India with its office in Patna, Bihar (&quot;Corella&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or using the Service, you agree to these Terms on behalf of yourself and the organisation you represent (&quot;you&quot;, &quot;Customer&quot;).</p>

      <h2>1. The Service</h2>
      <p>Corella tests conversational AI agents (chat and voice bots). It generates simulated customer conversations, sends them to an agent you connect, evaluates the agent&apos;s replies, and reports failures, likely root causes and suggested prompt changes. Results are produced by automated AI models and are guidance only: they may be incomplete or wrong, and you remain responsible for reviewing them and for how your agent behaves in production.</p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must be at least 18 and able to enter a binding contract.</li>
        <li>Keep your login and API keys confidential. You are responsible for all activity under your account and keys. Tell us promptly at {CONTACT} if you suspect misuse.</li>
        <li>Account information you give us must be accurate and kept up to date.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You may only test agents that you own or are authorised to test. You must not:</p>
      <ul>
        <li>point the Service at systems you are not authorised to test, or use it to overload, attack or gain unauthorised access to any system;</li>
        <li>use the Service to generate unlawful, harassing or deceptive content aimed at real people, or to contact real people;</li>
        <li>submit real customers&apos; personal data in agent descriptions, rules or scenarios unless you have a lawful basis to do so;</li>
        <li>reverse engineer, resell or provide the Service to third parties without our written consent, or circumvent plan limits;</li>
        <li>use the Service in breach of any law, including the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.</li>
      </ul>
      <p>We may suspend access that we reasonably believe breaches this section, and will tell you why where we lawfully can.</p>

      <h2>4. Your data</h2>
      <p>You keep all rights in the agent configurations, prompts, credentials, rules, transcripts and reports associated with your account (&quot;Customer Data&quot;). You grant us a limited licence to host, process and transmit Customer Data solely to provide, secure and support the Service. We do not use Customer Data to train AI models, and we do not sell it. Credentials and system prompts you store are encrypted at rest. Our <a href="/privacy">Privacy Policy</a> explains how we handle personal data.</p>

      <h2>5. Plans, fees and taxes</h2>
      <ul>
        <li>Paid plans are billed monthly in advance in Indian Rupees through our payment partner, Razorpay, and renew automatically until cancelled. Prices on our website exclude GST, which is added where applicable.</li>
        <li>Each plan includes a monthly allowance of test conversations and agents. Unused allowance does not roll over. When you reach a limit, new runs are paused until the next cycle or an upgrade.</li>
        <li>We may change prices with at least 30 days&apos; notice by email. Changes apply from your next billing cycle.</li>
        <li>If a payment fails, we may downgrade your account to the free trial plan after reasonable notice.</li>
        <li>Refunds and cancellation are covered by our <a href="/refunds">Refund &amp; Cancellation Policy</a>.</li>
      </ul>

      <h2>6. Third-party services</h2>
      <p>The Service relies on providers for hosting, databases, authentication, AI models and payments (listed in our Privacy Policy). Your agent and any third-party systems you connect are outside our control, and we are not responsible for them.</p>

      <h2>7. Our intellectual property</h2>
      <p>The Service, its software, personas, scenario libraries, design and the &quot;Corella&quot; name belong to us. Apart from the right to use the Service under these Terms, no rights are granted to you. Feedback you send us may be used freely to improve the Service.</p>

      <h2>8. Availability and changes</h2>
      <p>We aim to keep the Service available and secure but do not guarantee uninterrupted or error-free operation. We may improve or change features. If we materially reduce a paid feature, we will give notice and you may cancel.</p>

      <h2>9. Disclaimer</h2>
      <p>To the extent permitted by law, the Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express or implied, including fitness for a particular purpose. Passing Corella&apos;s tests does not certify that an agent is compliant with any law or regulation, including RBI, IRDAI or SEBI requirements.</p>

      <h2>10. Limitation of liability</h2>
      <p>To the extent permitted by law, we are not liable for indirect, incidental, special or consequential losses, or for loss of profits, revenue, data or goodwill. Our total liability arising out of or relating to the Service in any 12-month period is limited to the fees you paid us in those 12 months, or ₹5,000 if you have not paid any fees.</p>

      <h2>11. Indemnity</h2>
      <p>You will indemnify us against third-party claims arising from your Customer Data, the agents you test, or your breach of these Terms or applicable law.</p>

      <h2>12. Term and termination</h2>
      <p>You may stop using the Service and cancel at any time from the Billing page. We may terminate or suspend your account for material breach of these Terms. On termination your access ends. You may ask us to export or delete your Customer Data, and we will otherwise delete it within 90 days, except where we must keep records by law.</p>

      <h2>13. Governing law and disputes</h2>
      <p>These Terms are governed by the laws of India. The courts at Patna, Bihar have exclusive jurisdiction, subject to any rights you have under consumer protection law. Before going to court, both sides agree to try to resolve a dispute in good faith for 30 days after written notice.</p>

      <h2>14. Changes to these Terms</h2>
      <p>We may update these Terms. Material changes will be notified by email or in the app at least 15 days before they take effect. Continuing to use the Service after that date means you accept them.</p>

      <h2>15. Contact</h2>
      <p>PARKEASE BREAKTHROUGH VENTURE PRIVATE LIMITED (Corella), Patna, Bihar, India. Email: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </Legal>
  );
}
