"""End-to-end API tests on a temporary SQLite database with the offline mock LLM."""
from fastapi.testclient import TestClient

from corella import services, worker
from corella.api import app
from corella.models import SessionLocal, init_db

init_db()
client = TestClient(app)


def new_org(plan="trial"):
    with SessionLocal() as db:
        _, key = services.create_organization(db, "Acme Lending", plan)
    return {"authorization": f"Bearer {key}"}


DEMO = {"name": "EMI bot", "description": "Hindi collections bot", "rules": "Never promise fee waivers",
        "target": {"type": "demo"}}


def test_auth_required():
    assert client.get("/v1/agents").status_code == 401
    assert client.get("/v1/agents", headers={"authorization": "Bearer crl_live_wrong"}).status_code == 401


def test_full_run_flow():
    h = new_org("growth")
    agent = client.post("/v1/agents", json=DEMO, headers=h).json()
    run = client.post(f"/v1/agents/{agent['id']}/runs", json={"scenarios": 3, "max_turns": 3}, headers=h)
    assert run.status_code == 202 and run.json()["status"] == "queued"
    assert worker.run_once()
    done = client.get(f"/v1/runs/{run.json()['id']}", headers=h).json()
    assert done["status"] == "completed" and done["summary"]["failed"] == 1
    failed = client.get(f"/v1/runs/{done['id']}/results?failed_only=true", headers=h).json()
    assert [r["scenario"]["id"] for r in failed] == ["fee_waiver_trick"]
    report = client.get(f"/v1/runs/{done['id']}/report", headers=h)
    assert report.status_code == 200 and "Corella test report" in report.text


def test_tenants_are_isolated():
    a, b = new_org("growth"), new_org("growth")
    agent = client.post("/v1/agents", json=DEMO, headers=a).json()
    assert client.post(f"/v1/agents/{agent['id']}/runs", json={"scenarios": 1}, headers=b).status_code == 404
    assert client.get("/v1/agents", headers=b).json() == []


def test_plan_limits():
    h = new_org("trial")  # 1 agent, 100 conversations/month
    agent = client.post("/v1/agents", json=DEMO, headers=h).json()
    assert client.post("/v1/agents", json=DEMO, headers=h).status_code == 402
    assert client.post(f"/v1/agents/{agent['id']}/runs", json={"scenarios": 101}, headers=h).status_code == 402


def test_private_target_rejected():
    h = new_org("growth")
    bad = {**DEMO, "target": {"type": "http", "url": "https://127.0.0.1/chat"}}
    assert client.post("/v1/agents", json=bad, headers=h).status_code == 422


def test_secrets_not_echoed():
    h = new_org("growth")
    body = {**DEMO, "target": {"type": "prompt", "system_prompt": "You are a bot", "headers": {"authorization": "secret"}}}
    out = client.post("/v1/agents", json=body, headers=h).json()
    assert "secret" not in str(out)


def test_share_link_is_public_and_hides_secrets():
    h = new_org("growth")
    agent = client.post("/v1/agents", json={**DEMO, "rules": "SECRET-RULE"}, headers=h).json()
    run = client.post(f"/v1/agents/{agent['id']}/runs", json={"scenarios": 3, "max_turns": 3}, headers=h).json()
    worker.run_once()
    url = client.post(f"/v1/runs/{run['id']}/share", headers=h).json()["share_url"]
    token = url.rsplit("/", 1)[1]
    pub = client.get(f"/v1/public/reports/{token}")  # no auth header
    assert pub.status_code == 200 and pub.json()["summary"]["total"] == 3
    assert "SECRET-RULE" not in pub.text and "usage" not in pub.json()
    assert client.get(f"/v1/runs/{run['id']}", headers=h).json()["share_url"] == url
    assert client.delete(f"/v1/runs/{run['id']}/share", headers=h).status_code == 204
    assert client.get(f"/v1/public/reports/{token}").status_code == 404


def test_connectors(monkeypatch):
    import httpx

    from corella import engine
    sent = []

    def fake_post(url, json=None, headers=None, **kw):
        sent.append((url, json))
        if url.endswith("/chat/completions"):
            return httpx.Response(200, json={"choices": [{"message": {"content": "OpenAI reply"}}]})
        return httpx.Response(200, json={"data": {"answer": "Bot reply"}})
    monkeypatch.setattr(engine.httpx, "post", fake_post)

    oa = engine.OpenAICompatTarget("https://api.example.com/v1", "gpt-x", system_prompt="Be nice")
    assert oa.reply([{"role": "user", "content": "hi"}]) == "OpenAI reply"
    assert sent[-1][0] == "https://api.example.com/v1/chat/completions"
    assert sent[-1][1]["messages"][0] == {"role": "system", "content": "Be nice"}

    ht = engine.HttpTarget("https://bot.example.com", reply_field="data.answer",
                           body_template={"text": "{{message}}", "sid": "{{session_id}}", "history": "{{messages}}"})
    msgs = [{"role": "user", "content": "kal EMI?"}]
    assert ht.reply(msgs, "s1") == "Bot reply"
    assert sent[-1][1] == {"text": "kal EMI?", "sid": "s1", "history": msgs}

    bad = engine.HttpTarget("https://bot.example.com", reply_field="nope")
    try:
        bad.reply(msgs)
        raise AssertionError("expected TargetError")
    except engine.TargetError as e:
        assert "nope" in str(e)


def test_connection_endpoint_validates():
    h = new_org()
    r = client.post("/v1/agents/test-connection", json={"type": "openai", "url": "https://api.example.com/v1"}, headers=h)
    assert r.status_code == 422  # model required
    r = client.post("/v1/agents/test-connection", json={"type": "demo"}, headers=h)
    assert r.json()["ok"] is True


def test_usage_endpoint():
    h = new_org("growth")
    agent = client.post("/v1/agents", json=DEMO, headers=h).json()
    client.post(f"/v1/agents/{agent['id']}/runs", json={"scenarios": 3, "max_turns": 3}, headers=h)
    worker.run_once()
    u = client.get("/v1/usage", headers=h).json()
    assert u["used"] == 3 and u["runs"] == 1 and u["by_agent"][0] == {"agent": "EMI bot", "conversations": 3}
    assert u["remaining"] == u["limit"] - 3
