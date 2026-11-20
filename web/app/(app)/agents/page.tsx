"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import { api, type Agent } from "@/lib/api";

const TARGETS = {
  demo: "Built-in demo agent (try Corella in one click)",
  http: "My agent's chat API (HTTPS endpoint)",
  prompt: "Only a system prompt (no API yet)",
} as const;

function NewAgent({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", description: "", rules: "", type: "demo" as keyof typeof TARGETS,
    url: "", reply_field: "reply", auth: "", system_prompt: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const target: Record<string, unknown> = { type: f.type };
    if (f.type === "http") Object.assign(target, { url: f.url, reply_field: f.reply_field, headers: f.auth ? { authorization: f.auth } : {} });
    if (f.type === "prompt") target.system_prompt = f.system_prompt;
    try {
      const a = await api<Agent>("/v1/agents", { method: "POST", json: { name: f.name, description: f.description, rules: f.rules, target } });
      onDone();
      router.push(`/agents/${a.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginTop: 16 }}>
      <h2>Add an agent</h2>
      <label>Name</label>
      <input required maxLength={200} value={f.name} onChange={set("name")} placeholder="EMI reminder bot" />
      <label>What does it do? <span className="hint">Who it talks to, in which languages, what it can and cannot do. Sharper descriptions give sharper tests.</span></label>
      <textarea value={f.description} onChange={set("description")} placeholder="Hindi/Hinglish voice agent for an NBFC. Reminds borrowers about EMIs, explains how to change the EMI date…" />
      <label>Rules it must never break <span className="hint">Checked in every conversation.</span></label>
      <textarea value={f.rules} onChange={set("rules")} placeholder="Never promise fee waivers. Never share account details with anyone except the verified borrower." />
      <label>How should Corella reach it?</label>
      <select value={f.type} onChange={set("type")}>
        {Object.entries(TARGETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {f.type === "http" && (<>
        <label>Endpoint URL <span className="hint">We POST {"{messages:[{role,content}]}"} and read the reply.</span></label>
        <input required type="url" value={f.url} onChange={set("url")} placeholder="https://api.yourcompany.com/agent/chat" />
        <label>Reply field <span className="hint">JSON path to the reply, e.g. reply or choices.0.message.content</span></label>
        <input value={f.reply_field} onChange={set("reply_field")} />
        <label>Authorization header <span className="hint">Optional. Stored securely and never shown again.</span></label>
        <input type="password" value={f.auth} onChange={set("auth")} placeholder="Bearer sk_..." />
      </>)}
      {f.type === "prompt" && (<>
        <label>System prompt</label>
        <textarea required style={{ minHeight: 160 }} value={f.system_prompt} onChange={set("system_prompt")} />
      </>)}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save agent"}</button>
      </div>
      {error && <div className="alert">{error}{error.includes("allows") && <> · <Link href="/billing">Upgrade</Link></>}</div>}
    </form>
  );
}

function AgentsInner() {
  const { me } = useMe();
  const params = useSearchParams();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [adding, setAdding] = useState(params.get("new") === "1");
  const load = () => api<Agent[]>("/v1/agents").then(setAgents);
  useEffect(() => { load(); }, []);
  const full = agents !== null && agents.length >= me.limits.max_agents;

  return (
    <>
      <div className="spread">
        <h1>Agents</h1>
        {!adding && (full
          ? <Link className="btn" href="/billing">Upgrade to add more agents</Link>
          : <button className="btn primary" onClick={() => setAdding(true)}>Add agent</button>)}
      </div>
      {adding && !full && <NewAgent onDone={load} />}
      <div className="grid" style={{ marginTop: 16 }}>
        {agents?.map((a) => (
          <Link key={a.id} href={`/agents/${a.id}`} className="card" style={{ textDecoration: "none" }}>
            <div className="spread"><h3>{a.name}</h3><span className="badge">{a.target_type}</span></div>
            <p className="muted" style={{ margin: 0 }}>{a.description || "No description"}</p>
          </Link>
        ))}
        {agents?.length === 0 && !adding && <p className="muted">No agents yet.</p>}
      </div>
    </>
  );
}

export default function Agents() {
  return <Suspense><AgentsInner /></Suspense>;
}
