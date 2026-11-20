"""Corella public REST API (v1). Auth: `Authorization: Bearer crl_live_...`.

Run locally:  uvicorn corella.api:app --reload
Docs:         /docs (OpenAPI)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import __version__, services
from .config import PLANS, settings
from .models import Agent, Organization, Result, Run, SessionLocal, init_db
from .report import render_html
from .security import UnsafeTarget, check_target_url

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_app):
    init_db()
    yield


app = FastAPI(title="Corella API", version=__version__, lifespan=lifespan,
              description="Automated testing for Indian-language voice and chat AI agents.")
if settings.cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_org(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> Organization:
    token = authorization.removeprefix("Bearer ").strip()
    org = services.authenticate(db, token) if token else None
    if not org:
        raise HTTPException(401, "Invalid or missing API key")
    return org


# ---------- schemas ----------

class TargetSpec(BaseModel):
    type: Literal["http", "prompt", "demo"]
    url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    reply_field: str = "reply"
    system_prompt: str | None = None


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


class ScenarioIn(BaseModel):
    id: str
    goal: str
    persona: str
    opening: str
    success: str


class RunIn(BaseModel):
    scenarios: int | list[ScenarioIn] = 10
    personas: list[str] | None = None
    max_turns: int = Field(default=6, ge=1, le=20)
    label: str | None = None

    @field_validator("scenarios")
    @classmethod
    def _limit(cls, v):
        n = len(v) if isinstance(v, list) else v
        if not 1 <= n <= settings.max_scenarios_per_run:
            raise ValueError(f"scenarios must be between 1 and {settings.max_scenarios_per_run}")
        return v


def agent_out(a: Agent) -> AgentOut:  # never echo stored headers (they may hold the customer's secrets)
    return AgentOut(id=a.id, name=a.name, description=a.description, rules=a.rules, target_type=a.target["type"])


def run_out(r: Run) -> dict:
    return {"id": r.id, "agent_id": r.agent_id, "status": r.status, "label": (r.config or {}).get("label"),
            "summary": r.summary, "conversations": r.conversations, "error": r.error,
            "created_at": r.created_at, "started_at": r.started_at, "finished_at": r.finished_at}


def own(db: Session, model, id_: str, org: Organization):
    obj = db.get(model, id_)
    if not obj or obj.organization_id != org.id:  # 404, not 403: don't reveal other tenants' ids
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


# ---------- endpoints ----------

@app.get("/healthz")
def health():
    return {"ok": True, "version": __version__}


@app.get("/v1/me")
def me(org: Organization = Depends(current_org), db: Session = Depends(get_db)):
    return {"organization": {"id": org.id, "name": org.name, "plan": org.plan}, "limits": PLANS[org.plan],
            "conversations_this_month": services.conversations_this_month(db, org.id)}


@app.post("/v1/agents", response_model=AgentOut, status_code=201)
def create_agent(body: AgentIn, org: Organization = Depends(current_org), db: Session = Depends(get_db)):
    t = body.target
    if t.type == "http":
        if not t.url:
            raise HTTPException(422, "target.url is required for http targets")
        try:
            check_target_url(t.url, settings.allow_private_targets)
        except UnsafeTarget as e:
            raise HTTPException(422, str(e))
    if t.type == "prompt" and not t.system_prompt:
        raise HTTPException(422, "target.system_prompt is required for prompt targets")
    try:
        services.check_agent_limit(db, org)
    except services.QuotaExceeded as e:
        raise HTTPException(402, str(e))
    a = Agent(organization_id=org.id, name=body.name, description=body.description, rules=body.rules,
              target=t.model_dump(exclude_none=True))
    db.add(a)
    db.commit()
    return agent_out(a)


@app.get("/v1/agents", response_model=list[AgentOut])
def list_agents(org: Organization = Depends(current_org), db: Session = Depends(get_db)):
    return [agent_out(a) for a in db.scalars(select(Agent).where(Agent.organization_id == org.id).order_by(Agent.created_at))]


@app.delete("/v1/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: str, org: Organization = Depends(current_org), db: Session = Depends(get_db)):
    a = own(db, Agent, agent_id, org)
    if db.scalar(select(Run.id).where(Run.agent_id == a.id).limit(1)):
        raise HTTPException(409, "Agent has runs; it cannot be deleted")
    db.delete(a)
    db.commit()


@app.post("/v1/agents/{agent_id}/runs", status_code=202)
def create_run(agent_id: str, body: RunIn, org: Organization = Depends(current_org), db: Session = Depends(get_db)):
    agent = own(db, Agent, agent_id, org)
    cfg = body.model_dump(exclude_none=True)
    n = services.requested_count(cfg)
    try:
        services.check_quota(db, org, n)
    except services.QuotaExceeded as e:
        raise HTTPException(402, str(e))
    run = Run(organization_id=org.id, agent_id=agent.id, config=cfg, conversations=n)  # reserve quota now
    db.add(run)
    db.commit()
    return run_out(run)


@app.get("/v1/runs")
def list_runs(agent_id: str | None = None, limit: int = Query(20, le=100),
              org: Organization = Depends(current_org), db: Session = Depends(get_db)):
    q = select(Run).where(Run.organization_id == org.id).order_by(Run.created_at.desc()).limit(limit)
    if agent_id:
        q = q.where(Run.agent_id == agent_id)
    return [run_out(r) for r in db.scalars(q)]


@app.get("/v1/runs/{run_id}")
def get_run(run_id: str, org: Organization = Depends(current_org), db: Session = Depends(get_db)):
    return run_out(own(db, Run, run_id, org))


@app.get("/v1/runs/{run_id}/results")
def get_results(run_id: str, failed_only: bool = False, org: Organization = Depends(current_org), db: Session = Depends(get_db)):
    run = own(db, Run, run_id, org)
    q = select(Result).where(Result.run_id == run.id)
    if failed_only:
        q = q.where(Result.passed.is_(False))
    return [{"id": r.id, "scenario": r.scenario, "passed": r.passed, "score": r.score,
             "transcript": r.transcript, "error": r.error} for r in db.scalars(q)]


@app.get("/v1/runs/{run_id}/report", response_class=HTMLResponse)
def get_report(run_id: str, org: Organization = Depends(current_org), db: Session = Depends(get_db)):
    run = own(db, Run, run_id, org)
    if run.status != "completed":
        raise HTTPException(409, f"Run is {run.status}")
    agent = db.get(Agent, run.agent_id)
    return render_html(services.run_results_as_engine(run), {"agent": agent.name, "llm": (run.usage or {}).get("model", "")})
