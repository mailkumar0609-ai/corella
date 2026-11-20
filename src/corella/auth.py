"""Two ways to authenticate:
  1. API keys (crl_live_...) for programmatic use: CI pipelines, scripts.
  2. Supabase Auth access tokens for people using the dashboard. The token is verified by asking Supabase
     (no shared secret needed); results are cached briefly.
"""
from __future__ import annotations

import hashlib
import threading
import time
from dataclasses import dataclass

import httpx
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import services
from .config import settings
from .models import Membership, Organization, SessionLocal, User
from .security import KEY_PREFIX

_cache: dict[str, tuple[float, dict]] = {}
_lock = threading.Lock()
CACHE_SECONDS = 60


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_supabase_token(token: str) -> dict | None:
    """Returns {"id", "email"} for a valid Supabase access token, else None."""
    if not settings.supabase_url:
        return None
    k = hashlib.sha256(token.encode()).hexdigest()
    with _lock:
        hit = _cache.get(k)
        if hit and hit[0] > time.time():
            return hit[1]
    try:
        r = httpx.get(f"{settings.supabase_url}/auth/v1/user", timeout=10,
                      headers={"authorization": f"Bearer {token}", "apikey": settings.supabase_anon_key})
    except httpx.HTTPError:
        raise HTTPException(503, "Authentication service unavailable")
    if r.status_code != 200:
        return None
    user = {"id": r.json()["id"], "email": r.json().get("email", "")}
    with _lock:
        _cache[k] = (time.time() + CACHE_SECONDS, user)
    return user


@dataclass
class Ctx:
    org: Organization
    user: User | None = None  # None when authenticated with an API key
    role: str = "owner"


def _token(authorization: str) -> str:
    return authorization.removeprefix("Bearer ").strip()


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    """Dashboard users only (needed before an organization exists, e.g. onboarding)."""
    token = _token(authorization)
    info = verify_supabase_token(token) if token and not token.startswith(KEY_PREFIX) else None
    if not info:
        raise HTTPException(401, "Sign in required")
    user = db.get(User, info["id"])
    if not user:
        user = User(id=info["id"], email=info["email"])
        db.add(user)
        db.commit()
    return user


def current_ctx(authorization: str = Header(default=""), x_org_id: str | None = Header(default=None),
                db: Session = Depends(get_db)) -> Ctx:
    token = _token(authorization)
    if not token:
        raise HTTPException(401, "Invalid or missing credentials")
    if token.startswith(KEY_PREFIX):
        org = services.authenticate(db, token)
        if not org:
            raise HTTPException(401, "Invalid or missing credentials")
        return Ctx(org)
    user = current_user(authorization, db)
    q = select(Membership).where(Membership.user_id == user.id)
    if x_org_id:
        q = q.where(Membership.organization_id == x_org_id)
    m = db.scalar(q.order_by(Membership.created_at))
    if not m:
        raise HTTPException(403, "onboarding_required")
    return Ctx(db.get(Organization, m.organization_id), user, m.role)


def require_owner(ctx: Ctx = Depends(current_ctx)) -> Ctx:
    if ctx.role != "owner":
        raise HTTPException(403, "Only workspace owners can do this")
    return ctx
