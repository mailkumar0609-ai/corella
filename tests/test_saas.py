"""Dashboard accounts, API keys, regression re-runs and billing webhooks."""
import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from corella import auth, services, worker
from corella.api import app
from corella.models import Organization, SessionLocal, init_db

init_db()
client = TestClient(app)
DEMO = {"name": "EMI bot", "rules": "Never promise fee waivers", "target": {"type": "demo"}}


@pytest.fixture
def user(monkeypatch):
    """Pretend Supabase accepted the token 'tok_<name>'."""
    monkeypatch.setattr(auth, "verify_supabase_token",
                        lambda t: {"id": t, "email": f"{t}@x.in"} if t.startswith("tok_") else None)
    return lambda name: {"authorization": f"Bearer tok_{name}"}


def test_onboarding_flow(user):
    h = user("asha")
    assert client.get("/v1/me", headers=h).json()["detail"] == "onboarding_required"
    r = client.post("/v1/onboarding", json={"company": "Asha Finance"}, headers=h)
    assert r.status_code == 201 and r.json()["organization"]["plan"] == "trial"
    assert client.post("/v1/onboarding", json={"company": "Again"}, headers=h).status_code == 409
    me = client.get("/v1/me", headers=h).json()
    assert me["user"]["role"] == "owner" and me["limits"]["monthly_conversations"] == 100


def test_api_keys_lifecycle(user):
    h = user("ravi")
    client.post("/v1/onboarding", json={"company": "Ravi AI"}, headers=h)
    key = client.post("/v1/api-keys", json={"name": "ci"}, headers=h).json()["key"]
    kh = {"authorization": f"Bearer {key}"}
    assert client.get("/v1/agents", headers=kh).status_code == 200
    kid = [k for k in client.get("/v1/api-keys", headers=h).json() if k["name"] == "ci"][0]["id"]
    assert client.delete(f"/v1/api-keys/{kid}", headers=h).status_code == 204
    assert client.get("/v1/agents", headers=kh).status_code == 401


def _set_plan(org_id, plan):
    with SessionLocal() as db:
        db.get(Organization, org_id).plan = plan
        db.commit()


def test_regression_rerun_and_compare(user):
    h = user("meera")
    org = client.post("/v1/onboarding", json={"company": "Meera Bank"}, headers=h).json()["organization"]
    agent = client.post("/v1/agents", json=DEMO, headers=h).json()
    run = client.post(f"/v1/agents/{agent['id']}/runs", json={"scenarios": 3, "max_turns": 3}, headers=h).json()
    while worker.run_once():
        pass
    assert client.post(f"/v1/runs/{run['id']}/rerun", headers=h).status_code == 402  # trial: no regression
    _set_plan(org["id"], "starter")
    rr = client.post(f"/v1/runs/{run['id']}/rerun", headers=h).json()
    assert rr["baseline_run_id"] == run["id"]
    while worker.run_once():
        pass
    cmp = client.get(f"/v1/runs/{rr['id']}/compare", headers=h).json()
    assert cmp["regressed"] == [] and cmp["unchanged"] == 3


def _signed(payload):
    body = json.dumps(payload).encode()
    return body, hmac.new(b"whsec_test", body, hashlib.sha256).hexdigest()


def test_razorpay_webhook_upgrades_and_cancels(user):
    h = user("kiran")
    org = client.post("/v1/onboarding", json={"company": "Kiran Tech"}, headers=h).json()["organization"]
    sub = {"id": "sub_1", "status": "active", "notes": {"org_id": org["id"], "plan": "growth"}}
    body, sig = _signed({"event": "subscription.activated", "payload": {"subscription": {"entity": sub}}})
    assert client.post("/webhooks/razorpay", content=body, headers={"x-razorpay-signature": "bad"}).status_code == 400
    assert client.post("/webhooks/razorpay", content=body, headers={"x-razorpay-signature": sig}).json()["result"] == "ok"
    assert client.get("/v1/me", headers=h).json()["organization"]["plan"] == "growth"
    body, sig = _signed({"event": "subscription.cancelled",
                         "payload": {"subscription": {"entity": {**sub, "status": "cancelled"}}}})
    client.post("/webhooks/razorpay", content=body, headers={"x-razorpay-signature": sig})
    assert client.get("/v1/me", headers=h).json()["organization"]["plan"] == "trial"


