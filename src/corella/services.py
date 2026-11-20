"""Business logic shared by the API, worker and CLI."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from . import engine as eng
from .config import PLANS, settings
from .llm import get_llm
from .models import Agent, ApiKey, Organization, Result, Run, now
from .report import summary
from .security import generate_api_key, hash_key

log = logging.getLogger("corella.services")


class QuotaExceeded(Exception):
    pass


# ---------- organizations and keys ----------

def create_organization(db: Session, name: str, plan: str = "trial") -> tuple[Organization, str]:
    if plan not in PLANS:
        raise ValueError(f"Unknown plan '{plan}'")
    org = Organization(name=name, plan=plan)
    db.add(org)
    db.flush()
    raw = create_api_key(db, org.id)
    db.commit()
    return org, raw


def create_api_key(db: Session, org_id: str, name: str = "default") -> str:
    raw, prefix, h = generate_api_key()
    db.add(ApiKey(organization_id=org_id, name=name, prefix=prefix, key_hash=h))
    db.flush()
    return raw


def authenticate(db: Session, raw_key: str) -> Organization | None:
    key = db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_key(raw_key), ApiKey.revoked.is_(False)))
    if not key:
        return None
    key.last_used_at = now()
    db.commit()
    return db.get(Organization, key.organization_id)


# ---------- quota ----------

def conversations_this_month(db: Session, org_id: str) -> int:
    start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    reserved = func.coalesce(func.sum(Run.conversations), 0)
    return int(db.scalar(select(reserved).where(Run.organization_id == org_id, Run.created_at >= start,
                                                Run.status != "failed")) or 0)


def check_quota(db: Session, org: Organization, requested: int):
    limit = PLANS[org.plan]["monthly_conversations"]
    used = conversations_this_month(db, org.id)
    if used + requested > limit:
        raise QuotaExceeded(f"Plan '{org.plan}' allows {limit} conversations/month; {used} used, {requested} requested")


def check_agent_limit(db: Session, org: Organization):
    count = db.scalar(select(func.count()).select_from(Agent).where(Agent.organization_id == org.id))
    if count >= PLANS[org.plan]["max_agents"]:
        raise QuotaExceeded(f"Plan '{org.plan}' allows {PLANS[org.plan]['max_agents']} agent(s)")


# ---------- runs ----------

def requested_count(cfg: dict) -> int:
    sc = cfg.get("scenarios", 10)
    return len(sc) if isinstance(sc, list) else int(sc)


def claim_next_run(db: Session) -> Run | None:
    """Atomically move one queued run to running. Safe with several workers (row lock on Postgres)."""
    q = select(Run).where(Run.status == "queued").order_by(Run.created_at).limit(1)
    if db.bind.dialect.name == "postgresql":
        q = q.with_for_update(skip_locked=True)
    run = db.scalar(q)
    if not run:
        return None
    claimed = db.execute(update(Run).where(Run.id == run.id, Run.status == "queued")
                         .values(status="running", started_at=now())).rowcount
    db.commit()
    return db.get(Run, run.id) if claimed else None


def execute_run(db: Session, run: Run, llm=None) -> Run:
    """Generate scenarios (if needed), simulate, score and store results."""
    agent = db.get(Agent, run.agent_id)
    cfg = run.config or {}
    llm = llm or get_llm(cfg.get("llm"))
    try:
        target = eng.build_target(agent.target, llm, settings.allow_private_targets)
        desc = f"{agent.name}: {agent.description}"
        sc = cfg.get("scenarios", 10)
        scenarios = ([eng.Scenario(**s) for s in sc] if isinstance(sc, list)
                     else eng.generate_scenarios(llm, desc, int(sc), cfg.get("personas")))
        results = eng.run_suite(llm, target, scenarios, agent.rules, cfg.get("max_turns", 6), cfg.get("workers", 4))
        for r in results:
            db.add(Result(run_id=run.id, organization_id=run.organization_id, scenario=r.scenario.__dict__,
                          transcript=r.transcript, score=r.score, passed=r.passed, error=r.error))
        run.summary, run.status, run.conversations = summary(results), "completed", len(results)
    except Exception as e:
        log.exception("run %s failed", run.id)
        run.status, run.error = "failed", f"{type(e).__name__}: {e}"
    run.usage, run.finished_at = {"llm": llm.name, "model": llm.model, **llm.usage()}, now()
    db.commit()
    return run


def run_results_as_engine(run: Run) -> list[eng.Result]:
    return [eng.Result(eng.Scenario(**r.scenario), r.transcript, r.score, r.error) for r in run.results]
