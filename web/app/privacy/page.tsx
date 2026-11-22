import Legal, { CONTACT } from "@/components/Legal";

export const metadata = { title: "Privacy Policy | Corella" };

export default function Page() {
  return (
    <Legal title="Privacy Policy">
      <p>This policy explains how Corella (operated by PARKEASE BREAKTHROUGH VENTURE PRIVATE LIMITED, Patna, Bihar, India) collects and uses personal data when you use corella.live and the Corella API. We handle personal data in line with the Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;) and the Information Technology Act, 2000 and its rules.</p>

      <h2>1. What we collect</h2>
      <ul>
        <li><b>Account data:</b> your name if provided, email address, company name, and login records (such as sign-in times and IP address).</li>
        <li><b>Billing data:</b> plan, subscription status and payment references. Card, UPI and bank details are collected and processed by Razorpay. We never see or store them.</li>
        <li><b>Customer Data:</b> the agent descriptions, rules, endpoints, credentials, system prompts, generated test conversations and reports in your workspace. Test conversations are synthetic. Please do not put real customers&apos; personal data into them.</li>
        <li><b>Technical data:</b> logs needed to run, debug and secure the Service, such as request times, errors and API usage counts.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>to create and secure your account and provide the Service (performance of our contract with you, and your consent under the DPDP Act);</li>
        <li>to bill you and meet tax and accounting obligations (legal obligation);</li>
        <li>to send service emails such as sign-in links, run results and important changes;</li>
        <li>to prevent abuse and fix problems.</li>
      </ul>
      <p>We do not sell personal data, show ads, or use your Customer Data to train AI models.</p>

      <h2>3. Who processes it for us</h2>
      <p>We share data only with the providers needed to run the Service, under their contractual data protection terms:</p>
      <ul>
        <li>Supabase: database and authentication (data stored in Mumbai, India)</li>
        <li>Render: API hosting (Singapore)</li>
        <li>Vercel: website hosting</li>
        <li>Anthropic: AI models that simulate conversations and evaluate replies (United States). Under its commercial terms, API data is not used to train its models.</li>
        <li>Razorpay: payments (India)</li>
        <li>Our email delivery provider: transactional emails</li>
      </ul>
      <p>Some processing therefore takes place outside India, as permitted under the DPDP Act. We may also disclose data where the law requires it.</p>

      <h2>4. Security</h2>
      <p>Data is encrypted in transit (HTTPS). Agent credentials and system prompts are additionally encrypted at rest. API keys are stored only as one-way hashes. Our database is not exposed through public APIs. Access is limited to what is needed to operate the Service.</p>

      <h2>5. How long we keep it</h2>
      <p>We keep account and Customer Data while your account is active. After you close your account we delete it within 90 days, except billing records, which we keep as tax law requires (generally 8 years).</p>

      <h2>6. Your rights</h2>
      <p>Under the DPDP Act you can ask to access, correct, update or erase your personal data, withdraw consent, and nominate someone to exercise your rights. Write to {CONTACT}. We respond within 30 days. If you are not satisfied, you may complain to the Data Protection Board of India.</p>

      <h2>7. Cookies</h2>
      <p>We use only essential browser storage to keep you signed in. We do not use advertising or cross-site tracking cookies.</p>

      <h2>8. Children</h2>
      <p>The Service is for businesses and is not directed at anyone under 18.</p>

      <h2>9. Grievance officer</h2>
      <p>Munna Kumar, Grievance Officer, PARKEASE BREAKTHROUGH VENTURE PRIVATE LIMITED (Corella), Patna, Bihar, India. Email: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We acknowledge grievances within 48 hours and aim to resolve them within 30 days.</p>

      <h2>10. Changes</h2>
      <p>We will post updates here and email you about material changes.</p>
    </Legal>
  );
}