def test_webhook_requires_growth(user):
    h = user("dev")
    client.post("/v1/onboarding", json={"company": "Dev Co"}, headers=h)
    assert client.put("/v1/settings/webhook", json={"url": "https://example.com/hook"}, headers=h).status_code == 402


def test_webhook_signature_helper():
    assert services.sign("s", b"x") == hmac.new(b"s", b"x", hashlib.sha256).hexdigest()


def test_autonomous_agent_finds_fixes_and_verifies(user):
    h = user("agentic")
    client.post("/v1/onboarding", json={"company": "Agentic Co"}, headers=h)
    bot = {"name": "Prompt bot", "rules": "Never promise fee waivers",
           "target": {"type": "prompt", "system_prompt": "You are an EMI bot. Be helpful."}}
    agent = client.post("/v1/agents", json=bot, headers=h).json()
    run = client.post(f"/v1/agents/{agent['id']}/runs", json={"mode": "autonomous", "scenarios": 10, "rounds": 2},
                      headers=h).json()
    while worker.run_once():
        pass
    done = client.get(f"/v1/runs/{run['id']}", headers=h).json()
    assert done["status"] == "completed" and done["mode"] == "autonomous"
    rep = done["agent_report"]
    assert rep["plan"] and len(rep["rounds"]) >= 1
    steps = {e["step"] for e in done["events"]}
    assert {"plan", "attack", "learn", "done"} <= steps


def test_autonomous_on_demo_agent_reports_root_cause():
    from corella.agentic import autonomous_campaign
    from corella.engine import DemoEmiBot, LLMTarget
    from corella.llm import MockLLM
    llm = MockLLM()
    log = []
    c = autonomous_campaign(llm, DemoEmiBot(), "EMI bot", "no waivers", budget=10, rounds=2,
                            system_prompt="You are an EMI bot.", emit=lambda s, m: log.append(s))
    assert any(not r.passed for r in c.results)
    assert c.root_causes and c.root_causes[0]["severity"] == "critical"
    assert c.patched_prompt and "waiver" in c.patched_prompt
    assert c.verification and c.verification["now_passing"] == c.verification["retested"]  # patch verified
    assert len({r.scenario.id for r in c.results}) == len(c.results)  # no duplicate scenario ids across rounds
    assert log[0] == "plan" and log[-1] == "done"


def test_embedded_worker_processes_runs(user):
    import threading
    import time as _t
    h = user("embed")
    client.post("/v1/onboarding", json={"company": "Embed Co"}, headers=h)
    agent = client.post("/v1/agents", json=DEMO, headers=h).json()
    run = client.post(f"/v1/agents/{agent['id']}/runs", json={"scenarios": 2, "max_turns": 2}, headers=h).json()
    stop = threading.Event()
    t = threading.Thread(target=worker.loop, args=(stop,), daemon=True)
    t.start()
    for _ in range(50):
        if client.get(f"/v1/runs/{run['id']}", headers=h).json()["status"] == "completed":
            break
        _t.sleep(0.1)
    stop.set()
    t.join(5)
    assert client.get(f"/v1/runs/{run['id']}", headers=h).json()["status"] == "completed"


def test_agent_secrets_encrypted_at_rest(monkeypatch):
    from corella.config import settings
    from corella.security import decrypt_target, encrypt_target
    monkeypatch.setattr(settings, "encryption_key", "test-key-123")
    spec = {"type": "http", "url": "https://bot.example.com", "headers": {"Authorization": "Bearer s3cret"},
            "system_prompt": "confidential"}
    sealed = encrypt_target(spec)
    assert "headers" not in sealed and "system_prompt" not in sealed and "s3cret" not in str(sealed)
    assert sealed["url"] == spec["url"]
    assert decrypt_target(sealed) == spec
    assert decrypt_target({"type": "demo"}) == {"type": "demo"}  # legacy/plain specs pass through
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "encryption_key", "")
    import pytest
    with pytest.raises(RuntimeError):
        encrypt_target(spec)
