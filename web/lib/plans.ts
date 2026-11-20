// Display copy for plans. Limits are enforced by the API (src/corella/config.py); keep the two in sync.
export const PLANS = [
  { id: "trial", name: "Free", price: "₹0", per: "", features: ["100 test conversations / month", "1 agent", "All Indian personas", "Shareable failure reports"] },
  { id: "starter", name: "Starter", price: "₹4,999", per: " /month", features: ["1,000 conversations / month", "1 agent", "Regression re-runs", "API access for CI"] },
  { id: "growth", name: "Growth", price: "₹24,999", per: " /month", features: ["10,000 conversations / month", "5 agents", "Regression re-runs", "Run-finished webhooks", "Priority support"] },
  { id: "enterprise", name: "Enterprise", price: "Custom", per: "", features: ["Unlimited agents", "Compliance test suites (BFSI)", "India data residency", "Audit-ready reports, SSO, SLA"] },
] as const;
