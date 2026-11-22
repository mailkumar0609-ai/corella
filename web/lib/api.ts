import { createClient, type Session } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
);

export const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const t = await token();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (t) headers.authorization = `Bearer ${t}`;
  if (init.json !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${API}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get("content-type")?.includes("json");
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const detail = isJson ? body.detail : body;
    throw new ApiError(res.status, typeof detail === "string" ? detail : detail?.[0]?.msg || "Request failed");
  }
  return body as T;
}

export async function openReport(runId: string) {
  const html = await api<string>(`/v1/runs/${runId}/report`);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
}

export type Session_ = Session;

export type Me = {
  organization: { id: string; name: string; plan: string; subscription_status: string | null; webhook_url: string | null };
  user: { id: string; email: string; role: string } | null;
  limits: { monthly_conversations: number; max_agents: number; price_inr: number | null; regression: boolean; webhooks: boolean };
  conversations_this_month: number;
};
export type Agent = { id: string; name: string; description: string; rules: string; target_type: string; target_url: string | null };
export type Summary = { total: number; passed: number; failed: number; errors: number; averages: Record<string, number> };
export type Run = {
  id: string; agent_id: string; status: string; label: string | null; summary: Summary | null; conversations: number;
  error: string | null; baseline_run_id: string | null; created_at: string; finished_at: string | null;
  mode: "standard" | "autonomous"; agent_report: AgentReport | null; events: { t: string; step: string; message: string }[];
  share_url?: string | null;
};
export type AgentReport = {
  plan: { risk: string; why: string; priority: string }[];
  rounds: { round: number; tested: number; failed: number; focus: string }[];
  root_causes: { cause: string; severity: string; scenario_ids: string[]; fix: string }[];
  patched_prompt: string | null;
  verification: { retested: number; now_passing: number; still_failing: string[]; fixed: string[] } | null;
  stop_reason: string;
};
export type Failure = { turn: number; category: string; issue: string; suggested_fix: string };
export type ResultRow = {
  id: string; passed: boolean; error: string | null;
  scenario: { id: string; goal: string; persona: string; opening: string; success: string };
  score: Record<string, any> & { failures?: Failure[]; summary?: string };
  transcript: { role: "customer" | "agent"; content: string }[];
};

export const fmtDate = (s: string) => new Date(s.endsWith("Z") || s.includes("+") ? s : s + "Z").toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
export const passRate = (s: Summary | null) => (s && s.total ? Math.round((100 * s.passed) / s.total) : 0);
