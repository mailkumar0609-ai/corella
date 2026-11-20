"""Corella command line.

  corella run examples/demo.json [--llm mock] [--out reports]   run a suite locally from a config file (no database)
  corella worker                                               start a background worker for the API
  corella admin create-org "Acme Lending" [--plan starter]     create a customer org and print its first API key
  corella admin create-key ORG_ID                              issue another API key
  corella admin set-plan ORG_ID growth                         change a customer's plan
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from .engine import Scenario, build_target, generate_scenarios, run_suite
from .llm import get_llm
from .report import summary, to_html, to_json


def cmd_run(a):
    with open(a.config, encoding="utf-8") as f:
        cfg = json.load(f)
    llm = get_llm(a.llm)
    target = build_target(cfg.get("target", {"type": "demo"}), llm, allow_private=True)  # local CLI: user's own machine
    desc = f"{cfg.get('agent_name', 'Agent')}: {cfg.get('agent_description', '')}"
    sc = cfg.get("scenarios", 10)
    scenarios = [Scenario(**s) for s in sc] if isinstance(sc, list) else generate_scenarios(llm, desc, int(sc), cfg.get("personas"))
    print(f"[corella] {len(scenarios)} scenarios · LLM={llm.name}")
    results = run_suite(llm, target, scenarios, cfg.get("rules", ""), cfg.get("max_turns", 6), cfg.get("workers", 4))
    os.makedirs(a.out, exist_ok=True)
    meta = {"agent": cfg.get("agent_name", ""), "llm": llm.model}
    to_json(results, os.path.join(a.out, "results.json"), meta)
    to_html(results, os.path.join(a.out, "report.html"), meta)
    for r in results:
        mark = "ERROR" if r.error else ("PASS " if r.passed else "FAIL ")
        print(f"  {mark} {r.scenario.id:<24} {r.score.get('summary', r.error or '')}")
    s = summary(results)
    print(f"[corella] passed {s['passed']}/{s['total']} · tokens {llm.usage()} · report: {a.out}/report.html")
    return 0 if s["failed"] == 0 else 1


def cmd_admin(a):
    from . import services
    from .models import Organization, SessionLocal, init_db
    init_db()
    with SessionLocal() as db:
        if a.action == "create-org":
            org, key = services.create_organization(db, a.arg, a.plan)
            print(f"organization: {org.id} ({org.name}, plan={org.plan})\napi key (shown once): {key}")
        elif a.action == "create-key":
            if not db.get(Organization, a.arg):
                sys.exit("organization not found")
            key = services.create_api_key(db, a.arg)
            db.commit()
            print(f"api key (shown once): {key}")
        elif a.action == "set-plan":
            org = db.get(Organization, a.arg)
            if not org or a.plan_name not in services.PLANS:
                sys.exit("organization or plan not found")
            org.plan = a.plan_name
            db.commit()
            print(f"{org.id} plan -> {org.plan}")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(prog="corella")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("config")
    r.add_argument("--out", default="reports")
    r.add_argument("--llm", help="anthropic | openai | mock")
    sub.add_parser("worker")
    ad = sub.add_parser("admin")
    ad.add_argument("action", choices=["create-org", "create-key", "set-plan"])
    ad.add_argument("arg", help="org name (create-org) or org id")
    ad.add_argument("plan_name", nargs="?", help="plan for set-plan")
    ad.add_argument("--plan", default="trial", help="plan for create-org")
    a = p.parse_args(argv)
    if a.cmd == "run":
        return cmd_run(a)
    if a.cmd == "worker":
        from .worker import main as worker_main
        worker_main()
        return 0
    return cmd_admin(a)


if __name__ == "__main__":
    sys.exit(main())
