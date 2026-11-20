"""Schema migrations with Alembic, run in-process so deploys need no extra step."""
from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

log = logging.getLogger("corella.migrate")
BASELINE = "0001"


def _config(conn=None) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(Path(__file__).parent / "migrations"))
    if conn is not None:
        cfg.attributes["connection"] = conn
    return cfg


def upgrade(engine) -> None:
    with engine.begin() as conn:
        tables = set(inspect(conn).get_table_names())
        cfg = _config(conn)
        if "alembic_version" not in tables and "organizations" in tables:
            log.info("existing database without migration history: marking it as baseline %s", BASELINE)
            command.stamp(cfg, BASELINE)
        command.upgrade(cfg, "head")


def revision(message: str) -> None:
    from .models import engine
    with engine.begin() as conn:
        command.revision(_config(conn), message=message, autogenerate=True)
