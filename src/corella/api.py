"""Corella public REST API (v1).

Auth: `Authorization: Bearer <API key crl_live_... | Supabase access token>`; dashboard users may pass X-Org-Id.
Run locally:  uvicorn corella.api:app --reload      Docs: /docs
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import __version__, billing, services
from .auth import Ctx, current_ctx, current_user, get_db, require_owner
from .config import PLANS, settings
from .models import Agent, ApiKey, Membership, Organization, Result, Run, User, init_db
from .personas import PERSONAS
from .report import render_html
from .security import UnsafeTarget, check_target_url, encrypt_target

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_app):
    try:
        init_db()
    except Exception as e:
        from sqlalchemy.engine import make_url
        try:
            u = make_url(settings.database_url)
            where = f"{u.drivername}://{u.username}@{u.host}:{u.port}/{u.database}"
        except Exception:
            where = "unparseable DATABASE_URL"
        log.error("DATABASE CONNECTION FAILED (%s): %s: %s", where, type(e).__name__, str(e).splitlines()[0])
        raise
    stop, thread = None, None
    if settings.embedded_worker:
        import threading

        from .worker import loop
        stop = threading.Event()
        thread = threading.Thread(target=loop, args=(stop,), name="corella-worker", daemon=True)
        thread.start()
    yield
    if stop:
        stop.set()
        thread.join(timeout=30)


log = logging.getLogger("corella.api")


app = FastAPI(title="Corella API", version=__version__, lifespan=lifespan,
              description="Automated testing for Indian-language voice and chat AI agents.")
if settings.cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"],
                       allow_headers=["authorization", "content-type", "x-org-id"])


# ---------- schemas ----------

class TargetSpec(BaseModel):
    type: Literal["http", "openai", "prompt", "demo"]
    url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    reply_field: str = "reply"
    body_template: dict | list | None = None  # http: request shape with {{message}}, {{messages}}, {{session_id}}
    model: str | None = Field(default=None, max_length=200)  # openai: model name
    system_prompt: str | None = Field(default=None, max_length=50_000)


class AgentIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10_000)
    rules: str = Field(default="", max_length=10_000)
    target: TargetSpec


class AgentOut(BaseModel):
    id: str
    name: str
    description: str
    rules: str
    target_type: str
    target_url: str | None = None


class ScenarioIn(BaseModel):
    id: str = Field(max_length=100)
    goal: str
    persona: str
    opening: str
    success: str


class RunIn(BaseModel):
    mode: Literal["standard", "autonomous"] = "standard"
    scenarios: int | list[ScenarioIn] = 10  # autonomous mode: the conversation budget
    rounds: int = Field(default=3, ge=1, le=6)
    personas: list[str] | None = None
    max_turns: int = Field(default=6, ge=1, le=20)
    label: str | None = Field(default=None, max_length=200)
    packs: list[str] | None = None  # compliance packs; their fixed scenarios replace `scenarios`

    @field_validator("scenarios")
    @classmethod
    def _limit(cls, v):
        n = len(v) if isinstance(v, list) else v
        if not 1 <= n <= settings.max_scenarios_per_run:
            raise ValueError(f"scenarios must be between 1 and {settings.max_scenarios_per_run}")
        return v


class OnboardIn(BaseModel):
    company: str = Field(min_length=1, max_length=200)


class KeyIn(BaseModel):
    name: str = Field(default="default", max_length=100)


class WebhookIn(BaseModel):
    url: str | None = None


class CheckoutIn(BaseModel):
    plan: Literal["starter", "growth"]


def agent_out(a: Agent) -> AgentOut:  # never echo stored headers (they may hold the customer's secrets)
    return AgentOut(id=a.id, name=a.name, description=a.description, rules=a.rules,
                    target_type=a.target["type"], target_url=a.target.get("url"))


def run_out(r: Run) -> dict:
    return {"id": r.id, "agent_id": r.agent_id, "status": r.status, "label": (r.config or {}).get("label"),
            "summary": r.summary, "conversations": r.conversations, "error": r.error,
            "baseline_run_id": r.baseline_run_id, "mode": (r.config or {}).get("mode", "standard"),
            "agent_report": r.agent_report, "events": r.events or [], "created_at": r.created_at,
            "started_at": r.started_at, "finished_at": r.finished_at,
            "share_url": f"{settings.app_url}/r/{r.share_token}" if r.share_token else None}


def own(db: Session, model, id_: str, org: Organization):
    obj = db.get(model, id_)
    if not obj or obj.organization_id != org.id:  # 404, not 403: don't reveal other tenants' ids
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


def quota_or_402(fn, *args):
    try:
        fn(*args)
    except services.QuotaExceeded as e:
        raise HTTPException(402, str(e))


# ---------- public ----------

@app.get("/healthz")
def health():
    return {"ok": True, "version": __version__}


@app.get("/v1/plans")
def plans():
    return PLANS


@app.get("/v1/personas")
def personas():
    return [{"id": k, "description": v} for k, v in PERSONAS.items()]


# ---------- account ----------

@app.post("/v1/onboarding", status_code=201)
def onboard(body: OnboardIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """First sign-in: create the user's workspace on the free trial."""
    if db.scalar(select(Membership).where(Membership.user_id == user.id)):
        raise HTTPException(409, "You already have a workspace")
    org, _ = services.create_organization(db, body.company, "trial", owner=user)
    return {"organization": {"id": org.id, "name": org.name, "plan": org.plan}}


