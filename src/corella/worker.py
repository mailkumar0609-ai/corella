"""Background worker: picks queued runs and executes them. Run one or more:  python -m corella worker"""
from __future__ import annotations

import logging
import signal
import time

from .config import settings
from .models import SessionLocal, init_db
from .services import claim_next_run, execute_run

log = logging.getLogger("corella.worker")
_stop = False


def _handle(sig, _frame):
    global _stop
    log.info("signal %s received, finishing current run then stopping", sig)
    _stop = True


def run_once(llm=None) -> bool:
    """Process one queued run. Returns True if a run was processed."""
    with SessionLocal() as db:
        run = claim_next_run(db)
        if not run:
            return False
        log.info("run %s started", run.id)
        execute_run(db, run, llm)
        log.info("run %s %s", run.id, run.status)
        return True


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    signal.signal(signal.SIGTERM, _handle)
    signal.signal(signal.SIGINT, _handle)
    init_db()
    log.info("worker started")
    while not _stop:
        if not run_once():
            time.sleep(settings.worker_poll_seconds)
