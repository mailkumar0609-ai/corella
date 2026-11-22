"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import { api, type Agent } from "@/lib/api";

const TARGETS = {
  demo: "Built-in demo agent (try Corella in one click)",
  openai: "OpenAI-compatible API (OpenAI, Azure, Sarvam, OpenRouter, Groq, vLLM, LiteLLM…)",
  http: "My agent's own chat API (any HTTPS endpoint)",
  prompt: "Only a system prompt (no API yet)",
} as const;

const FORMATS = {
  history: { label: "Full conversation: {\"messages\": [{role, content}…]}", template: null },
  single: { label: "Latest message + session id: {\"message\": …, \"session_id\": …}",
    template: { message: "{{message}}", session_id: "{{session_id}}" } },
  custom: { label: "Custom JSON template", template: null },
} as const;

type Test = { ok: boolean; reply?: string | null; error?: string; latency_ms?: number; note?: string };

function NewAgent({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", description: "", rules: "", type: "demo" as keyof typeof TARGETS,
    url: "", reply_field: "reply", auth: "", system_prompt: "", model: "", format: "history" as keyof typeof FORMATS,
    template: '{"query": "{{message}}", "conversation_id": "{{session_id}}"}' });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<Test | null>(null);
  const [testing, setTesting] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setF({ ...f, [k]: e.target.value }); setTest(null);
  };

  function buildTarget(): Record<string, unknown> {
    const target: Record<string, unknown> = { type: f.type };
    const auth = f.auth.trim();
    if (f.type === "http") {
      let body_template: unknown = FORMATS[f.format].template;
      if (f.format === "custom") {
        try { body_template = JSON.parse(f.template); } catch { throw new Error("The custom template is not valid JSON."); }
      }
      Object.assign(target, { url: f.url, reply_field: f.reply_field, headers: auth ? { authorization: auth } : {},
        ...(body_template ? { body_template } : {}) });
    }
    if (f.type === "openai") Object.assign(target, { url: f.url, model: f.model,
      headers: auth ? { authorization: auth.toLowerCase().startsWith("bearer ") ? auth : `Bearer ${auth}` } : {},
      ...(f.system_prompt ? { system_prompt: f.system_prompt } : {}) });
    if (f.type === "prompt") target.system_prompt = f.system_prompt;
    return target;
  }

  async function testConnection() {
    setTesting(true); setTest(null); setError("");
    try { setTest(await api<Test>("/v1/agents/test-connection", { method: "POST", json: buildTarget() })); }
    catch (err) { setTest({ ok: false, error: err instanceof Error ? err.message : "Test failed" }); }
    setTesting(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const a = await api<Agent>("/v1/agents", { method: "POST", json: { name: f.name, description: f.description, rules: f.rules, target: buildTarget() } });
      onDone();
      router.push(`/agents/${a.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setBusy(false);
    }
  }

  const remote = f.type === "http" || f.type === "openai";
  return (
    <form className="card" onSubmit={submit} style={{ marginTop: 16 }}>
      <h2>Add an agent</h2>
      <label>Name</label>
      <input required maxLength={200} value={f.name} onChange={set("name")} placeholder="EMI reminder bot" />
      <label>What does it do? <span className="hint">Who it talks to, in which languages, what it can and cannot do. Sharper descriptions give sharper tests.</span></label>
      <textarea value={f.description} onChange={set("description")} placeholder="Hindi/Hinglish agent for an NBFC. Reminds borrowers about EMIs, explains how to change the EMI date…" />
      <label>Rules it must never break <span className="hint">Checked in every conversation.</span></label>
      <textarea value={f.rules} onChange={set("rules")} placeholder="Never promise fee waivers. Never share account details with anyone except the verified borrower." />
      <label>How should Corella reach it?</label>
      <select value={f.type} onChange={set("type")}>
        {Object.entries(TARGETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      {f.type === "openai" && (<>
        <label>Base URL <span className="hint">e.g. https://api.openai.com/v1. We add /chat/completions if it&apos;s missing.</span></label>
        <input required type="url" value={f.url} onChange={set("url")} placeholder="https://api.openai.com/v1" />
        <label>Model</label>
        <input required value={f.model} onChange={set("model")} placeholder="gpt-4o-mini, sarvam-m, my-agent…" />
        <label>API key <span className="hint">Encrypted at rest and never shown again.</span></label>
        <input type="password" value={f.auth} onChange={set("auth")} placeholder="sk-..." autoComplete="off" />
        <label>Your agent&apos;s system prompt <span className="hint">Optional. Sent with every message, and lets Corella write and verify a fixed version.</span></label>
        <textarea style={{ minHeight: 120 }} value={f.system_prompt} onChange={set("system_prompt")} />
      </>)}

      {f.type === "http" && (<>
        <label>Endpoint URL</label>
        <input required type="url" value={f.url} onChange={set("url")} placeholder="https://api.yourcompany.com/agent/chat" />
        <label>Request format</label>
        <select value={f.format} onChange={set("format")}>
          {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {f.format === "custom" && (<>
          <label>JSON template <span className="hint">{"{{message}}"} = latest customer message, {"{{messages}}"} = full history, {"{{session_id}}"} = one id per test conversation.</span></label>
          <textarea className="mono" value={f.template} onChange={set("template")} />
        </>)}
        <label>Reply field <span className="hint">Where the reply is in the response, e.g. reply, data.text or choices.0.message.content</span></label>
        <input value={f.reply_field} onChange={set("reply_field")} />
        <label>Authorization header <span className="hint">Optional. Encrypted at rest and never shown again.</span></label>
        <input type="password" value={f.auth} onChange={set("auth")} placeholder="Bearer sk_..." autoComplete="off" />
      </>)}

      {f.type === "prompt" && (<>
        <label>System prompt</label>
        <textarea required style={{ minHeight: 160 }} value={f.system_prompt} onChange={set("system_prompt")} />
      </>)}

      {test && (test.ok
        ? <div className="alert info">{test.reply != null
            ? <>Connected in {test.latency_ms} ms. Your agent replied: <i>&ldquo;{test.reply.slice(0, 300)}&rdquo;</i></>
            : test.note}</div>
        : <div className="alert">Connection failed: {test.error}</div>)}
      <div className="row" style={{ marginTop: 16 }}>
        {remote && <button type="button" className="btn" onClick={testConnection} disabled={testing || !f.url}>{testing ? "Testing…" : "Test connection"}</button>}
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