@app.get("/v1/me")
def me(ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    org = ctx.org
    return {"organization": {"id": org.id, "name": org.name, "plan": org.plan,
                             "subscription_status": org.subscription_status, "webhook_url": org.webhook_url},
            "user": {"id": ctx.user.id, "email": ctx.user.email, "role": ctx.role} if ctx.user else None,
            "limits": PLANS[org.plan], "conversations_this_month": services.conversations_this_month(db, org.id)}


@app.get("/v1/compliance/packs")
def compliance_packs():
    """Ready-made regulatory test suites (RBI recovery, RBI digital lending, DPDP, customer safety)."""
    from .compliance import public_packs
    return public_packs()


@app.get("/v1/usage")
def usage(ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    """This month's test conversations: total, by day and by agent (failed runs are not counted)."""
    from datetime import datetime, timezone
    start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    runs = db.scalars(select(Run).where(Run.organization_id == ctx.org.id, Run.created_at >= start,
                                        Run.status != "failed")).all()
    names = {a.id: a.name for a in db.scalars(select(Agent).where(Agent.organization_id == ctx.org.id))}
    by_day, by_agent = {}, {}
    for r in runs:
        d = r.created_at.date().isoformat()
        by_day[d] = by_day.get(d, 0) + (r.conversations or 0)
        k = names.get(r.agent_id, r.agent_id)
        by_agent[k] = by_agent.get(k, 0) + (r.conversations or 0)
    limit = PLANS[ctx.org.plan]["monthly_conversations"]
    used = sum(by_day.values())
    return {"period_start": start.date().isoformat(), "used": used, "limit": limit, "remaining": max(limit - used, 0),
            "runs": len(runs), "by_day": [{"date": k, "conversations": v} for k, v in sorted(by_day.items())],
            "by_agent": [{"agent": k, "conversations": v} for k, v in sorted(by_agent.items(), key=lambda x: -x[1])]}


@app.get("/v1/api-keys")
def list_keys(ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    keys = db.scalars(select(ApiKey).where(ApiKey.organization_id == ctx.org.id).order_by(ApiKey.created_at))
    return [{"id": k.id, "name": k.name, "prefix": k.prefix, "revoked": k.revoked,
             "created_at": k.created_at, "last_used_at": k.last_used_at} for k in keys]


@app.post("/v1/api-keys", status_code=201)
def new_key(body: KeyIn, ctx: Ctx = Depends(require_owner), db: Session = Depends(get_db)):
    raw = services.create_api_key(db, ctx.org.id, body.name)
    db.commit()
    return {"key": raw, "note": "Copy this key now; it will not be shown again."}


@app.delete("/v1/api-keys/{key_id}", status_code=204)
def revoke_key(key_id: str, ctx: Ctx = Depends(require_owner), db: Session = Depends(get_db)):
    own(db, ApiKey, key_id, ctx.org).revoked = True
    db.commit()


@app.put("/v1/settings/webhook")
def set_webhook(body: WebhookIn, ctx: Ctx = Depends(require_owner), db: Session = Depends(get_db)):
    if body.url:
        if not PLANS[ctx.org.plan]["webhooks"]:
            raise HTTPException(402, "Webhooks are available on the Growth plan and above")
        try:
            check_target_url(body.url, settings.allow_private_targets)
        except UnsafeTarget as e:
            raise HTTPException(422, str(e))
    ctx.org.webhook_url = body.url or None
    db.commit()
    return {"webhook_url": ctx.org.webhook_url, "signing_secret": ctx.org.webhook_secret,
            "note": "Verify the x-corella-signature header: hex HMAC-SHA256 of the raw body with this secret."}


# ---------- agents ----------

def validate_target(t: TargetSpec) -> None:
    if t.type in ("http", "openai"):
        if not t.url:
            raise HTTPException(422, f"target.url is required for {t.type} targets")
        try:
            check_target_url(t.url, settings.allow_private_targets)
        except UnsafeTarget as e:
            raise HTTPException(422, str(e))
    if t.type == "openai" and not t.model:
        raise HTTPException(422, "target.model is required for OpenAI-compatible targets")
    if t.type == "prompt" and not t.system_prompt:
        raise HTTPException(422, "target.system_prompt is required for prompt targets")


@app.post("/v1/agents/test-connection")
def test_connection(t: TargetSpec, ctx: Ctx = Depends(current_ctx)):
    """Send one customer message to the agent and show what came back, before saving it."""
    import time

    from .engine import TargetError, build_target
    from .llm import MockLLM
    validate_target(t)
    if t.type in ("prompt", "demo"):
        return {"ok": True, "reply": None, "note": "Nothing to connect to: this agent runs inside Corella."}
    msg = "Namaste, mujhe apne account ke baare mein jaankari chahiye."
    start = time.monotonic()
    try:
        reply = build_target(t.model_dump(exclude_none=True), MockLLM(), settings.allow_private_targets).reply(
            [{"role": "user", "content": msg}], "corella-connection-test")
    except (TargetError, UnsafeTarget) as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "sent": msg, "reply": reply[:2000], "latency_ms": int((time.monotonic() - start) * 1000)}


@app.post("/v1/agents", response_model=AgentOut, status_code=201)
def create_agent(body: AgentIn, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    t = body.target
    validate_target(t)
    quota_or_402(services.check_agent_limit, db, ctx.org)
    try:
        sealed = encrypt_target(t.model_dump(exclude_none=True))
    except RuntimeError as e:  # encryption key missing in production: refuse rather than store secrets in plain text
        raise HTTPException(503, str(e))
    a = Agent(organization_id=ctx.org.id, name=body.name, description=body.description, rules=body.rules,
              target=sealed)
    db.add(a)
    db.commit()
    return agent_out(a)


@app.get("/v1/agents", response_model=list[AgentOut])
def list_agents(ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    return [agent_out(a) for a in db.scalars(select(Agent).where(Agent.organization_id == ctx.org.id).order_by(Agent.created_at))]


@app.get("/v1/agents/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: str, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    return agent_out(own(db, Agent, agent_id, ctx.org))


@app.delete("/v1/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: str, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    a = own(db, Agent, agent_id, ctx.org)
    if db.scalar(select(Run.id).where(Run.agent_id == a.id).limit(1)):
        raise HTTPException(409, "Agent has runs; it cannot be deleted")
    db.delete(a)
    db.commit()


# ---------- runs ----------

@app.post("/v1/agents/{agent_id}/runs", status_code=202)
def create_run(agent_id: str, body: RunIn, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    agent = own(db, Agent, agent_id, ctx.org)
    cfg = body.model_dump(exclude_none=True)
    if body.mode == "autonomous" and isinstance(body.scenarios, list):
        raise HTTPException(422, "Autonomous mode takes a conversation budget (a number), not a scenario list")
    if body.packs:
        if body.mode == "autonomous":
            raise HTTPException(422, "Compliance packs run in standard mode (fixed, replayable scenarios)")
        from .compliance import expand
        try:
            cfg["scenarios"], cfg["extra_rules"] = expand(body.packs)
        except ValueError as e:
            raise HTTPException(422, str(e))
    n = services.requested_count(cfg)
    quota_or_402(services.check_quota, db, ctx.org, n)
    run = Run(organization_id=ctx.org.id, agent_id=agent.id, config=cfg, conversations=n)  # reserve quota now
    db.add(run)
    db.commit()
    return run_out(run)


@app.post("/v1/runs/{run_id}/rerun", status_code=202)
def rerun(run_id: str, label: str | None = None, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    """Regression test: replay the exact scenarios of a finished run (e.g. after a prompt change) and compare."""
    if not PLANS[ctx.org.plan]["regression"]:
        raise HTTPException(402, "Regression testing is available on paid plans")
    base = own(db, Run, run_id, ctx.org)
    if base.status != "completed":
        raise HTTPException(409, "Only completed runs can be re-run")
    scenarios = [r.scenario for r in base.results]
    quota_or_402(services.check_quota, db, ctx.org, len(scenarios))
    cfg = {**base.config, "mode": "standard", "scenarios": scenarios, "label": label or f"Re-run of {base.id}"}
    run = Run(organization_id=ctx.org.id, agent_id=base.agent_id, config=cfg,
              conversations=len(scenarios), baseline_run_id=base.id)
    db.add(run)
    db.commit()
    return run_out(run)


@app.get("/v1/runs")
def list_runs(agent_id: str | None = None, limit: int = Query(20, le=100),
              ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    q = select(Run).where(Run.organization_id == ctx.org.id).order_by(Run.created_at.desc()).limit(limit)
    if agent_id:
        q = q.where(Run.agent_id == agent_id)
    return [run_out(r) for r in db.scalars(q)]


@app.get("/v1/runs/{run_id}")
def get_run(run_id: str, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    return run_out(own(db, Run, run_id, ctx.org))


@app.get("/v1/runs/{run_id}/compare")
def compare(run_id: str, baseline: str | None = None, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    run = own(db, Run, run_id, ctx.org)
    base_id = baseline or run.baseline_run_id
    if not base_id:
        raise HTTPException(422, "No baseline run given")
    base = own(db, Run, base_id, ctx.org)
    if run.status != "completed" or base.status != "completed":
        raise HTTPException(409, "Both runs must be completed")
    return services.compare_runs(db, run, base)


@app.get("/v1/runs/{run_id}/results")
def get_results(run_id: str, failed_only: bool = False, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    run = own(db, Run, run_id, ctx.org)
    q = select(Result).where(Result.run_id == run.id)
    if failed_only:
        q = q.where(Result.passed.is_(False))
    return [{"id": r.id, "scenario": r.scenario, "passed": r.passed, "score": r.score,
             "transcript": r.transcript, "error": r.error} for r in db.scalars(q)]


@app.post("/v1/runs/{run_id}/share")
def share_run(run_id: str, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    """Create a public, read-only link to this run's results (no login needed to view)."""
    import secrets
    run = own(db, Run, run_id, ctx.org)
    if run.status != "completed":
        raise HTTPException(409, "Only completed runs can be shared")
    if not run.share_token:
        run.share_token = secrets.token_urlsafe(18)
        db.commit()
    return {"share_url": f"{settings.app_url}/r/{run.share_token}"}


@app.delete("/v1/runs/{run_id}/share", status_code=204)
def unshare_run(run_id: str, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    run = own(db, Run, run_id, ctx.org)
    run.share_token = None
    db.commit()


@app.get("/v1/public/reports/{token}")
def public_report(token: str, db: Session = Depends(get_db)):
    """Shared report. Deliberately leaves out the agent's prompt, rules, credentials, patched prompt and usage."""
    run = db.scalar(select(Run).where(Run.share_token == token)) if len(token) >= 16 else None
    if not run or run.status != "completed":
        raise HTTPException(404, "This report link is invalid or was turned off")
    agent = db.get(Agent, run.agent_id)
    rep = run.agent_report or {}
    keep = ("task_success", "accuracy", "compliance", "language_handling", "tone", "summary", "failures")
    return {
        "agent": agent.name if agent else "AI agent", "created_at": run.created_at, "finished_at": run.finished_at,
        "mode": (run.config or {}).get("mode", "standard"), "summary": run.summary,
        "root_causes": [{"cause": c.get("cause"), "severity": c.get("severity"), "count": len(c.get("scenario_ids") or [])}
                        for c in rep.get("root_causes", [])],
        "results": [{"scenario": {k: r.scenario.get(k) for k in ("id", "goal", "persona")}, "passed": r.passed,
                     "error": bool(r.error), "score": {k: (r.score or {}).get(k) for k in keep},
                     "transcript": r.transcript} for r in run.results],
    }


@app.get("/v1/runs/{run_id}/report", response_class=HTMLResponse)
def get_report(run_id: str, ctx: Ctx = Depends(current_ctx), db: Session = Depends(get_db)):
    run = own(db, Run, run_id, ctx.org)
    if run.status != "completed":
        raise HTTPException(409, f"Run is {run.status}")
    agent = db.get(Agent, run.agent_id)
    return render_html(services.run_results_as_engine(run), {"agent": agent.name, "llm": (run.usage or {}).get("model", "")})


# ---------- billing ----------

@app.post("/v1/billing/checkout")
def checkout(body: CheckoutIn, ctx: Ctx = Depends(require_owner)):
    try:
        return billing.create_subscription(ctx.org, body.plan, ctx.user.email if ctx.user else None)
    except billing.BillingError as e:
        raise HTTPException(503, str(e))


@app.post("/v1/billing/cancel")
def cancel(ctx: Ctx = Depends(require_owner)):
    try:
        billing.cancel_subscription(ctx.org)
    except billing.BillingError as e:
        raise HTTPException(409, str(e))
    return {"ok": True, "note": "Your plan stays active until the end of the current billing period."}


@app.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, x_razorpay_signature: str = Header(default=""),
                           db: Session = Depends(get_db)):
    raw = await request.body()
    if not billing.verify_signature(raw, x_razorpay_signature):
        raise HTTPException(400, "Invalid signature")
    return {"result": billing.handle_event(db, await request.json())}
