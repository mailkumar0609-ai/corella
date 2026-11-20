"""Database models. Every customer-owned row carries organization_id (multi-tenant isolation)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

from .config import settings


def _id(prefix: str):
    return lambda: f"{prefix}_{uuid.uuid4().hex[:20]}"


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id("org"))
    name: Mapped[str] = mapped_column(String(200))
    plan: Mapped[str] = mapped_column(String(32), default="trial")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ApiKey(Base):
    __tablename__ = "api_keys"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id("key"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(100), default="default")
    prefix: Mapped[str] = mapped_column(String(16))          # shown to users to identify a key
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # sha256; raw key never stored
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Agent(Base):
    """A customer's AI agent under test."""
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id("agt"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    rules: Mapped[str] = mapped_column(Text, default="")
    target: Mapped[dict] = mapped_column(JSON)  # {"type": "http"|"prompt"|"demo", ...}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Run(Base):
    """One test campaign against an agent. Status: queued -> running -> completed | failed."""
    __tablename__ = "runs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id("run"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)
    config: Mapped[dict] = mapped_column(JSON, default=dict)  # scenarios, personas, max_turns, label
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # LLM calls/tokens, for cost tracking
    conversations: Mapped[int] = mapped_column(Integer, default=0)   # billable unit
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    results: Mapped[list["Result"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class Result(Base):
    __tablename__ = "results"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id("res"))
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    scenario: Mapped[dict] = mapped_column(JSON)
    transcript: Mapped[list] = mapped_column(JSON, default=list)
    score: Mapped[dict] = mapped_column(JSON, default=dict)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    run: Mapped[Run] = relationship(back_populates="results")


_kw = {"connect_args": {"check_same_thread": False}} if settings.database_url.startswith("sqlite") else {"pool_pre_ping": True}
engine = create_engine(settings.database_url, **_kw)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def init_db():
    """Creates tables. In production, manage schema changes with migrations (Alembic) instead."""
    Base.metadata.create_all(engine)
