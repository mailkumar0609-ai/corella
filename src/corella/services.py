"""Business logic shared by the API, worker and CLI."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timezone

import httpx

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from . import engine as eng
from .config import PLANS, settings
from .llm import get_llm
from .models import Agent, ApiKey, Membership, Organization, Result, Run, User, now
from .report import summary
from .security import decrypt_target, generate_api_key, hash_key

log = logging.getLogger("corella.services")


class QuotaExceeded(Exception):
    pass


# ---------- organizations and keys ----------

def create_organization(db: Session, name: str, plan: str = "trial", owner: User | None = None) -> tuple[Organization, str]:
    if plan not in PLANS:
        raise ValueError(f"Unknown plan '{plan}'")
    org = Organization(name=name, plan=plan, webhook_secret=secrets.token_hex(24))
    db.add(org)
    db.flush()
    if owner:
        db.add(Membership(user_id=owner.id, organization_id=org.id, role="owner"))
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


def requeue_stale_runs(db: Session, minutes: int = 30) -> int:
    """Put runs that were interrupted (e.g. by a restart or deploy) back in the queue."""
    from datetime import timedelta
    cutoff = now() - timedelta(minutes=minutes)
    n = db.execute(update(Run).where(Run.status == "running", Run.started_at < cutoff)
                   .values(status="queued", started_at=None, events=[])).rowcount
    db.commit()
    if n:
        log.warning("requeued %d interrupted run(s)", n)
    return n


def execute_run(db: Session, run: Run, llm=None) -> Run:
    """Generate scenarios (if needed), simulate, score and store results."""
    agent = db.get(Agent, run.agent_id)
    cfg = run.config or {}
    llm = llm or get_llm(cfg.get("llm"))
    try:
        spec = decrypt_target(agent.target)
        target = eng.build_target(spec, llm, settings.allow_private_targets)
        desc = f"{agent.name}: {agent.description}"
        if cfg.get("mode") == "autonomous":
            from .agentic import autonomous_campaign

            def emit(step: str, msg: str):
                run.events = [*(run.events or []), {"t": now().isoformat(), "step": step, "message": msg}]
                db.commit()

            camp = autonomous_campaign(
                llm, target, desc, agent.rules, budget=int(cfg.get("scenarios", 30)), rounds=cfg.get("rounds", 3),
                max_turns=cfg.get("max_turns", 6), workers=cfg.get("workers", 4),
                system_prompt=spec.get("system_prompt"), emit=emit)
            results, run.agent_report = camp.results, camp.to_dict()
            used = len(results) + ((camp.verification or {}).get("retested", 0))
        else:
            sc = cfg.get("scenarios", 10)
            scenarios = ([eng.Scenario(**s) for s in sc] if isinstance(sc, list)
                         else eng.generate_scenarios(llm, desc, int(sc), cfg.get("personas")))
            rules = "\n\n".join(x for x in (agent.rules, cfg.get("extra_rules")) if x)
            results = eng.run_suite(llm, target, scenarios, rules, cfg.get("max_turns", 6), cfg.get("workers", 4))
            used = len(results)
        for r in results:
            db.add(Result(run_id=run.id, organization_id=run.organization_id, scenario=r.scenario.__dict__,
                          transcript=r.transcript, score=r.score, passed=r.passed, error=r.error))
        run.summary, run.status, run.conversations = summary(results), "completed", used
        if cfg.get("packs"):
            from .compliance import rule_report
            run.summary = {**run.summary, "compliance": rule_report(results, cfg["packs"])}
    except Exception as e:
        log.exception("run %s failed", run.id)
        run.status, run.error = "failed", f"{type(e).__name__}: {e}"
    run.usage, run.finished_at = {"llm": llm.name, "model": llm.model, **llm.usage()}, now()
    db.commit()
    deliver_webhook(db, run)
    return run


# ---------- regression ----------

def compare_runs(db: Session, run: Run, baseline: Run) -> dict:
    """Per-scenario diff: what broke (regressed), what got fixed, what is new."""
    def status(r: Run) -> dict:
        return {x.scenario["id"]: x.passed for x in r.results}
    now_, before = status(run), status(baseline)
    regressed = sorted(k for k, v in now_.items() if before.get(k) is True and not v)
    fixed = sorted(k for k, v in now_.items() if before.get(k) is False and v)
    return {"run_id": run.id, "baseline_run_id": baseline.id, "regressed": regressed, "fixed": fixed,
            "unchanged": len([k for k in now_ if k in before and before[k] == now_[k]]),
            "new": sorted(k for k in now_ if k not in before),
            "pass_rate": (run.summary or {}).get("passed", 0) / max((run.summary or {}).get("total", 1), 1),
            "baseline_pass_rate": (baseline.summary or {}).get("passed", 0) / max((baseline.summary or {}).get("total", 1), 1)}


# ---------- outgoing webhooks ----------

def sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def deliver_webhook(db: Session, run: Run) -> None:
    org = db.get(Organization, run.organization_id)
    if not (org.webhook_url and PLANS[org.plan]["webhooks"]):
        return
    payload = {"event": f"run.{run.status}", "run": {"id": run.id, "agent_id": run.agent_id, "status": run.status,
               "summary": run.summary, "report_url": f"{settings.app_url}/runs/{run.id}"}}
    if run.baseline_run_id and run.status == "completed":
        base = db.get(Run, run.baseline_run_id)
        if base:
            payload["comparison"] = compare_runs(db, run, base)
    body = json.dumps(payload, default=str).encode()
    try:
        from .security import check_target_url
        check_target_url(org.webhook_url, settings.allow_private_targets)
        httpx.post(org.webhook_url, content=body, timeout=10, headers={
            "content-type": "application/json", "x-corella-signature": sign(org.webhook_secret or "", body)})
    except Exception as e:  # never fail a run because a customer's webhook is down
        log.warning("webhook for run %s failed: %s", run.id, e)


def run_results_as_engine(run: Run) -> list[eng.Result]:
    return [eng.Result(eng.Scenario(**r.scenario), r.transcript, r.score, r.error) for r in run.results]
