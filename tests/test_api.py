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
