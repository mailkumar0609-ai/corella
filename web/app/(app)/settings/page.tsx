"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMe } from "@/components/AppShell";
import { api, fmtDate } from "@/lib/api";

type Key = { id: string; name: string; prefix: string; revoked: boolean; created_at: string; last_used_at: string | null };
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Settings() {
  const { me, refresh } = useMe();
  const owner = me.user?.role === "owner";
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState("");
  const [hook, setHook] = useState(me.organization.webhook_url || "");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const load = () => api<Key[]>("/v1/api-keys").then(setKeys);
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try { setFresh((await api<{ key: string }>("/v1/api-keys", { method: "POST", json: { name: name || "default" } })).key); setName(""); load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  async function revoke(id: string) {
    if (!confirm("Revoke this key? Anything using it will stop working immediately.")) return;
    await api(`/v1/api-keys/${id}`, { method: "DELETE" }); load();
  }
  async function saveHook(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try { setSecret((await api<{ signing_secret: string }>("/v1/settings/webhook", { method: "PUT", json: { url: hook || null } })).signing_secret); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <>
      <h1>API & webhooks</h1>
      {error && <div className="alert">{error}</div>}
      <div className="card" style={{ marginTop: 16 }}>
        <h2>API keys</h2>
        <p className="muted">Use keys to run tests from scripts and CI pipelines. API docs: <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer">{API_URL}/docs</a></p>
        {fresh && <div className="alert info">Copy this key now; it will not be shown again:<br /><code style={{ wordBreak: "break-all" }}>{fresh}</code></div>}
        <table><thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th /></tr></thead><tbody>
          {keys.map((k) => (
            <tr key={k.id}><td>{k.name}</td><td className="mono">{k.prefix}…</td><td className="muted">{fmtDate(k.created_at)}</td>
              <td className="muted">{k.last_used_at ? fmtDate(k.last_used_at) : "Never"}</td>
              <td>{k.revoked ? <span className="badge">Revoked</span> : owner && <button className="btn danger" onClick={() => revoke(k.id)}>Revoke</button>}</td></tr>))}
        </tbody></table>
        {owner && <form className="row" onSubmit={create} style={{ marginTop: 14 }}>
          <input style={{ maxWidth: 260 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name, e.g. github-ci" />
          <button className="btn primary">Create key</button>
        </form>}
        <h3 style={{ marginTop: 20 }}>Run a test from CI</h3>
        <pre className="card mono" style={{ overflowX: "auto", margin: 0 }}>{`curl -X POST ${API_URL}/v1/agents/AGENT_ID/runs \\
  -H "Authorization: Bearer $CORELLA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"scenarios": 20, "label": "commit $GIT_SHA"}'`}</pre>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Run-finished webhook</h2>
        {!me.limits.webhooks ? <p className="muted">Get a signed POST to your server or Slack relay when a run finishes, including what regressed. Available on Growth. <Link href="/billing">Upgrade</Link></p> : (
          <form onSubmit={saveHook}>
            <label>Webhook URL <span className="hint">HTTPS. Leave empty to turn off.</span></label>
            <input type="url" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://yourcompany.com/hooks/corella" />
            <button className="btn primary" style={{ marginTop: 12 }} disabled={!owner}>Save</button>
            {secret && <p className="muted" style={{ marginTop: 10 }}>Signing secret: <code>{secret}</code>. Verify the <code>x-corella-signature</code> header (HMAC-SHA256 of the raw body).</p>}
          </form>)}
      </div>
    </>
  );
}
