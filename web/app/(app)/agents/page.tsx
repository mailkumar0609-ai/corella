"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import { api, type Agent } from "@/lib/api";

const TARGETS = {
  demo: "Built-in demo agent (try Corella in one click)",
  demo_voice: "Built-in demo voice agent (hear how noise changes what it understands)",
  voice: "My voice agent (audio-in, audio-out API)",
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
    template: '{"query": "{{message}}", "conversation_id": "{{session_id}}"}',
    language: "hi-IN", noise: "street", request_format: "json", reply_kind: "audio", reply_audio_field: "audio", reply_text_field: "text" });
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
    if (f.type === "voice" || f.type === "demo_voice") Object.assign(target, { language: f.language, noise: f.noise });
    if (f.type === "voice") Object.assign(target, { url: f.url, request_format: f.request_format,
      headers: auth ? { authorization: auth } : {},
      reply_audio_field: f.reply_kind === "audio" ? f.reply_audio_field : null,
      reply_text_field: f.reply_kind === "text" ? f.reply_text_field : null });
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

  const remote = f.type === "http" || f.type === "openai" || f.type === "voice";
  const LANGS: Record<string, string> = { "hi-IN": "Hindi / Hinglish", "en-IN": "Indian English", "bn-IN": "Bengali", "mr-IN": "Marathi",
    "ta-IN": "Tamil", "te-IN": "Telugu", "kn-IN": "Kannada", "ml-IN": "Malayalam", "gu-IN": "Gujarati", "pa-IN": "Punjabi", "od-IN": "Odia" };
  const NOISE: Record<string, string> = { clean: "Quiet room", street: "Busy street (traffic, horns)",
    crowd: "Crowded market / office (background voices)", bad_line: "Weak mobile network (narrowband, dropouts)" };
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

      {(f.type === "voice" || f.type === "demo_voice") && (<>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <div><label>Caller speaks</label>
            <select value={f.language} onChange={set("language")}>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label>Call conditions</label>
            <select value={f.noise} onChange={set("noise")}>{Object.entries(NOISE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <p className="hint">Each customer turn is spoken with an Indian-accent voice, mixed with this background noise, and sent to the agent. We transcribe the reply and time every turn.</p>
      </>)}
      {f.type === "voice" && (<>
        <label>Voice endpoint URL <span className="hint">One request per turn: 16 kHz mono WAV in, reply audio (or text) out.</span></label>
        <input required type="url" value={f.url} onChange={set("url")} placeholder="https://voice.yourcompany.com/turn" />
        <label>How we send the audio</label>
        <select value={f.request_format} onChange={set("request_format")}>
          <option value="json">JSON: {"{"}&quot;audio&quot;: base64 WAV, &quot;session_id&quot;, &quot;language&quot;{"}"}</option>
          <option value="multipart">Multipart form upload (file field &quot;audio&quot;)</option>
        </select>
        <label>Agent replies with</label>
        <select value={f.reply_kind} onChange={set("reply_kind")}>
          <option value="audio">Audio (base64 WAV in the JSON response)</option>
          <option value="text">Text</option>
        </select>
        {f.reply_kind === "audio"
          ? <><label>Reply audio field <span className="hint">e.g. audio or data.audio_base64</span></label><input value={f.reply_audio_field} onChange={set("reply_audio_field")} /></>
          : <><label>Reply text field</label><input value={f.reply_text_field} onChange={set("reply_text_field")} /></>}
        <label>Authorization header <span className="hint">Optional. Encrypted at rest and never shown again.</span></label>
        <input type="password" value={f.auth} onChange={set("auth")} placeholder="Bearer ..." autoComplete="off" />
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
        <div><h1>Agents</h1><p className="muted" style={{ margin: "6px 0 0" }}>The bots Corella tests: chat, voice or a prompt.</p></div>
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
