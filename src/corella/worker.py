"""Background worker: picks queued runs and executes them. Run one or more:  python -m corella worker"""
from __future__ import annotations

import logging
import signal
import threading
import time

from .config import settings
from .models import SessionLocal, init_db
from .services import claim_next_run, execute_run, requeue_stale_runs

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


def loop(stop: threading.Event) -> None:
    """Worker loop for running inside the API process (one service instead of two)."""
    log.info("embedded worker started")
    with SessionLocal() as db:
        requeue_stale_runs(db, minutes=0)  # single instance: anything "running" at startup was interrupted
    while not stop.is_set():
        try:
            if not run_once():
                stop.wait(settings.worker_poll_seconds)
        except Exception:  # never let one bad run kill the loop
            log.exception("worker loop error")
            stop.wait(settings.worker_poll_seconds)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    signal.signal(signal.SIGTERM, _handle)
    signal.signal(signal.SIGINT, _handle)
    init_db()
    log.info("worker started")
    with SessionLocal() as db:
        requeue_stale_runs(db)
    while not _stop:
        if not run_once():
            time.sleep(settings.worker_poll_seconds)
